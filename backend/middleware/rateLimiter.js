// Rate limiter middleware
const rateLimit = require('express-rate-limit');

function isLocalValue(value) {
  var normalized = String(value || '').toLowerCase();
  return normalized.includes('127.0.0.1') || normalized.includes('::1') || normalized.includes('localhost');
}

function shouldSkipRateLimit(req) {
  var nodeEnv = String(process.env.NODE_ENV || 'development').toLowerCase();

  if (nodeEnv === 'production') {
    return false;
  }

  return isLocalValue(req.ip) ||
    isLocalValue(req.hostname) ||
    isLocalValue(req.socket && req.socket.remoteAddress) ||
    isLocalValue(req.headers['x-forwarded-for']);
}

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // limit each IP to 1000 requests per windowMs
  skip: shouldSkipRateLimit,
  message: {
    success: false,
    message: 'Too many requests, please try again later.'
  }
});

module.exports = limiter;
module.exports.shouldSkipRateLimit = shouldSkipRateLimit;
