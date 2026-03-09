const Question = require('../models/Question');
const AssessmentProgress = require('../models/AssessmentProgress');

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
        
        if (!questionData.templates?.cpp || !questionData.templates?.python) {
            return res.status(400).json({ 
                success: false, 
                error: "At least C++ and Python templates are required." 
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
        const questions = await Question.find().select('title difficulty points hiddenTestCases');
        
        // Transform the data so the frontend knows the total XP and Total Testcases
        const formattedQuestions = questions.map(q => ({
            id: q._id,
            title: q.title,
            xp: q.points,
            testCasesTotal: q.hiddenTestCases.length,
            // These will be filled by the User's submission history later
            testCasesPassed: 0, 
            score: 0,
            status: 'UNATTEMPTED'
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