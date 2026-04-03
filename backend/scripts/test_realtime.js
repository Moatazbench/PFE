const mongoose = require('mongoose');

async function run() {
  try {
    require('dotenv').config();
    await mongoose.connect(process.env.MONGO_URI);
    const User = require('../models/User');
    const jwt = require('jsonwebtoken');

    // 1. Get an existing user
    const user = await User.findOne({ role: 'TEAM_LEADER' });
    if (!user) return console.log('No user');
    const token = jwt.sign({ user: { id: user._id, role: user.role } }, process.env.JWT_SECRET);
    
    console.log('Testing as:', user.name);

    // 2. Create the meeting
    const formData = {
      title: 'Realtime test meeting',
      description: 'Is it working?',
      date: '2026-03-28',
      startTime: '09:00',
      endTime: '10:00',
      type: 'all_hands',
      recurring: 'none',
      location: 'Moon',
      attendees: [], 
      team: ''
    };

    console.log('Creating meeting...');
    let res = await fetch('http://localhost:5000/api/meetings', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(formData)
    });

    let data = await res.json();
    if (!res.ok) throw new Error(JSON.stringify(data));
    console.log('Meeting created successfully! ID:', data.meeting._id);

    // 3. Immediately fetch upcoming meetings EXACTLY as the frontend does
    console.log('Fetching upcoming meetings...');
    res = await fetch('http://localhost:5000/api/meetings?upcoming=true', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    data = await res.json();
    
    if (!res.ok) throw new Error(JSON.stringify(data));
    
    const found = data.meetings.find(m => m._id === String(data.meeting?._id) || m.title === 'Realtime test meeting');
    console.log('Was meeting found in immediate fetch?', !!found);
    
    process.exit(0);
  } catch (err) {
    console.error('Test failed:', err);
    process.exit(1);
  }
}

run();
