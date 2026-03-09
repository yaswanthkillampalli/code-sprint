const mongoose = require('mongoose');

const AssessmentSchema = new mongoose.Schema({
    title: { type: String, required: true },
    status: { type: String, enum: ['waiting', 'countdown', 'active', 'finished'], default: 'waiting' },
    startTime: { type: Date },
    durationMinutes: { type: Number, default: 120 },
    questions: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Question' }],
    allowedUsers: [{ type: String }] // Array of Roll Numbers from Excel
});

module.exports = mongoose.model('Assessment', AssessmentSchema);