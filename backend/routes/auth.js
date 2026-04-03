const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('../models/User');

const generateTokens = (user) => {
  const jwtSecret = process.env.JWT_SECRET || 'fallback_secret_key';
  const refreshSecret = process.env.JWT_REFRESH_SECRET || 'fallback_refresh_key';

  const accessToken = jwt.sign(
    { id: user._id, role: user.role },
    jwtSecret,
    { expiresIn: '1h' }
  );

  const refreshToken = jwt.sign(
    { id: user._id },
    refreshSecret,
    { expiresIn: '7d' }
  );

  return { accessToken, refreshToken };
};

// Login
router.post('/login', async function (req, res) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Please provide email and password' });
    }

    const user = await User.findOne({ email: email.toLowerCase(), isDeleted: false }).select('+password');
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }

    const { accessToken, refreshToken } = generateTokens(user);

    // Save refresh token to user (you can also hash it here for extra security, but storing raw is common for simple setups; let's store it raw for now so we can compare it simply, or hash it. Let's store raw for simplicity since it's already a signed JWT)
    user.refreshToken = refreshToken;
    await user.save({ validateBeforeSave: false });

    res.json({
      success: true,
      message: 'Login successful',
      token: accessToken, // for backward compatibility with frontend
      accessToken,
      refreshToken,
      user: {
        _id: user._id,
        id: user._id, // compatibility
        name: user.name,
        email: user.email,
        role: user.role,
        profileImage: user.profileImage
      }
    });
  } catch (err) {
    console.error('Login error:', err.message);
    res.status(500).json({ success: false, message: 'Server error during login' });
  }
});

// Refresh Token
router.post('/refresh', async function (req, res) {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(401).json({ success: false, message: 'Refresh token required' });
    }

    const refreshSecret = process.env.JWT_REFRESH_SECRET || 'fallback_refresh_key';

    let decoded;
    try {
      decoded = jwt.verify(refreshToken, refreshSecret);
    } catch (err) {
      return res.status(403).json({ success: false, message: 'Invalid or expired refresh token' });
    }

    const user = await User.findOne({ _id: decoded.id, refreshToken, isDeleted: false });
    if (!user) {
      return res.status(403).json({ success: false, message: 'Invalid refresh token mapping' });
    }

    const tokens = generateTokens(user);

    // Rotate refresh token
    user.refreshToken = tokens.refreshToken;
    await user.save({ validateBeforeSave: false });

    res.json({
      success: true,
      token: tokens.accessToken, // compatibility
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken
    });
  } catch (err) {
    console.error('Refresh token error:', err.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Logout
router.post('/logout', async function (req, res) {
  try {
    const { refreshToken } = req.body;

    if (refreshToken) {
      await User.updateOne(
        { refreshToken },
        { $unset: { refreshToken: 1 } }
      );
    }

    res.json({ success: true, message: 'Logged out successfully' });
  } catch (err) {
    console.error('Logout error:', err.message);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Get current user
router.get('/me', async function (req, res) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'No token provided' });
    }

    const token = authHeader.split(' ')[1];
    const jwtSecret = process.env.JWT_SECRET || 'fallback_secret_key';

    const decoded = jwt.verify(token, jwtSecret);

    const userId = decoded.id || (decoded.user && decoded.user.id);
    const user = await User.findOne({ _id: userId, isDeleted: false }).select('-password -refreshToken');

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    res.json({
      success: true,
      _id: user._id,
      id: user._id, // compatibility
      name: user.name,
      email: user.email,
      role: user.role,
      profileImage: user.profileImage
    });
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, message: 'Token expired' });
    }
    res.status(401).json({ success: false, message: 'Invalid token' });
  }
});

module.exports = router;