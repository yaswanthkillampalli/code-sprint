require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

// Import Routes
const authRoutes = require('./routes/authRoutes');
const questionRoutes = require('./routes/questionRoutes');
const assessmentRoutes = require('./routes/assessmentRoutes');
const submissionRoutes = require('./routes/submissionRoutes');
const leaderboardRoutes = require('./routes/leaderboardRoutes');

const app = express();

const frontendURL = process.env.FRONTEND_URL || 'http://localhost:3000';

const allowedOrigins = [
  'https://code-sprint-ochre.vercel.app',
  'https://code.yashdev.tech',
  'http://localhost:3000',
  frontendURL
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));

app.use(express.json());

// --- MONGODB CONNECTION ---
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('✅ MongoDB Connected'))
  .catch((err) => console.error('❌ MongoDB Connection Error:', err));

// --- ROUTE REGISTRATION ---
app.use('/api/auth', authRoutes);
app.use('/api/questions', questionRoutes);
app.use('/api/assessments', assessmentRoutes);
app.use('/api/submissions', submissionRoutes);
app.use('/api/leaderboard', leaderboardRoutes);
// --- HEALTH CHECK ---
app.get('/api/health', (req, res) => {
    res.json({ status: 'Online', message: '10x Devs API is ready' });
});

// --- GLOBAL ERROR HANDLER ---
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ success: false, error: 'Something went wrong on the server!' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
});
