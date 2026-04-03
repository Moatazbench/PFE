require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');

async function seedUsers() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    // Clear existing users
    await User.deleteMany({});
    console.log('Cleared existing users');

    // Test users — passwords are plain-text here; the User model pre('save') hook hashes them
    const testUsers = [
      { name: 'Admin User', email: 'admin@biat.com', password: 'Admin123!', role: 'ADMIN' },
      { name: 'Director Security', email: 'director@biat.com', password: 'Admin123!', role: 'ADMIN' },

      { name: 'HR Manager', email: 'hr@biat.com', password: 'HR123!', role: 'HR' },
      { name: 'Sarah HR', email: 'sarah.hr@biat.com', password: 'HR123!', role: 'HR' },
      { name: 'Michael Recruiter', email: 'michael.hr@biat.com', password: 'HR123!', role: 'HR' },

      { name: 'Ahmed Lead', email: 'ahmed.lead@biat.com', password: 'Leader123!', role: 'TEAM_LEADER' },
      { name: 'Sofia Engineering Lead', email: 'sofia.lead@biat.com', password: 'Leader123!', role: 'TEAM_LEADER' },
      { name: 'David Product Lead', email: 'david.lead@biat.com', password: 'Leader123!', role: 'TEAM_LEADER' },
      { name: 'Maria Design Lead', email: 'maria.lead@biat.com', password: 'Leader123!', role: 'TEAM_LEADER' },

      { name: 'James Developer', email: 'james.dev@biat.com', password: 'Collab123!', role: 'COLLABORATOR' },
      { name: 'Emma Developer', email: 'emma.dev@biat.com', password: 'Collab123!', role: 'COLLABORATOR' },
      { name: 'Oliver Developer', email: 'oliver.dev@biat.com', password: 'Collab123!', role: 'COLLABORATOR' },
      { name: 'Ava Designer', email: 'ava.design@biat.com', password: 'Collab123!', role: 'COLLABORATOR' },
      { name: 'William Designer', email: 'william.design@biat.com', password: 'Collab123!', role: 'COLLABORATOR' },
      { name: 'Lucas QA', email: 'lucas.qa@biat.com', password: 'Collab123!', role: 'COLLABORATOR' },
      { name: 'Mia QA', email: 'mia.qa@biat.com', password: 'Collab123!', role: 'COLLABORATOR' },
      { name: 'Liam Analyst', email: 'liam.analyst@biat.com', password: 'Collab123!', role: 'COLLABORATOR' },
      { name: 'Noah Analyst', email: 'noah.analyst@biat.com', password: 'Collab123!', role: 'COLLABORATOR' },
      { name: 'Ethan Marketing', email: 'ethan.mark@biat.com', password: 'Collab123!', role: 'COLLABORATOR' },
      { name: 'Isabella Marketing', email: 'isabella.mark@biat.com', password: 'Collab123!', role: 'COLLABORATOR' },
      { name: 'Mason Sales', email: 'mason.sales@biat.com', password: 'Collab123!', role: 'COLLABORATOR' },
      { name: 'Amelia Sales', email: 'amelia.sales@biat.com', password: 'Collab123!', role: 'COLLABORATOR' },
      { name: 'Elijah DevOps', email: 'elijah.ops@biat.com', password: 'Collab123!', role: 'COLLABORATOR' },
      { name: 'Harper DevOps', email: 'harper.ops@biat.com', password: 'Collab123!', role: 'COLLABORATOR' }
    ];

    for (const userData of testUsers) {
      // Just create the user with plain-text password — the model's pre('save') hook hashes it
      const user = new User({
        name: userData.name,
        email: userData.email,
        password: userData.password,
        role: userData.role
      });

      await user.save();
      console.log('Created user: ' + userData.email + ' (' + userData.role + ') with password: ' + userData.password);
    }

    console.log('Users seeded successfully!');
    process.exit(0);
  } catch (err) {
    console.error('Error seeding users:', err);
    process.exit(1);
  }
}

seedUsers();
