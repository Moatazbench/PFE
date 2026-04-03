const jwt = require('jsonwebtoken');

module.exports = async function (req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'No token provided' });
    }

    const token = authHeader.split(' ')[1];
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      console.error('FATAL: JWT_SECRET not found in environment');
      return res.status(500).json({ message: 'Internal server configuration error' });
    }
    const decoded = jwt.verify(token, jwtSecret);

    // Verify user still exists and is not deleted
    const User = require('../models/User');
    const user = await User.findById(decoded.id).select('role isActive isDeleted');
    if (!user || !user.isActive || user.isDeleted) {
      return res.status(401).json({ message: 'User session invalid or unauthorized' });
    }

    req.user = decoded;
    req.user.role = user.role; // Ensure role is fresh from DB
    req.user._id = user._id;

    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') return res.status(401).json({ message: 'Token expired' });
    return res.status(401).json({ message: 'Invalid token' });
  }
};