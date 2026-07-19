require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');

const DRY_RUN = process.argv.includes('--dry-run');
const DEFAULT_PASSWORD = process.env.DEMO_USER_PASSWORD || 'Demo123!';

const demoUsers = [
  { name: 'Nadia Director', email: 'nadia.director@biat.com', role: 'ADMIN', color: '1d4ed8' },
  { name: 'Karim Strategy Director', email: 'karim.director@biat.com', role: 'ADMIN', color: '0f766e' },
  { name: 'Leila HR Partner', email: 'leila.hr@biat.com', role: 'HR', color: 'be123c' },
  { name: 'Rania Talent Lead', email: 'rania.hr@biat.com', role: 'HR', color: '7c3aed' },
  { name: 'Youssef Delivery Lead', email: 'youssef.lead@biat.com', role: 'TEAM_LEADER', color: '2563eb' },
  { name: 'Maya Operations Lead', email: 'maya.lead@biat.com', role: 'TEAM_LEADER', color: '0891b2' },
  { name: 'Salma Product Analyst', email: 'salma.analyst@biat.com', role: 'COLLABORATOR', color: 'ea580c' },
  { name: 'Anis Data Specialist', email: 'anis.data@biat.com', role: 'COLLABORATOR', color: '16a34a' },
  { name: 'Ines UX Researcher', email: 'ines.ux@biat.com', role: 'COLLABORATOR', color: 'c026d3' },
  { name: 'Tarek Platform Engineer', email: 'tarek.platform@biat.com', role: 'COLLABORATOR', color: '475569' },
];

function assertNonProductionConnection(uri) {
  const env = String(process.env.NODE_ENV || 'development').toLowerCase();
  const dbName = String(uri || '').split('/').pop().split('?')[0].toLowerCase();

  if (env === 'production' || /prod|production/.test(dbName)) {
    throw new Error('Refusing to enrich demo users against a production-looking database: ' + dbName);
  }
}

function avatarUrl(user) {
  const name = encodeURIComponent(user.name);
  return 'https://ui-avatars.com/api/?name=' + name + '&background=' + user.color + '&color=fff&bold=true&size=192&format=svg';
}

async function enrichDemoUsers() {
  const uri = process.env.MONGO_URI;
  if (!uri) throw new Error('MONGO_URI is required.');
  assertNonProductionConnection(uri);

  await mongoose.connect(uri);

  const summary = { created: 0, updated: 0, unchanged: 0 };

  for (const spec of demoUsers) {
    const existing = await User.findOne({ email: spec.email });
    const profileImage = avatarUrl(spec);

    if (!existing) {
      summary.created += 1;
      if (!DRY_RUN) {
        await User.create({
          name: spec.name,
          email: spec.email,
          password: DEFAULT_PASSWORD,
          role: spec.role,
          profileImage,
          isActive: true,
        });
      }
      continue;
    }

    const updates = {};
    if (existing.name !== spec.name) updates.name = spec.name;
    if (existing.role !== spec.role) updates.role = spec.role;
    if (existing.profileImage !== profileImage) updates.profileImage = profileImage;
    if (existing.isActive !== true) updates.isActive = true;

    if (Object.keys(updates).length === 0) {
      summary.unchanged += 1;
      continue;
    }

    summary.updated += 1;
    if (!DRY_RUN) {
      await User.updateOne({ _id: existing._id }, { $set: updates });
    }
  }

  console.log((DRY_RUN ? 'Dry run' : 'Demo user enrichment') + ' complete.');
  console.log('Created: ' + summary.created);
  console.log('Updated: ' + summary.updated);
  console.log('Unchanged: ' + summary.unchanged);
  console.log('Director users use role ADMIN, which the app labels as Director and permits to manage cycles.');
}

enrichDemoUsers()
  .catch(function (err) {
    console.error(err.message || err);
    process.exitCode = 1;
  })
  .finally(function () {
    return mongoose.connection.close();
  });
