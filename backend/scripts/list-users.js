const mongoose = require('mongoose');
require('dotenv').config();
const User = require('../models/User');

const listUsers = async () => {
  try {
    const mongoUri = process.env.MONGO_URI;
    if (!mongoUri) {
      console.error('❌ MONGO_URI not found in .env');
      process.exit(1);
    }

    await mongoose.connect(mongoUri.trim());
    console.log('connected');

    const users = await User.find({ isDeleted: false }).select('name email role').lean();
    
    if (users.length === 0) {
      console.log('No users found.');
    } else {
      users.forEach((u, i) => {
        console.log(`${i + 1}. ${u.name} | ${u.email} | ${u.role}`);
      });
    }
    
    await mongoose.connection.close();
    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
};

listUsers();
