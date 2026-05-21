const mongoose = require('mongoose');

const TeamSchema = new mongoose.Schema({
  name: { 
    type: String, 
    required: true 
  },
  description: { 
    type: String, 
    default: '' 
  },
  // Team leader (manager)
  leader: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User' 
  },
  // Team members (collaborators)
  members: [{ 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User' 
  }],
  parentTeam: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Team',
    default: null
  },
  createdBy: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User' 
  },
  createdAt: { 
    type: Date, 
    default: Date.now 
  }
});

TeamSchema.index({ leader: 1 });
TeamSchema.index({ members: 1 });
TeamSchema.index({ parentTeam: 1 });

module.exports = mongoose.model('Team', TeamSchema);
