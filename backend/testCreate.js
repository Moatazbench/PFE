require('dotenv').config();
const mongoose = require('mongoose');
const Meeting = require('./models/Meeting');

async function test() {
    try {
        await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/gestion_competences');
        
        let m = await Meeting.create({
            title: "Test Meeting",
            description: "",
            organizer: new mongoose.Types.ObjectId(),
            attendees: [],
            date: "2026-03-24",
            startTime: "09:00",
            endTime: "10:00",
            type: "team",
            agenda: [],
            relatedObjectives: [],
            team: null,
            recurring: "none",
            location: ""
        });
        console.log("SUCCESS:", m._id);
    } catch(err) {
        console.error("ERROR:", err.message);
    } finally {
        mongoose.disconnect();
    }
}
test();
