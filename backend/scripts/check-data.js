require('dotenv').config();
const mongoose = require('mongoose');
const HRDecision = require('../models/HRDecision');
require('../models/User');

async function checkData() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to MongoDB');

        const decisions = await HRDecision.find().populate('user', 'name');
        console.log(`Found ${decisions.length} HRDecisions.`);

        decisions.forEach((d, i) => {
            console.log(`${i + 1}. Decision ID: ${d._id}, Score: ${d.finalScore}, User data:`, JSON.stringify(d.user));
        });

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

checkData();
