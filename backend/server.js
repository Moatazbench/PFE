require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const xss = require('xss-clean');
const mongoSanitize = require('express-mongo-sanitize');
const path = require('path');

const app = express();

// Security middlewares
app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(cors({ 
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173', 
  credentials: true 
}));
app.use(express.json());
app.use(xss());
app.use(mongoSanitize());
// Perfect Sync Aggressive No-Cache Middleware
app.use((req, res, next) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  res.set('Surrogate-Control', 'no-store');
  next();
});
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 5000 }));

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.get('/', (req, res) => {
  res.json({ message: 'API is running', status: 'OK' });
});

// Load routes
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
  '/api/goals': './routes/goals',
  '/api/goal-reviews': './routes/goalReviews',
  '/api/performance': './routes/performance',
  '/api/dashboard': './routes/dashboard',
  '/api/reports': './routes/reports',
  '/api/evaluations': './routes/evaluations'
};

Object.entries(routes).forEach(([routePath, modulePath]) => {
  try {
    app.use(routePath, require(modulePath));
  } catch (err) {
    console.error(`❌ Failed to load ${routePath} routes:`, err.message);
  }
});

app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Route not found: ' + req.path });
});

const errorHandler = require('./middleware/errorHandler');
app.use(errorHandler);

// Environment setup
const requiredEnv = ['MONGO_URI', 'JWT_SECRET', 'JWT_REFRESH_SECRET'];
const missingEnv = requiredEnv.filter(env => !process.env[env]);

if (missingEnv.length > 0) {
  console.error('❌ Missing required environment variables:', missingEnv.join(', '));
  process.exit(1);
}

const mongoUri = process.env.MONGO_URI.trim();
const PORT = process.env.PORT || 5000;

console.log('⏳ Connecting to MongoDB...');

// Connect to MongoDB and then start the server
mongoose.connect(mongoUri, {
    serverSelectionTimeoutMS: 5000,
    connectTimeoutMS: 10000,
})
  .then(() => {
    console.log('✅ Connected to MongoDB');
    
    // Start Cron Jobs
    try { 
      const { startDeadlineCron } = require('./cron/deadlineCron'); 
      startDeadlineCron(); 
    } catch (err) {
      console.error('Failed to start deadline cron:', err.message);
    }
    
    try { 
      const { startReminderCron } = require('./cron/reminderCron'); 
      startReminderCron(); 
    } catch (err) {
      console.error('Failed to start reminder cron:', err.message);
    }
    
    try { 
      const { startGoalDeadlineCron } = require('./cron/goalDeadlineCron'); 
      startGoalDeadlineCron(); 
    } catch (err) {
      console.error('Failed to start goal deadline cron:', err.message);
    }

    app.listen(PORT, () => {
      console.log(`🚀 Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('❌ MongoDB Connection Error:', err.message);
    if (err.message.includes('whitelist') || err.message.includes('IP') || err.name === 'MongooseServerSelectionError') {
      console.error('👉 TIP: It looks like your IP address might not be whitelisted in MongoDB Atlas.');
      console.error('👉 ACTION: Log in to MongoDB Atlas, go to "Network Access", and add your current IP address.');
    }
    process.exit(1);
  });

// Handle unhandled rejections
process.on('unhandledRejection', (err) => {
  console.error('UNHANDLED REJECTION! 💥 Shutting down...', err);
  process.exit(1);
});