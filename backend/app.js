require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const xss = require('xss-clean');
const mongoSanitize = require('express-mongo-sanitize');
const path = require('path');

const app = express();

// =======================
// Security Middlewares
// =======================

app.use(helmet({ crossOriginResourcePolicy: false }));

const allowedOrigins = ['http://localhost:5173', 'http://localhost:3000'];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true
}));

app.use(express.json());
app.use(xss());
app.use(mongoSanitize());

app.use((req, res, next) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  res.set('Surrogate-Control', 'no-store');
  next();
});

app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 5000 }));

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// =======================
// Health Endpoints
// =======================

app.get('/', (req, res) => {
  res.json({ message: 'API is running', status: 'OK' });
});

app.get('/api/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'HR Evaluation API is running!'
  });
});

// =======================
// Load Routes
// =======================

const routes = {
  '/api/auth': './routes/auth',
  '/api/users': './routes/users',
  '/api/team-members': './routes/teamMembers',
  '/api/teams': './routes/teams',
  '/api/cycles': './routes/cycles',
  '/api/objectives': './routes/objectives',
  '/api/hr-decisions': './routes/hrDecisions',
  '/api/notifications': './routes/notifications',
  '/api/feed': './routes/feed',
  '/api/stats': './routes/stats',
  '/api/audit-logs': './routes/auditLog',
  '/api/meetings': './routes/meetings',
  '/api/ai': './routes/ai',
  '/api/feedback': './routes/feedback',
  '/api/tasks': './routes/tasks',
  '/api/career': './routes/career',
  '/api/performance': './routes/performance',
  '/api/reports': './routes/reports',
  '/api/evaluations': './routes/evaluations',
  '/api/pdf': './routes/pdf'
};

Object.entries(routes).forEach(([routePath, modulePath]) => {
  try {
    app.use(routePath, require(modulePath));
  } catch (err) {
    console.error(`❌ Failed to load ${routePath} routes:`, err.message);
  }
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Route not found: ' + req.path });
});

// Error handler
const errorHandler = require('./middleware/errorHandler');
app.use(errorHandler);

module.exports = app;