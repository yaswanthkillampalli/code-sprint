const Question = require('../models/Question');
const User = require('../models/User');
const axios = require('axios');
const AssessmentProgress = require('../models/AssessmentProgress');
// Judge0 Local Docker URL (Default port is 2358)
const JUDGE0_URL = process.env.JUDGE0_URL || 'http://localhost:2358';

// Judge0 CE Language IDs
const LANGUAGE_IDS = {
    'cpp': 54,     // C++ (GCC 9.2.0)
    'python': 71,  // Python (3.8.1)
    'java': 62     // Java (OpenJDK 13.0.1)
};

exports.submitCode = async (req, res) => {
    try {
        const { questionId, language, code, type = 'run', username } = req.body;
        console.log(`>>> Incoming Submission: { Type: ${type}, User: ${username}, Question: ${questionId} }`);

        const question = await Question.findById(questionId);
        if (!question) return res.status(404).json({ success: false, error: "Question not found" });

        const langKey = language.toLowerCase();
        const template = question.templates[langKey];
        if (!template) return res.status(400).json({ success: false, error: `No template for ${language}` });

        const finalCode = template.hiddenDriver.replace('{{USER_CODE}}', code);
        console.log(finalCode); // Debug: Log the final code being sent to Judge0
        const isRunMode = type === 'run';
        const testCasesToRun = isRunMode ? question.examples : question.hiddenTestCases;
        const langId = LANGUAGE_IDS[langKey];

        const results = [];
        let passedCount = 0;

        // 1. EXECUTION LOOP
        for (let i = 0; i < testCasesToRun.length; i++) {
            const tc = testCasesToRun[i];
            const payload = {
                language_id: langId,
                source_code: Buffer.from(finalCode).toString('base64'),
                stdin: Buffer.from(tc.input).toString('base64'),
                expected_output: Buffer.from(tc.output || tc.expectedOutput || "").toString('base64'),
                base64_encoded: true 
            };

            const response = await axios.post(`${JUDGE0_URL}/submissions?wait=true&base64_encoded=true`, payload);
            if (!response || !response.data) continue;

            const judgeResult = response.data;
            const isPassed = judgeResult.status && judgeResult.status.id === 3;
            if (isPassed) passedCount++;

            if (isRunMode) {
                results.push({
                    id: i + 1,
                    input: tc.input,
                    expected: tc.output || tc.expectedOutput,
                    actual: judgeResult.stdout ? Buffer.from(judgeResult.stdout, 'base64').toString('utf-8').trim() : 
                            (judgeResult.stderr ? Buffer.from(judgeResult.stderr, 'base64').toString('utf-8') : "Error"),
                    passed: isPassed,
                    status: judgeResult.status
                });
            }
        }

        // 2. SCORING LOGIC (STRICTLY GATED)
        // ... (imports and execution loop remain the same)

        // 2. SCORING LOGIC (STRICTLY GATED)
        let totalPointsForResponse = 0;

        if (type === 'submit' && username) {
            // 1. Find or initialize this user's progress document
            let progress = await AssessmentProgress.findOne({ username });
            if (!progress) {
                progress = new AssessmentProgress({ username, totalScore: 0, questions: [] });
            }

            const questionProgress = progress.questions.find(
                (q) => q.questionId.toString() === questionId.toString()
            );

            const previousBest = questionProgress ? questionProgress.bestPassedCount : 0;
            const currentScore = passedCount;

            let pointsAwarded = 0;

            // 2. If they improved, calculate the points to add to their totalScore
            if (currentScore > previousBest) {
                pointsAwarded = currentScore - previousBest;

                if (questionProgress) {
                    questionProgress.bestPassedCount = currentScore;
                    questionProgress.bestPoints = currentScore;
                    questionProgress.bestCode = code;
                    questionProgress.language = language;
                    questionProgress.lastImprovedAt = new Date();
                } else {
                    progress.questions.push({
                        questionId,
                        bestPassedCount: currentScore,
                        bestPoints: currentScore,
                        bestCode: code,
                        language,
                        lastImprovedAt: new Date()
                    });
                }

                progress.totalScore += pointsAwarded;
                await progress.save();

                // Keep User.totalScore in sync for existing screens using user scores.
                await User.updateOne(
                    { username },
                    {
                        $inc: { totalScore: pointsAwarded },
                        $set: { lastSubmissionTime: new Date() }
                    }
                );
            } else {
                await User.updateOne(
                    { username },
                    { $set: { lastSubmissionTime: new Date() } }
                );
            }
            
            totalPointsForResponse = pointsAwarded;

            console.log(`🎯 PROGRESS UPDATED: ${username} best is ${currentScore}/${testCasesToRun.length}`);
        } else {
            console.log("🏃 RUN MODE: Skipping database update.");
        }

        // 3. FINAL RESPONSE
        const responseData = {
            // Keep the response status readable for the frontend
            status: passedCount === testCasesToRun.length ? "Accepted" : "Wrong Answer",
            passed: passedCount,
            total: testCasesToRun.length,
            pointsEarned: totalPointsForResponse
        };

        if (isRunMode) {
            responseData.cases = results;
        }

        res.json({
            success: true,
            data: responseData
        });

    } catch (err) {
        console.error("❌ BACKEND ERROR:", err.message);
        res.status(500).json({ success: false, error: "Execution server error" });
    }
};