const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true }, // Roll Number
    password: { type: String, required: true }, // Hashed Phone Number
    fullName: { type: String, required: true },
    email: { type: String, required: false },
    phone: { type: String, required: true },
    role: { type: String, enum: ['participant', 'admin'], default: 'participant' },
    currentSessionId: { type: String, default: null }, 
    totalScore: { type: Number, default: 0 },
    lastSubmissionTime: { type: Date, default: Date.now },
    assessmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Assessment' }
});

module.exports = mongoose.model('User', UserSchema);