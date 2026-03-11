const Question = require('../models/Question');
const AssessmentProgress = require('../models/AssessmentProgress');

const hasTemplatePair = (tpl) => Boolean(tpl && typeof tpl.visibleCode === 'string' && typeof tpl.hiddenDriver === 'string');

exports.getAllQuestionsWithProgress = async (req, res) => {
    try {
        const { username } = req.query; // rollNo passed from frontend
        const questions = await Question.find({});
        const progress = username ? await AssessmentProgress.findOne({ username }) : null;

        const questionsWithProgress = questions.map((q) => {
            const bestProgress = progress?.questions?.find(
                (item) => item.questionId.toString() === q._id.toString()
            );

            const bestPassedCount = bestProgress ? bestProgress.bestPassedCount : 0;
            const totalHidden = q.hiddenTestCases.length;

            return {
                id: q._id,
                title: q.title,
                xp: q.points,
                testCasesTotal: totalHidden,
                // These values populate your dashboard cards
                testCasesPassed: bestPassedCount,
                score: bestPassedCount,
                status: bestPassedCount === 0 ? 'UNATTEMPTED' : (bestPassedCount === totalHidden ? 'ACCEPTED' : 'ATTEMPTED')
            };
        });
        console.log(`📊 Fetched ${questionsWithProgress.length} questions with progress for user: ${username}`);
        res.json({ success: true, data: questionsWithProgress });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
};
exports.createQuestion = async (req, res) => {
    try {
        const questionData = req.body;
        
        if (
            !hasTemplatePair(questionData.templates?.cpp) ||
            !hasTemplatePair(questionData.templates?.python) ||
            !hasTemplatePair(questionData.templates?.java)
        ) {
            return res.status(400).json({ 
                success: false, 
                error: "C++, Python, and Java templates must include both visibleCode and hiddenDriver." 
            });
        }

        const newQuestion = new Question(questionData);
        await newQuestion.save();

        res.status(201).json({
            success: true,
            message: "Question added to problem pool successfully.",
            questionId: newQuestion._id
        });
    } catch (err) {
        console.error("Error creating question:", err);
        res.status(500).json({ success: false, error: "Server error while saving question." });
    }
};

exports.getAllQuestions = async (req, res) => {
    try {
        const questions = await Question.find().select('title difficulty');

        // Lightweight payload for admin problem selection.
        const formattedQuestions = questions.map(q => ({
            id: q._id,
            title: q.title,
            difficulty: q.difficulty
        }));

        res.json({ success: true, data: formattedQuestions });
    } catch (err) {
        res.status(500).json({ success: false, error: "Failed to fetch questions." });
    }
};

// Fetch a single question by ID for the IDE
exports.getQuestionById = async (req, res) => {
    try {
        const question = await Question.findById(req.params.id);
        
        if (!question) {
            return res.status(404).json({ success: false, error: "Question not found." });
        }

        res.json({ success: true, data: question });
    } catch (err) {
        console.error("Error fetching question by ID:", err);
        res.status(500).json({ success: false, error: "Failed to fetch question details." });
    }
};

// Fetch full question payload for admin question editor tab.
exports.getAllQuestionsFull = async (req, res) => {
    try {
        const questions = await Question.find().sort({ _id: -1 });
        res.json({ success: true, data: questions });
    } catch (err) {
        res.status(500).json({ success: false, error: "Failed to fetch full questions." });
    }
};

// Update a question while preserving existing template code when partial updates are sent.
exports.updateQuestion = async (req, res) => {
    try {
        const { id } = req.params;
        const updateData = req.body;

        const existing = await Question.findById(id);
        if (!existing) {
            return res.status(404).json({ success: false, error: "Question not found." });
        }

        const mergedTemplates = {
            cpp: {
                visibleCode: updateData.templates?.cpp?.visibleCode ?? existing.templates?.cpp?.visibleCode ?? "",
                hiddenDriver: updateData.templates?.cpp?.hiddenDriver ?? existing.templates?.cpp?.hiddenDriver ?? ""
            },
            python: {
                visibleCode: updateData.templates?.python?.visibleCode ?? existing.templates?.python?.visibleCode ?? "",
                hiddenDriver: updateData.templates?.python?.hiddenDriver ?? existing.templates?.python?.hiddenDriver ?? ""
            },
            java: {
                visibleCode: updateData.templates?.java?.visibleCode ?? existing.templates?.java?.visibleCode ?? "",
                hiddenDriver: updateData.templates?.java?.hiddenDriver ?? existing.templates?.java?.hiddenDriver ?? ""
            }
        };

        if (!hasTemplatePair(mergedTemplates.cpp) || !hasTemplatePair(mergedTemplates.python) || !hasTemplatePair(mergedTemplates.java)) {
            return res.status(400).json({
                success: false,
                error: "C++, Python, and Java templates must include both visibleCode and hiddenDriver."
            });
        }

        Object.assign(existing, updateData);
        existing.templates = mergedTemplates;

        await existing.save();

        return res.json({
            success: true,
            message: "Question updated successfully.",
            data: existing
        });
    } catch (err) {
        console.error("Error updating question:", err);
        return res.status(500).json({ success: false, error: "Failed to update question." });
    }
};

exports.deleteQuestion = async (req, res) => {
    try {
        const { id } = req.params;

        const deleted = await Question.findByIdAndDelete(id);
        if (!deleted) {
            return res.status(404).json({ success: false, error: "Question not found." });
        }

        return res.json({
            success: true,
            message: "Question deleted successfully."
        });
    } catch (err) {
        console.error("Error deleting question:", err);
        return res.status(500).json({ success: false, error: "Failed to delete question." });
    }
};