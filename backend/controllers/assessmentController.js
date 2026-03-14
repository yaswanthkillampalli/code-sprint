const Assessment = require('../models/Assessment');
const User = require('../models/User');
const bcrypt = require('bcrypt');
const AssessmentProgress = require('../models/AssessmentProgress');
const Submission = require('../models/Submission');
const mongoose = require('mongoose');

const normalizeUsername = (value) => String(value || '').trim();

const normalizeQuestionId = (value) => String(value || '').trim();

const buildProgressQuestions = (questionIds) => questionIds.map((questionId) => ({
    questionId,
    bestPassedCount: 0,
    bestPoints: 0,
    bestCode: '',
    language: '',
    lastImprovedAt: null
}));

const recalculateTotalFromProgressQuestions = (questions) => (
    (questions || []).reduce((sum, item) => sum + Number(item.bestPoints || 0), 0)
);

const toObjectIds = (questionIds) => questionIds.map((id) => new mongoose.Types.ObjectId(id));

const hashUsersWithPhone = async (users) => {
    const saltRounds = 10;
    return Promise.all(users.map(async (u) => {
        const hashedPassword = await bcrypt.hash(u.phone, saltRounds);
        return {
            ...u,
            hashedPassword
        };
    }));
};

exports.createAssessment = async (req, res) => {
    try {
        const { title, duration, users, selectedProblems } = req.body;

        const allowedRollNumbers = users.map((u) => u.username);

        // Hash all passwords before storing.
        const hashedUsers = await hashUsersWithPhone(users);

        const userOps = hashedUsers.map((u) => ({
            updateOne: {
                filter: { username: u.username },
                update: {
                    $set: {
                        username: u.username,
                        password: u.hashedPassword,
                        fullName: u.fullName,
                        email: u.email,
                        phone: u.phone,
                        role: 'participant'
                    }
                },
                upsert: true
            }
        }));

        await User.bulkWrite(userOps);

        const newAssessment = new Assessment({
            title,
            durationMinutes: duration,
            questions: selectedProblems,
            allowedUsers: allowedRollNumbers,
            status: 'waiting'
        });

        await newAssessment.save();

        res.json({ success: true, message: `Successfully mapped ${users.length} users.` });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, error: 'Internal Server Error' });
    }
};

exports.updateAssessment = async (req, res) => {
    try {
        const { id } = req.params;
        const { title, duration, users, selectedProblems } = req.body;

        if (!title || !Array.isArray(users) || !Array.isArray(selectedProblems)) {
            return res.status(400).json({
                success: false,
                error: 'Title, users, and selectedProblems are required.'
            });
        }

        const numericDuration = Number(duration);
        if (!Number.isFinite(numericDuration) || numericDuration <= 0) {
            return res.status(400).json({
                success: false,
                error: 'Duration must be a valid positive number.'
            });
        }

        const normalizedQuestionIds = Array.from(
            new Set(selectedProblems.map((value) => normalizeQuestionId(value)).filter(Boolean))
        );

        if (normalizedQuestionIds.length === 0) {
            return res.status(400).json({ success: false, error: 'At least one question must be selected.' });
        }

        const invalidQuestionId = normalizedQuestionIds.find((questionId) => !mongoose.Types.ObjectId.isValid(questionId));
        if (invalidQuestionId) {
            return res.status(400).json({ success: false, error: `Invalid question id: ${invalidQuestionId}` });
        }

        const dedupedUserMap = new Map();
        for (const rawUser of users) {
            const username = normalizeUsername(rawUser?.username);
            if (!username) {
                continue;
            }

            dedupedUserMap.set(username, {
                username,
                fullName: String(rawUser?.fullName || '').trim(),
                email: String(rawUser?.email || '').trim(),
                phone: String(rawUser?.phone || '').trim()
            });
        }

        const nextUsers = Array.from(dedupedUserMap.values());
        if (nextUsers.length === 0) {
            return res.status(400).json({ success: false, error: 'At least one user is required.' });
        }

        const assessment = await Assessment.findById(id);
        if (!assessment) {
            return res.status(404).json({ success: false, error: 'Assessment not found.' });
        }

        if (assessment.status === 'finished') {
            return res.status(403).json({ success: false, error: 'Finished assessments cannot be edited.' });
        }

        const existingAllowedUsers = (assessment.allowedUsers || []).map((value) => normalizeUsername(value)).filter(Boolean);
        const nextAllowedUsers = nextUsers.map((user) => user.username);

        const existingUsersSet = new Set(existingAllowedUsers);
        const nextUsersSet = new Set(nextAllowedUsers);

        const removedUsers = existingAllowedUsers.filter((username) => !nextUsersSet.has(username));
        const addedUsers = nextAllowedUsers.filter((username) => !existingUsersSet.has(username));

        const existingQuestionIds = (assessment.questions || []).map((questionId) => questionId.toString());
        const existingQuestionIdSet = new Set(existingQuestionIds);
        const nextQuestionIdSet = new Set(normalizedQuestionIds);

        const removedQuestionIds = existingQuestionIds.filter((questionId) => !nextQuestionIdSet.has(questionId));
        const addedQuestionIds = normalizedQuestionIds.filter((questionId) => !existingQuestionIdSet.has(questionId));

        const userDocs = await User.find({ username: { $in: nextAllowedUsers } }, 'username fullName email phone');
        const existingUserDocMap = new Map(userDocs.map((doc) => [doc.username, doc]));

        const missingPhoneForAddedUsers = addedUsers.filter((username) => {
            const incomingUser = dedupedUserMap.get(username);
            const existingUser = existingUserDocMap.get(username);
            return !incomingUser?.phone && !existingUser?.phone;
        });

        if (missingPhoneForAddedUsers.length > 0) {
            return res.status(400).json({
                success: false,
                error: `Phone is required for newly added users: ${missingPhoneForAddedUsers.join(', ')}`
            });
        }

        const usersWithPhoneToHash = nextUsers.filter((user) => Boolean(user.phone));
        const hashedUsers = await hashUsersWithPhone(usersWithPhoneToHash);
        const hashedByUsername = new Map(hashedUsers.map((user) => [user.username, user.hashedPassword]));

        const userOps = nextUsers.map((user) => {
            const existingUser = existingUserDocMap.get(user.username);

            const updateDoc = {
                username: user.username,
                fullName: user.fullName || existingUser?.fullName || user.username,
                email: user.email || existingUser?.email || '',
                role: 'participant'
            };

            if (user.phone) {
                updateDoc.phone = user.phone;
                updateDoc.password = hashedByUsername.get(user.username);
            }

            return {
                updateOne: {
                    filter: { username: user.username },
                    update: { $set: updateDoc },
                    upsert: true
                }
            };
        });

        if (userOps.length > 0) {
            await User.bulkWrite(userOps);
        }

        if (removedUsers.length > 0) {
            await Submission.deleteMany({
                username: { $in: removedUsers },
                questionId: { $in: assessment.questions }
            });
            await AssessmentProgress.deleteMany({ username: { $in: removedUsers } });
        }

        const nextQuestionObjectIds = toObjectIds(normalizedQuestionIds);

        await Assessment.findByIdAndUpdate(id, {
            $set: {
                title: String(title).trim(),
                durationMinutes: numericDuration,
                questions: nextQuestionObjectIds,
                allowedUsers: nextAllowedUsers
            }
        });

        if (assessment.status === 'active') {
            const removedQuestionObjectIds = removedQuestionIds.map((questionId) => new mongoose.Types.ObjectId(questionId));
            if (removedQuestionObjectIds.length > 0) {
                await Submission.deleteMany({
                    username: { $in: nextAllowedUsers },
                    questionId: { $in: removedQuestionObjectIds }
                });
            }

            const remainingProgressDocs = await AssessmentProgress.find({ username: { $in: nextAllowedUsers } });
            for (const progressDoc of remainingProgressDocs) {
                progressDoc.questions = (progressDoc.questions || []).filter((item) => (
                    nextQuestionIdSet.has(item.questionId.toString())
                ));

                for (const addedQuestionId of addedQuestionIds) {
                    const exists = progressDoc.questions.some((item) => item.questionId.toString() === addedQuestionId);
                    if (!exists) {
                        progressDoc.questions.push({
                            questionId: new mongoose.Types.ObjectId(addedQuestionId),
                            bestPassedCount: 0,
                            bestPoints: 0,
                            bestCode: '',
                            language: '',
                            lastImprovedAt: null
                        });
                    }
                }

                progressDoc.totalScore = recalculateTotalFromProgressQuestions(progressDoc.questions);
                await progressDoc.save();

                await User.updateOne(
                    { username: progressDoc.username },
                    {
                        $set: {
                            totalScore: progressDoc.totalScore,
                            lastSubmissionTime: new Date()
                        }
                    }
                );
            }

            if (addedUsers.length > 0) {
                const zeroedQuestions = buildProgressQuestions(nextQuestionObjectIds);
                const progressOps = addedUsers.map((username) => ({
                    updateOne: {
                        filter: { username },
                        update: {
                            $set: {
                                username,
                                totalScore: 0,
                                questions: zeroedQuestions
                            }
                        },
                        upsert: true
                    }
                }));

                await AssessmentProgress.bulkWrite(progressOps);

                await User.updateMany(
                    { username: { $in: addedUsers } },
                    { $set: { totalScore: 0, lastSubmissionTime: new Date() } }
                );
            }
        }

        const updatedAssessment = await Assessment.findById(id);
        return res.json({
            success: true,
            message: 'Assessment updated successfully.',
            data: updatedAssessment
        });
    } catch (err) {
        console.error('Error updating assessment:', err);
        return res.status(500).json({ success: false, error: 'Failed to update assessment.' });
    }
};

exports.getAllAssessments = async (req, res) => {
    try {
        const assessments = await Assessment.find().sort({ _id: -1 });
        res.json({ success: true, data: assessments });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, error: 'Failed to fetch assessments' });
    }
};

exports.getQuestionsByAssessmentId = async (req, res) => {
    try {
        const { id } = req.params;

        const assessment = await Assessment.findById(id)
            .populate('questions')
            .select('title questions');

        if (!assessment) {
            return res.status(404).json({ success: false, error: 'Assessment not found.' });
        }

        return res.json({
            success: true,
            data: {
                assessmentId: assessment._id,
                title: assessment.title,
                totalQuestions: assessment.questions.length,
                questions: assessment.questions
            }
        });
    } catch (err) {
        console.error('Error fetching assessment questions:', err);
        return res.status(500).json({ success: false, error: 'Failed to fetch assessment questions.' });
    }
};

exports.updateStatusOfAssessment = async (req, res) => {
    try {
        const { id } = req.params;
        const status = req.params.status || req.body.status;

        if (!status) {
            return res.status(400).json({ success: false, error: 'Status is required in params or body.' });
        }

        const allowedStatuses = ['waiting', 'countdown', 'active', 'finished'];
        if (!allowedStatuses.includes(status)) {
            return res.status(400).json({
                success: false,
                error: `Invalid status. Allowed values: ${allowedStatuses.join(', ')}`
            });
        }

        const assessment = await Assessment.findById(id).select('status allowedUsers questions');
        if (!assessment) {
            return res.status(404).json({ success: false, error: 'Assessment not found.' });
        }

        const currentStatus = assessment.status;
        const allowedTransitions = {
            waiting: ['countdown', 'active', 'finished'],
            countdown: ['active', 'finished'],
            active: ['finished'],
            finished: []
        };

        if (currentStatus === status) {
            return res.json({
                success: true,
                message: `Assessment already in '${status}' state.`,
                data: assessment
            });
        }

        if (!allowedTransitions[currentStatus]?.includes(status)) {
            return res.status(400).json({
                success: false,
                error: `Invalid status transition from '${currentStatus}' to '${status}'.`
            });
        }

        const updatePayload = { status };
        if (status === 'active' && currentStatus !== 'active') {
            updatePayload.startTime = new Date();
        }

        const updatedAssessment = await Assessment.findByIdAndUpdate(
            id,
            updatePayload,
            { new: true }
        );

        if (!updatedAssessment) {
            return res.status(404).json({ success: false, error: 'Assessment not found.' });
        }

        if (status === 'active') {
            const now = new Date();
            const zeroedQuestions = buildProgressQuestions(updatedAssessment.questions);

            const progressOps = updatedAssessment.allowedUsers.map((username) => ({
                updateOne: {
                    filter: { username },
                    update: {
                        $set: {
                            username,
                            totalScore: 0,
                            questions: zeroedQuestions
                        }
                    },
                    upsert: true
                }
            }));

            if (progressOps.length > 0) {
                await AssessmentProgress.bulkWrite(progressOps);
            }

            await User.updateMany(
                { username: { $in: updatedAssessment.allowedUsers } },
                { $set: { totalScore: 0, lastSubmissionTime: now } }
            );
        }

        res.json({
            success: true,
            message: `Assessment status updated to '${status}'.`,
            data: updatedAssessment
        });
    } catch (err) {
        console.error('Error updating assessment status:', err);
        res.status(500).json({ success: false, error: 'Failed to update assessment status.' });
    }
};

exports.deleteAssessment = async (req, res) => {
    try {
        const { id } = req.params;

        const assessment = await Assessment.findById(id);
        if (!assessment) {
            return res.status(404).json({ success: false, error: 'Assessment not found.' });
        }

        const allowedUsers = assessment.allowedUsers;

        const progressDeleted = await AssessmentProgress.deleteMany({
            username: { $in: allowedUsers }
        });

        const usersDeleted = await User.deleteMany({
            username: { $in: allowedUsers }
        });

        await Assessment.findByIdAndDelete(id);

        res.json({
            success: true,
            message: 'Assessment deleted successfully.',
            details: {
                usersDeleted: usersDeleted.deletedCount,
                progressDeleted: progressDeleted.deletedCount
            }
        });
    } catch (err) {
        console.error('Error deleting assessment:', err);
        res.status(500).json({ success: false, error: 'Failed to delete assessment.' });
    }
};

exports.getAssessmentById = async (req, res) => {
    try {
        const { id } = req.params;
        const assessment = await Assessment.findById(id).select('title durationMinutes startTime questions status allowedUsers');

        if (!assessment) {
            return res.status(404).json({ success: false, error: 'Assessment not found.' });
        }

        return res.json({
            success: true,
            serverNow: new Date().toISOString(),
            data: {
                id: assessment._id,
                title: assessment.title,
                durationMinutes: assessment.durationMinutes,
                startTime: assessment.startTime,
                totalQuestions: assessment.questions.length,
                status: assessment.status,
                questionIds: assessment.questions,
                allowedUsers: assessment.allowedUsers
            }
        });
    } catch (err) {
        console.error('Error fetching assessment by ID:', err);
        return res.status(500).json({ success: false, error: 'Failed to fetch assessment.' });
    }
};
