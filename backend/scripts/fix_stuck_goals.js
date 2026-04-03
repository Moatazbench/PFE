require('dotenv').config();
const mongoose = require('mongoose');
const Objective = require('../models/Objective');
const Team = require('../models/Team');

async function fixStuckGoals() {
  try {
    await mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });
    console.log('Connected to DB');

    const stuckGoals = await Objective.find({
      status: { $in: ['pending', 'submitted', 'pending_approval'] },
      $or: [{ submittedTo: { $exists: false } }, { submittedTo: null }]
    });

    console.log(`Found ${stuckGoals.length} stuck goals without submittedTo`);

    for (const goal of stuckGoals) {
      const team = await Team.findOne({ members: goal.owner });
      if (team && team.leader) {
        goal.submittedTo = team.leader;
        await goal.save();
        console.log(`Fixed goal ${goal._id} -> Set submittedTo ${team.leader}`);
      } else {
        console.log(`Could not fix goal ${goal._id} (owner ${goal.owner}) - no team or leader found`);
      }
    }

    console.log('Done');
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

fixStuckGoals();
