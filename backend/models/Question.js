const mongoose = require('mongoose');

const QuestionSchema = new mongoose.Schema({
    title: { type: String, required: true },
    difficulty: { type: String, enum: ['Easy', 'Medium', 'Hard'], default: 'Medium' },
    points: { type: Number, required: true },
    task: { type: String, required: true }, // "Given a string s..."
    description: { type: String }, // General context
    constraints: { type: String }, // "1 <= s.length <= 10^5"
    inputFormat: { type: String }, // "First line contains..."
    outputFormat: { type: String }, // "A single integer..."
    examples: [{
        input: String,
        output: String,
        explanation: String
    }],
    templates: {
        cpp: { visibleCode: String, hiddenDriver: String },
        python: { visibleCode: String, hiddenDriver: String },
        java: { visibleCode: String, hiddenDriver: String }
    },
    hiddenTestCases: [{
        input: String,
        output: String
    }]
});

module.exports = mongoose.model('Question', QuestionSchema);