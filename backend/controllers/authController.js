// authController.js
const User = require('../models/User');
const Assessment = require('../models/Assessment'); // add this
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');

exports.participantLogin = async (req, res) => {
  try {
    const { username, password } = req.body;

    const user = await User.findOne({ username });
    if (!user) {
      return res.status(401).json({ success: false, error: "Roll Number not registered." });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ success: false, error: "Invalid Passcode/Phone Number." });
    }

    const newSessionId = Math.random().toString(36).substring(2, 15);
    await User.updateOne({ _id: user._id }, { $set: { currentSessionId: newSessionId } });

    const token = jwt.sign(
      { id: user._id },
      process.env.JWT_SECRET || 'secret_key',
      { expiresIn: '1d' }
    );

    // latest assessment mapped to this participant
    const assessment = await Assessment.findOne({ allowedUsers: username })
      .sort({ _id: -1 })
      .select('_id title durationMinutes startTime status questions');

    const assessmentPayload = assessment
      ? {
          id: assessment._id,
          title: assessment.title,
          durationMinutes: assessment.durationMinutes,
          startTime: assessment.startTime,
          status: assessment.status,
          totalQuestions: Array.isArray(assessment.questions) ? assessment.questions.length : 0
        }
      : null;

    return res.json({
      success: true,
      token,
      user: {
        username: user.username,
        fullName: user.fullName,
        sessionId: newSessionId
      },
      assessment: assessmentPayload
    });
  } catch (err) {
    console.error("🔥 LOGIN ERROR DETAILS:", err);
    return res.status(500).json({ success: false, error: "Server error during login." });
  }
};
// --- ADMIN LOGIN ---
exports.adminLogin = async (req, res) => {
    const { adminId, password } = req.body;

    // Check against .env variables
    if (adminId === process.env.ADMIN_ID && password === process.env.ADMIN_PASSWORD) {
        const token = jwt.sign({ role: 'admin' }, process.env.JWT_SECRET || 'secret_key', { expiresIn: '1d' });
        
        return res.json({
            success: true,
            token,
            user: { role: 'admin', name: 'Super Admin' }
        });
    }

    res.status(401).json({ success: false, error: "Unauthorized Admin Credentials." });
};

// --- VERIFY TOKEN (ADMIN-ONLY RESPONSE) ---
exports.verifyUser = async (req, res) => {
    try {
        const authHeader = req.headers.authorization || '';
        const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;
        const token = bearerToken || req.body?.token || req.query?.token;

        if (!token) {
            return res.status(401).json({ success: false, error: 'Token missing.' });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret_key');

        // Only return payload for admin. For participants, return empty success response.
        if (decoded.role === 'admin') {
            return res.json({
                success: true,
                verified: true,
                isAdmin: true,
                user: { role: 'admin' }
            });
        }

        return res.status(204).send();
    } catch (err) {
        return res.status(401).json({ success: false, error: 'Invalid or expired token.' });
    }
};