const User = require('../models/User');
const AssessmentProgress = require('../models/AssessmentProgress');

exports.getLeaderboard = async (req, res) => {
    try {
        const leaderboard = await AssessmentProgress.aggregate([
            // 1. Join with users to keep participant-only records + profile details.
            {
                $lookup: {
                    from: 'users',
                    localField: 'username',
                    foreignField: 'username',
                    as: 'user'
                }
            },
            { $unwind: '$user' },
            { $match: { 'user.role': 'participant' } },

            // 2. Build leaderboard response fields.
            {
                $project: {
                    _id: 0,
                    username: '$username',
                    fullName: '$user.fullName',
                    totalScore: '$totalScore',
                    lastSubmissionTime: {
                        $ifNull: [
                            { $max: '$questions.lastImprovedAt' },
                            '$user.lastSubmissionTime'
                        ]
                    }
                }
            },

            // 3. Score DESC, then earliest improvement/submission for tie-break.
            {
                $sort: {
                    totalScore: -1,
                    lastSubmissionTime: 1
                }
            },

            // 4. Limit to top 100 for performance.
            { $limit: 100 }
        ]);

        res.json({
            success: true,
            data: leaderboard
        });
    } catch (err) {
        console.error("Leaderboard Error:", err);
        res.status(500).json({ success: false, error: "Could not fetch leaderboard." });
    }
};