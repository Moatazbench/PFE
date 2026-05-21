const jwt = require('jsonwebtoken');

const AUTH_USER_CACHE_TTL_MS = Number(process.env.AUTH_USER_CACHE_TTL_MS || 10000);
const authUserCache = new Map();

function getCachedAuthUser(userId) {
  if (!AUTH_USER_CACHE_TTL_MS) {
    return null;
  }

  const entry = authUserCache.get(String(userId));
  if (!entry) {
    return null;
  }

  if (entry.expiresAt <= Date.now()) {
    authUserCache.delete(String(userId));
    return null;
  }

  return entry.user;
}

function setCachedAuthUser(userId, user) {
  if (!AUTH_USER_CACHE_TTL_MS || !user) {
    return user;
  }

  authUserCache.set(String(userId), {
    user: user,
    expiresAt: Date.now() + AUTH_USER_CACHE_TTL_MS,
  });

  return user;
}

function clearCachedAuthUser(userId) {
  authUserCache.delete(String(userId));
}

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
    const userId = decoded.id || (decoded.user && decoded.user.id);

    if (!userId) {
      return res.status(401).json({ message: 'Invalid token' });
    }

    // Cache the lightweight auth profile briefly to avoid repeating the same lookup for parallel page requests.
    const User = require('../models/User');
    const user = getCachedAuthUser(userId) || setCachedAuthUser(
      userId,
      await User.findById(userId).select('_id role isActive isDeleted').lean()
    );

    if (!user || !user.isActive || user.isDeleted) {
      clearCachedAuthUser(userId);
      return res.status(401).json({ message: 'User session invalid or unauthorized' });
    }

    req.user = Object.assign({}, decoded, {
      id: String(user._id),
      role: user.role,
    });
    req.user._id = user._id;

    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') return res.status(401).json({ message: 'Token expired' });
    return res.status(401).json({ message: 'Invalid token' });
  }
};
