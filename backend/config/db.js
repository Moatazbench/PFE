// ./config/db.js
const mongoose = require('mongoose');

const connectDB = async () => {
  const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/hr_evaluation';
  mongoose.set('strictQuery', true);
  await mongoose.connect(MONGO_URI, {
    dbName: process.env.MONGO_DB_NAME || 'hr_evaluation',
  });
  console.log('✅ MongoDB connected');
};

module.exports = connectDB;