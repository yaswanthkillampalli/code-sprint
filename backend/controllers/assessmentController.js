const Assessment = require('../models/Assessment');
const User = require('../models/User');
const Question = require('../models/Question');
const XLSX = require('xlsx');
const bcrypt = require('bcrypt');
const AssessmentProgress = require('../models/AssessmentProgress');

exports.createAssessment = async (req, res) => {
    try {
        const { title, duration, users, selectedProblems } = req.body;

        const allowedRollNumbers = users.map(u => u.username);

        // Hash all passwords before storing
        const saltRounds = 10;
        const hashedUsers = await Promise.all(users.map(async (u) => {
            const hashedPassword = await bcrypt.hash(u.phone, saltRounds);
            return {
                ...u,
                hashedPassword
            };
        }));

        const userOps = hashedUsers.map(u => ({
            updateOne: {
                filter: { username: u.username },
                update: { 
                    $set: { 
                        username: u.username,
                        password: u.hashedPassword, // Hashed phone as password
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

        // 3. Create the Assessment record
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
        res.status(500).json({ success: false, error: "Internal Server Error" });
    }
};

// Add this to controllers/assessmentController.js
exports.getAllAssessments = async (req, res) => {
    try {
        // Fetch all assessments, newest first
        const assessments = await Assessment.find().sort({ _id: -1 });
        res.json({ success: true, data: assessments });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, error: "Failed to fetch assessments" });
    }
};

// Fetch the latest assessment for the student waiting room
exports.getCurrentAssessment = async (req, res) => {
    try {
        // Grab the most recently created assessment
        const assessment = await Assessment.findOne().sort({ _id: -1 });
        
        if (!assessment) {
            return res.json({ success: false, error: "No active assessments found." });
        }

        res.json({
            success: true,
            data: {
                id: assessment._id,
                title: assessment.title,
                durationMinutes: assessment.durationMinutes,
                startTime: assessment.startTime,
                totalQuestions: assessment.questions.length,
                status: assessment.status // 'waiting' or 'active'
            }
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, error: "Failed to fetch status." });
    }
};

// Fetch all questions for a specific assessment by assessment ID
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



// Update assessment status
exports.updateStatusOfAssessment = async (req, res) => {
    try {
        const { id } = req.params;
        const status = req.params.status || req.body.status;

        if (!status) {
            return res.status(400).json({ success: false, error: "Status is required in params or body." });
        }

        const allowedStatuses = ['waiting', 'countdown', 'active', 'finished'];
        if (!allowedStatuses.includes(status)) {
            return res.status(400).json({
                success: false,
                error: `Invalid status. Allowed values: ${allowedStatuses.join(', ')}`
            });
        }

        const updatePayload = { status };
        if (status === 'active') {
            updatePayload.startTime = new Date();
        }
        
        // Update status and set startTime when assessment becomes active
        const updatedAssessment = await Assessment.findByIdAndUpdate(
            id,
            updatePayload,
            { new: true } // Return the updated document
        );

        if (!updatedAssessment) {
            return res.status(404).json({ success: false, error: "Assessment not found." });
        }

        // Initialize zeroed assessment progress for every allowed user when assessment starts.
        if (status === 'active') {
            const now = new Date();
            const zeroedQuestions = updatedAssessment.questions.map((questionId) => ({
                questionId,
                bestPassedCount: 0,
                bestPoints: 0,
                bestCode: "",
                language: "",
                lastImprovedAt: null
            }));

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
        console.error("Error updating assessment status:", err);
        res.status(500).json({ success: false, error: "Failed to update assessment status." });
    }
};

// Delete assessment and all related users and submissions
exports.deleteAssessment = async (req, res) => {
    try {
        const { id } = req.params;

        // 1. Find the assessment first
        const assessment = await Assessment.findById(id);
        if (!assessment) {
            return res.status(404).json({ success: false, error: "Assessment not found." });
        }

        const allowedUsers = assessment.allowedUsers;

        // 2. Delete all assessment progress for those users
        const progressDeleted = await AssessmentProgress.deleteMany({ 
            username: { $in: allowedUsers } 
        });

        // 3. Delete all users in the assessment
        const usersDeleted = await User.deleteMany({ 
            username: { $in: allowedUsers } 
        });

        // 4. Delete the assessment itself
        await Assessment.findByIdAndDelete(id);

        res.json({ 
            success: true, 
            message: "Assessment deleted successfully.",
            details: {
                usersDeleted: usersDeleted.deletedCount,
                progressDeleted: progressDeleted.deletedCount
            }
        });

    } catch (err) {
        console.error("Error deleting assessment:", err);
        res.status(500).json({ success: false, error: "Failed to delete assessment." });
    }
};

// Fetch a specific assessment by ID for participant flows.
exports.getAssessmentById = async (req, res) => {
    try {
        const { id } = req.params;
        const assessment = await Assessment.findById(id).select('title durationMinutes startTime questions status');

        if (!assessment) {
            return res.status(404).json({ success: false, error: 'Assessment not found.' });
        }

        return res.json({
            success: true,
            data: {
                id: assessment._id,
                title: assessment.title,
                durationMinutes: assessment.durationMinutes,
                startTime: assessment.startTime,
                totalQuestions: assessment.questions.length,
                status: assessment.status
            }
        });
    } catch (err) {
        console.error('Error fetching assessment by ID:', err);
        return res.status(500).json({ success: false, error: 'Failed to fetch assessment.' });
    }
};