import axios from 'axios';

const NEXT_PUBLIC_API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:5000/api';

const api = axios.create({
    baseURL: NEXT_PUBLIC_API_BASE_URL,
    headers: { 'Content-Type': 'application/json' }
});

// Interceptor to attach JWT token to every request for security
api.interceptors.request.use((config) => {
    // Only access localStorage in the browser to prevent Next.js SSR errors
    if (typeof window !== 'undefined') {
        const token = localStorage.getItem('token');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
    }
    return config;
});

// --- AUTHENTICATION ---

// Verify existing token
export const verifyToken = async () => {
    try {
        const response = await api.get('/auth/verify');
        return response.data;
    } catch (error) {
        return { success: false, verified: false };
    }
};

// For students (Roll No + Phone)
export const loginUser = async (username, password) => {
    const response = await api.post('/auth/login', { username, password });
    if (response.data.success && response.data.token) {
        localStorage.setItem('token', response.data.token);
    }
    return response.data;
};

// For Admin Dashboard (ID + Passcode)
export const loginAdmin = async (adminId, password) => {
    const response = await api.post('/auth/admin/login', { adminId, password });
    if (response.data.success && response.data.token) {
        localStorage.setItem('token', response.data.token);
    }
    return response.data;
};

// --- QUESTIONS ---

export const addQuestion = async (questionData) => {
    const response = await api.post('/questions/create', questionData);
    return response.data;
};


export const fetchAllQuestions = async () => {
    const response = await api.get('/questions/all');
    return response.data;
};

export const fetchAllQuestionsFull = async () => {
    const response = await api.get('/questions/all/full');
    return response.data;
};

// Change this function to accept the rollNo
export const fetchAllQuestionsOfUsername = async (username, assessmentId) => {
    const response = await api.get(
        `/questions/all/with-progress?username=${encodeURIComponent(username)}&assessmentId=${encodeURIComponent(assessmentId)}`
    );
    return response.data;
};

// Fetch specific question details for the IDE
export const fetchQuestionById = async (id) => {
    const response = await api.get(`/questions/${id}`);
    return response.data;
};

export const updateQuestion = async (id, questionData) => {
    const response = await api.put(`/questions/${id}`, questionData);
    return response.data;
};

export const removeQuestion = async (id) => {
    const response = await api.delete(`/questions/${id}`);
    return response.data;
};

// --- ASSESSMENTS & ADMIN TOOLS ---

export const createAssessment = async (payload) => {
    const response = await api.post('/assessments/create', payload);
    return response.data;
};

export const updateAssessment = async (id, payload) => {
    const response = await api.put(`/assessments/${id}`, payload);
    return response.data;
};

export const fetchLeaderboard = async () => {
    const response = await api.get('/leaderboard');
    return response.data;
};

// Add this to lib/api.js
export const fetchAssessments = async () => {
    const response = await api.get('/assessments/all');
    return response.data;
};


export const fetchAssessmentById = async (id) => {
    const response = await api.get(`/assessments/${id}`);
    return response.data;
};

export const fetchQuestionsByAssessmentId = async (id) => {
    const response = await api.get(`/assessments/${id}/questions`);
    return response.data;
};

// Add this to lib/api.js
export const startAssessment = async (id,status) => {
    const response = await api.put(`/assessments/${id}/status/${status}`);
    return response.data;
};

// Delete an assessment
export const deleteAssessment = async (id) => {
    const response = await api.delete(`/assessments/${id}`);
    return response.data;
};

// --- SUBMISSIONS (IDE ACTIONS) ---

export const submitUserCode = async (payload) => {
    // payload: { userId, questionId, language, userCode }
    const response = await api.post('/submissions/submit', payload);
    return response.data;
};

export default api;