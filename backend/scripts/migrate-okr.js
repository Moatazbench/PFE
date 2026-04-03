require('dotenv').config();
const mongoose = require('mongoose');

var mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/hr_management';

async function migrate() {
  console.log('========================================');
  console.log('OKR Migration Script');
  console.log('========================================');

  await mongoose.connect(mongoUri);
  console.log('Connected to MongoDB');

  var db = mongoose.connection.db;

  console.log('\n--- Updating Objectives ---');
  var objResult = await db.collection('objectives').updateMany(
    { category: { $exists: false } },
    { $set: { category: 'individual', objectiveType: 'standard', progress: 0, parentObjectiveId: null, tenantId: 'default', team: null } }
  );
  console.log('Objectives migrated: ' + objResult.modifiedCount);

  await db.collection('objectives').updateMany({ tenantId: { $exists: false } }, { $set: { tenantId: 'default' } });
  await db.collection('objectives').updateMany({ progress: { $exists: false } }, { $set: { progress: 0 } });
  await db.collection('objectives').updateMany({ team: { $exists: false } }, { $set: { team: null } });

  console.log('\n--- Updating Users ---');
  var userResult = await db.collection('users').updateMany(
    { tenantId: { $exists: false } },
    { $set: { tenantId: 'default' } }
  );
  console.log('Users updated: ' + userResult.modifiedCount);

  console.log('\n--- Updating Cycles ---');
  var cycleResult = await db.collection('cycles').updateMany(
    { quarter: { $exists: false } },
    { $set: { quarter: null } }
  );
  console.log('Cycles updated: ' + cycleResult.modifiedCount);

  console.log('\n--- Updating HRDecisions ---');
  try {
    await db.collection('hrdecisions').updateMany(
      { individualScore: { $exists: false } },
      { $set: { individualScore: 0, teamScore: 0 } }
    );
    await db.collection('hrdecisions').updateMany(
      { individualScore: 0, finalScore: { $gt: 0 } },
      [{ $set: { individualScore: '$finalScore' } }]
    );
    console.log('HRDecisions updated');
  } catch (e) {
    console.log('HRDecisions collection may not exist yet - OK');
  }

  console.log('\n--- Creating Indexes ---');
  var indexes = [
    { col: 'objectives', idx: { parentObjectiveId: 1 } },
    { col: 'objectives', idx: { user: 1, cycle: 1 } },
    { col: 'objectives', idx: { cycle: 1, status: 1 } },
    { col: 'objectives', idx: { category: 1, user: 1, cycle: 1 } },
    { col: 'objectives', idx: { team: 1, cycle: 1 } },
    { col: 'objectives', idx: { tenantId: 1, user: 1 } },
    { col: 'users', idx: { tenantId: 1 } },
    { col: 'cycles', idx: { year: 1, quarter: 1 } }
  ];

  for (var i = 0; i < indexes.length; i++) {
    try {
      await db.collection(indexes[i].col).createIndex(indexes[i].idx);
      console.log('  Created: ' + indexes[i].col + ' ' + JSON.stringify(indexes[i].idx));
    } catch (e) {
      console.log('  Skipped: ' + indexes[i].col + ' ' + e.message);
    }
  }

  console.log('\n--- Verification ---');
  var objCount = await db.collection('objectives').countDocuments();
  var individualCount = await db.collection('objectives').countDocuments({ category: 'individual' });
  var teamCount = await db.collection('objectives').countDocuments({ category: 'team' });
  console.log('Objectives: ' + objCount + ' total (' + individualCount + ' individual, ' + teamCount + ' team)');

  console.log('\n========================================');
  console.log('Migration completed!');
  console.log('Scoring: Individual(70%) + Team(30%) = 100%');
  console.log('========================================');

  await mongoose.disconnect();
  process.exit(0);
}

migrate().catch(function(err) {
  console.error('Migration failed:', err);
  process.exit(1);
});