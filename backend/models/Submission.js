const mongoose = require('mongoose');

const SubmissionSchema = new mongoose.Schema({
    username: {
        type: String, // This is the Roll No / Student ID
        required: true,
        index: true
    },
    questionId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Question',
        required: true,
        index: true
    },
    language: {
        type: String,
        enum: ['cpp', 'python', 'java'],
        required: true
    },
    code: {
        type: String,
        required: true
    },
    status: {
        type: String,
        enum: ['Accepted', 'Wrong Answer', 'Runtime Error (NZEC)', 'Compilation Error', 'Time Limit Exceeded'],
        required: true
    },
    passedCount: {
        type: Number,
        default: 0
    },
    totalTestCases: {
        type: Number,
        required: true
    },
    pointsAwarded: {
        type: Number, // The "new" points added to the user's total
        default: 0
    },
    executionTime: {
        type: String // To show performance in the UI
    },
    memoryUsage: {
        type: Number // In KB
    },
    submittedAt: {
        type: Date,
        default: Date.now
    }
});

// Compound index for fast lookup of a student's best score on a specific question
SubmissionSchema.index({ username: 1, questionId: 1, passedCount: -1 });

module.exports = mongoose.model('Submission', SubmissionSchema);