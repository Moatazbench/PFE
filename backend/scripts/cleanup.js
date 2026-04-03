require('dotenv').config();
const mongoose = require('mongoose');

async function cleanup() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to MongoDB');

        const collections = ['users', 'teams', 'objectives', 'cycles', 'hrdecisions', 'notifications', 'auditlogs'];

        for (const colName of collections) {
            const result = await mongoose.connection.db.collection(colName).deleteMany({});
            console.log(`Cleared collection: ${colName} (${result.deletedCount} items deleted)`);
        }

        console.log('Global cleanup completed!');
        process.exit(0);
    } catch (err) {
        console.error('Cleanup error:', err);
        process.exit(1);
    }
}

cleanup();
