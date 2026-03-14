const Question = require('../models/Question');
const User = require('../models/User');
const axios = require('axios');
const AssessmentProgress = require('../models/AssessmentProgress');
const Assessment = require('../models/Assessment');
// Judge0 Local Docker URL (Default port is 2358)
const JUDGE0_URL = process.env.JUDGE0_URL || 'http://localhost:2358';

// Judge0 CE Language IDs
const LANGUAGE_IDS = {
    'cpp': 54,     // C++ (GCC 9.2.0)
    'python': 71,  // Python (3.8.1)
    'java': 62     // Java (OpenJDK 13.0.1)
};

async function waitForResult(token) {
    while (true) {
        const res = await axios.get(`${JUDGE0_URL}/submissions/${token}?base64_encoded=true`);
        const statusId = res.data.status.id;

        // 1 = In Queue, 2 = Processing
        if (statusId > 2) {
            return res.data;
        }

        await new Promise(r => setTimeout(r, 200));
    }
}

exports.submitCode = async (req, res) => {
    try {
        const { questionId, language, code, type = 'run', username } = req.body;

        if (!username) {
            return res.status(400).json({ success: false, error: "Username is required." });
        }

        const assessment = await Assessment.findOne({ allowedUsers: username })
            .sort({ _id: -1 })
            .select('status startTime durationMinutes questions');

        if (!assessment) {
            return res.status(403).json({ success: false, error: "No assessment assigned for this user." });
        }

        if (assessment.status !== 'active') {
            return res.status(403).json({ success: false, error: "Assessment is not active." });
        }

        const nowMs = Date.now();
        const startMs = new Date(assessment.startTime).getTime();
        const endMs = startMs + assessment.durationMinutes * 60 * 1000;

        if (nowMs < startMs) {
            return res.status(403).json({ success: false, error: "Assessment has not started yet." });
        }

        if (nowMs > endMs) {
            return res.status(403).json({ success: false, error: "Assessment has ended." });
        }

        const isAllowedQuestion = assessment.questions.some(
            (qid) => qid.toString() === questionId.toString()
        );

        if (!isAllowedQuestion) {
            return res.status(403).json({ success: false, error: "Question is not part of this assessment." });
        }

        const question = await Question.findById(questionId);
        if (!question) {
            return res.status(404).json({ success: false, error: "Question not found" });
        }

        const langKey = language.toLowerCase();
        const template = question.templates[langKey];
        if (!template) {
            return res.status(400).json({ success: false, error: `No template for ${language}` });
        }

        const finalCode = template.hiddenDriver.replace('{{USER_CODE}}', code);
        const isRunMode = type === 'run';
        const testCasesToRun = isRunMode ? question.examples : question.hiddenTestCases;
        const langId = LANGUAGE_IDS[langKey];

        const tokens = [];

        // SUBMIT ALL TESTCASES
        for (let i = 0; i < testCasesToRun.length; i++) {
            const tc = testCasesToRun[i];

            const safeInput = String(tc.input || "").replace(/\\n/g, '\n');
            const safeOutput = String(tc.output || tc.expectedOutput || "").replace(/\\n/g, '\n');

            const payload = {
                language_id: langId,
                source_code: Buffer.from(finalCode).toString('base64'),
                stdin: Buffer.from(safeInput).toString('base64'),
                expected_output: Buffer.from(safeOutput).toString('base64'),
                base64_encoded: true
            };

            const response = await axios.post(`${JUDGE0_URL}/submissions?base64_encoded=true`, payload);

            tokens.push({
                token: response.data.token,
                tc,
                index: i
            });
        }

        // FETCH RESULTS
        const judgeResults = await Promise.all(
            tokens.map(t => waitForResult(t.token))
        );

        const results = [];
        let passedCount = 0;

        for (let i = 0; i < judgeResults.length; i++) {
            const judgeResult = judgeResults[i];
            const tc = tokens[i].tc;

            const isPassed = judgeResult.status && judgeResult.status.id === 3;
            if (isPassed) passedCount++;

            if (isRunMode) {
                results.push({
                    id: i + 1,
                    input: tc.input,
                    expected: tc.output || tc.expectedOutput,
                    actual: judgeResult.stdout
                        ? Buffer.from(judgeResult.stdout, 'base64').toString('utf-8').trim()
                        : (judgeResult.stderr
                            ? Buffer.from(judgeResult.stderr, 'base64').toString('utf-8')
                            : "Error"),
                    passed: isPassed,
                    status: judgeResult.status
                });
            }
        }

        // SCORING
        let totalPointsForResponse = 0;

        if (type === 'submit' && username) {

            let progress = await AssessmentProgress.findOne({ username });

            if (!progress) {
                progress = new AssessmentProgress({
                    username,
                    totalScore: 0,
                    questions: []
                });
            }

            const questionProgress = progress.questions.find(
                q => q.questionId.toString() === questionId.toString()
            );

            const previousBest = questionProgress ? questionProgress.bestPassedCount : 0;
            const currentScore = passedCount;

            let pointsAwarded = 0;

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
        }

        const responseData = {
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
        res.status(500).json({
            success: false,
            error: "Execution server error"
        });
    }
};