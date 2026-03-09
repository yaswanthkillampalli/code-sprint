const mongoose = require('mongoose');

const AssessmentProgressSchema = new mongoose.Schema({
    username: {
        type: String,
        required: true,
        index: true
    },
    // We can track the total exam score right here for the leaderboard
    totalScore: {
        type: Number,
        default: 0
    },
    // This array holds the zero-initialized data for every question
    questions: [
        {
            questionId: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'Question',
                required: true
            },
            bestPassedCount: {
                type: Number,
                default: 0
            },
            bestPoints: {
                type: Number,
                default: 0
            },
            // We only save the code that got them their highest score
            bestCode: {
                type: String,
                default: "" 
            },
            language: {
                type: String,
                default: ""
            },
            // ONLY updated when bestPassedCount increases (perfect for tie-breaking)
            lastImprovedAt: {
                type: Date 
            }
        }
    ]
});

module.exports = mongoose.model('AssessmentProgress', AssessmentProgressSchema);