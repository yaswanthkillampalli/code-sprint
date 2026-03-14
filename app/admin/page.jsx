"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Editor from "@monaco-editor/react";
import * as XLSX from 'xlsx';
import {
  loginAdmin,
  fetchAllQuestions,
  fetchAllQuestionsFull,
  addQuestion,
  updateQuestion,
  removeQuestion,
  createAssessment,
  updateAssessment,
  fetchLeaderboard,
  fetchAssessments,
  startAssessment,
  deleteAssessment,
  verifyToken
} from "../../lib/api";

const createEmptyQuestionForm = () => ({
  title: "",
  difficulty: "Medium",
  points: 10,
  task: "",
  description: "",
  constraints: "",
  inputFormat: "",
  outputFormat: "",
  examplesText: "[]",
  hiddenTestCasesText: "[]",
  templates: {
    cpp: { visibleCode: "", hiddenDriver: "" },
    python: { visibleCode: "", hiddenDriver: "" },
    java: { visibleCode: "", hiddenDriver: "" }
  }
});

const toJsonEditor = (value) => JSON.stringify(value || [], null, 2);

const toQuestionForm = (question) => ({
  title: question.title || "",
  difficulty: question.difficulty || "Medium",
  points: question.points ?? 10,
  task: question.task || "",
  description: question.description || "",
  constraints: question.constraints || "",
  inputFormat: question.inputFormat || "",
  outputFormat: question.outputFormat || "",
  examplesText: toJsonEditor(question.examples),
  hiddenTestCasesText: toJsonEditor(question.hiddenTestCases),
  templates: {
    cpp: {
      visibleCode: question.templates?.cpp?.visibleCode || "",
      hiddenDriver: question.templates?.cpp?.hiddenDriver || ""
    },
    python: {
      visibleCode: question.templates?.python?.visibleCode || "",
      hiddenDriver: question.templates?.python?.hiddenDriver || ""
    },
    java: {
      visibleCode: question.templates?.java?.visibleCode || "",
      hiddenDriver: question.templates?.java?.hiddenDriver || ""
    }
  }
});

const editorLanguageMap = {
  cpp: "cpp",
  python: "python",
  java: "java"
};

const normalizeColumnName = (name) => String(name || "").toLowerCase().replace(/[\s_-]/g, "");

const getColumnByAlias = (row, aliases) => {
  const keys = Object.keys(row || {});
  const normalizedAliases = aliases.map(normalizeColumnName);

  for (const key of keys) {
    if (normalizedAliases.includes(normalizeColumnName(key))) {
      const value = row[key];
      return value == null ? "" : String(value).trim();
    }
  }

  return "";
};

const upsertStagedUsers = (existingUsers, incomingUsers) => {
  const mergedByUsername = new Map(
    (existingUsers || []).map((user) => [String(user.username || "").trim(), user])
  );

  for (const incoming of incomingUsers || []) {
    const username = String(incoming.username || "").trim();
    if (!username) continue;

    const previous = mergedByUsername.get(username) || {
      username,
      fullName: "",
      email: "",
      phone: ""
    };

    mergedByUsername.set(username, {
      ...previous,
      username,
      fullName: String(incoming.fullName || "").trim() || previous.fullName || "",
      email: String(incoming.email || "").trim() || previous.email || "",
      phone: String(incoming.phone || "").trim() || previous.phone || ""
    });
  }

  return Array.from(mergedByUsername.values());
};

export default function AdminDashboard() {
  // --- AUTHENTICATION STATE ---
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isVerifyingToken, setIsVerifyingToken] = useState(true);
  const [adminId, setAdminId] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState("");

  // --- DASHBOARD STATE ---
  const [activeTab, setActiveTab] = useState("assessments");
  const [isCreating, setIsCreating] = useState(false);
  const [problemPool, setProblemPool] = useState([]);
  const [leaderboard, setLeaderboard] = useState([]);
  const [isLeaderboardLoading, setIsLeaderboardLoading] = useState(false);
  const [assessmentsList, setAssessmentsList] = useState([]);
  const [questionBank, setQuestionBank] = useState([]);
  const [selectedQuestionId, setSelectedQuestionId] = useState(null);
  const [questionForm, setQuestionForm] = useState(createEmptyQuestionForm());
  const [questionError, setQuestionError] = useState("");
  const [isSavingQuestion, setIsSavingQuestion] = useState(false);
  const [editingAssessment, setEditingAssessment] = useState(null);

  // --- USER MANAGEMENT STATE ---
  const [stagedUsers, setStagedUsers] = useState([]);
  const [manualUser, setManualUser] = useState({ roll: "", name: "", email: "", phone: "" });

  // Form State for New Assessment
  const [newAssessment, setNewAssessment] = useState({
    title: "",
    duration: 120,
    selectedProblems: [],
  });

  const resetAssessmentForm = () => {
    setEditingAssessment(null);
    setStagedUsers([]);
    setNewAssessment({ title: "", duration: 120, selectedProblems: [] });
  };

  const loadQuestionData = async () => {
    const [poolRes, fullRes] = await Promise.all([
      fetchAllQuestions(),
      fetchAllQuestionsFull()
    ]);

    setProblemPool(poolRes?.data || []);
    setQuestionBank(fullRes?.data || []);
  };

  const loadLeaderboard = async () => {
    setIsLeaderboardLoading(true);

    try {
      const res = await fetchLeaderboard();
      setLeaderboard(res?.data || []);
    } finally {
      setIsLeaderboardLoading(false);
    }
  };

  // --- AUTO-LOGIN: VERIFY TOKEN ON MOUNT ---
  useEffect(() => {
    const checkAuth = async () => {
      // Only check in browser environment
      if (typeof window !== 'undefined') {
        const token = localStorage.getItem('token');
        
        if (token) {
          // Token exists, verify it
          const result = await verifyToken();
          
          if (result.success && result.verified && result.isAdmin) {
            // Token is valid and user is admin
            setIsAuthenticated(true);
          } else {
            // Token is invalid or user is not admin, clear it
            localStorage.removeItem('token');
          }
        }
      }
      
      setIsVerifyingToken(false);
    };

    checkAuth();
  }, []);

  // --- DATA FETCHING ---
  useEffect(() => {
    if (!isAuthenticated) return;

    // Fetch all required data for the dashboard
    loadQuestionData();
    loadLeaderboard();
    fetchAssessments().then((res) => setAssessmentsList(res?.data || []));
  }, [isAuthenticated]);

  // --- HANDLERS ---
  const handleAdminLogin = async (e) => {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError("");

    const res = await loginAdmin(adminId, adminPassword);

    if (res.success) {
      setIsAuthenticated(true);
    } else {
      setAuthError(res.error || "Login failed");
    }
    setAuthLoading(false);
  };

  const toggleProblem = (id) => {
    const normalizedId = String(id);
    setNewAssessment(prev => ({
      ...prev,
      selectedProblems: prev.selectedProblems.includes(normalizedId)
        ? prev.selectedProblems.filter(pId => pId !== normalizedId)
        : [...prev.selectedProblems, normalizedId]
    }));
  };

  const handleEditAssessment = (assessment) => {
    if (assessment.status === "finished") {
      alert("Finished assessments cannot be edited.");
      return;
    }

    const selectedProblems = (assessment.questions || []).map((questionId) => String(questionId));
    const hydratedUsers = (assessment.allowedUsers || []).map((username) => ({
      username: String(username),
      fullName: "",
      email: "",
      phone: ""
    }));

    setEditingAssessment(assessment);
    setNewAssessment({
      title: assessment.title || "",
      duration: assessment.durationMinutes ?? 120,
      selectedProblems,
    });
    setStagedUsers(hydratedUsers);
    setIsCreating(true);
  };

  const handleNewQuestion = () => {
    setSelectedQuestionId(null);
    setQuestionForm(createEmptyQuestionForm());
    setQuestionError("");
  };

  const handleSelectQuestion = (question) => {
    setSelectedQuestionId(question._id);
    setQuestionForm(toQuestionForm(question));
    setQuestionError("");
  };

  const handleQuestionFieldChange = (field, value) => {
    setQuestionForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleTemplateFieldChange = (language, field, value) => {
    setQuestionForm((prev) => ({
      ...prev,
      templates: {
        ...prev.templates,
        [language]: {
          ...prev.templates[language],
          [field]: value
        }
      }
    }));
  };

  const buildQuestionPayload = () => {
    let examples;
    let hiddenTestCases;

    try {
      examples = JSON.parse(questionForm.examplesText || "[]");
      hiddenTestCases = JSON.parse(questionForm.hiddenTestCasesText || "[]");
    } catch {
      throw new Error("Examples and hidden test cases must be valid JSON arrays.");
    }

    if (!Array.isArray(examples) || !Array.isArray(hiddenTestCases)) {
      throw new Error("Examples and hidden test cases must be JSON arrays.");
    }

    return {
      title: questionForm.title.trim(),
      difficulty: questionForm.difficulty,
      points: Number(questionForm.points),
      task: questionForm.task,
      description: questionForm.description,
      constraints: questionForm.constraints,
      inputFormat: questionForm.inputFormat,
      outputFormat: questionForm.outputFormat,
      examples,
      hiddenTestCases,
      templates: questionForm.templates
    };
  };

  const handleSaveQuestion = async () => {
    setQuestionError("");
    setIsSavingQuestion(true);

    try {
      const payload = buildQuestionPayload();

      if (!payload.title || !payload.task) {
        throw new Error("Title and task are required.");
      }

      const res = selectedQuestionId
        ? await updateQuestion(selectedQuestionId, payload)
        : await addQuestion(payload);

      if (!res?.success) {
        throw new Error(res?.error || "Failed to save question.");
      }

      await loadQuestionData();

      const savedQuestionId = selectedQuestionId || res.questionId;
      if (savedQuestionId) {
        const fullRes = await fetchAllQuestionsFull();
        const savedQuestion = (fullRes?.data || []).find((question) => question._id === savedQuestionId);
        setQuestionBank(fullRes?.data || []);
        if (savedQuestion) {
          setSelectedQuestionId(savedQuestion._id);
          setQuestionForm(toQuestionForm(savedQuestion));
        }
      }

      alert(selectedQuestionId ? "Question updated successfully!" : "Question created successfully!");
    } catch (err) {
      setQuestionError(err.message || "Failed to save question.");
    } finally {
      setIsSavingQuestion(false);
    }
  };

  const handleDeleteQuestion = async () => {
    if (!selectedQuestionId) return;

    if (!window.confirm("Are you sure you want to delete this question? This action cannot be undone.")) {
      return;
    }

    const res = await removeQuestion(selectedQuestionId);
    if (res?.success) {
      await loadQuestionData();
      handleNewQuestion();
      alert("Question deleted successfully!");
    } else {
      setQuestionError(res?.error || "Failed to delete question.");
    }
  };

  // HANDLE EXCEL TO JSON
  const handleExcelUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const bstr = evt.target.result;
      const wb = XLSX.read(bstr, { type: 'binary' });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      const data = XLSX.utils.sheet_to_json(ws);
      
      const formatted = data
        .map((row) => ({
          username: getColumnByAlias(row, ['Roll Number', 'roll', 'rollnumber', 'roll no', 'roll_no', 'username']),
          fullName: getColumnByAlias(row, ['Full Name', 'fullname', 'name']),
          email: getColumnByAlias(row, ['Email', 'email']),
          phone: getColumnByAlias(row, ['Phone', 'phone', 'Phone Number', 'phonenumber', 'mobile'])
        }))
        .filter((u) => u.username && u.phone);

      setStagedUsers((prev) => upsertStagedUsers(prev, formatted));
    };
    reader.readAsBinaryString(file);
    e.target.value = null; // Reset input so same file can be uploaded again if needed
  };

  // HANDLE MANUAL ADDITION
  const addManualUser = () => {
    const roll = String(manualUser.roll || "").trim();
    const phone = String(manualUser.phone || "").trim();
    const fullName = String(manualUser.name || "").trim();
    const email = String(manualUser.email || "").trim();

    if(!roll || !phone) return alert("Roll and Phone are required");
    
    setStagedUsers((prev) => upsertStagedUsers(prev, [{
        username: roll,
        fullName,
        email,
        phone
    }]));
    setManualUser({ roll: "", name: "", email: "", phone: "" });
  };

  // FINAL SUBMIT (JSON Payload)
  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    if (!newAssessment.title) return alert("Please provide an assessment title.");
    if (newAssessment.selectedProblems.length === 0) return alert("Please select at least one problem.");
    if (stagedUsers.length === 0) return alert("Please add at least one user.");

    const payload = {
      title: newAssessment.title,
      duration: newAssessment.duration,
      selectedProblems: newAssessment.selectedProblems.map((problemId) => String(problemId)),
      users: stagedUsers
    };

    const res = editingAssessment?._id
      ? await updateAssessment(editingAssessment._id, payload)
      : await createAssessment(payload);

    if (res?.success) {
      alert(editingAssessment ? "Assessment updated successfully!" : "Assessment Live and Users Mapped!");
      setIsCreating(false);
      resetAssessmentForm();
      // Refresh assessments list
      fetchAssessments().then((data) => setAssessmentsList(data?.data || []));
    } else {
      alert(res?.error || "Failed to save assessment");
    }
  };

  const handleStartExam = async (assessmentId) => {
    // Safety confirmation so you don't accidentally double-click
    if (!window.confirm("Are you sure you want to start this exam? Students will be able to enter immediately.")) {
      return;
    }

    const res = await startAssessment(assessmentId, 'active');
    if (res?.success) {
      alert("Exam is now LIVE!");
      // Refresh the assessments list so the UI updates from "waiting" to "active"
      fetchAssessments().then((data) => setAssessmentsList(data?.data || []));
    } else {
      alert("Failed to start exam: " + res.error);
    }
  };

  const handleEndExam = async (assessmentId) => {
    // Safety confirmation so you don't accidentally end the exam early
    if (!window.confirm("Are you sure you want to END this exam? Students will no longer be able to submit.")) {
      return;
    }

    const res = await startAssessment(assessmentId, 'finished');
    if (res?.success) {
      alert("Exam has ended!");
      // Refresh the assessments list so the UI updates from "active" to "finished"
      fetchAssessments().then((data) => setAssessmentsList(data?.data || []));
    } else {
      alert("Failed to end exam: " + res.error);
    }
  };

  const handleDeleteAssessment = async (assessmentId) => {
    // Safety confirmation for deletion
    if (!window.confirm("Are you sure you want to DELETE this assessment? This action cannot be undone.")) {
      return;
    }

    const res = await deleteAssessment(assessmentId);
    if (res?.success) {
      alert("Assessment deleted successfully!");
      // Refresh the assessments list
      fetchAssessments().then((data) => setAssessmentsList(data?.data || []));
    } else {
      alert("Failed to delete assessment: " + res.error);
    }
  };

  // ==========================================
  // RENDER: LOADING (TOKEN VERIFICATION)
  // ==========================================
  if (isVerifyingToken) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900 text-white">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-red-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-400">Verifying credentials...</p>
        </div>
      </div>
    );
  }

  // ==========================================
  // RENDER: LOGIN VIEW
  // ==========================================
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900 text-white">
        <div className="max-w-md w-full p-8 bg-slate-800 rounded-xl shadow-2xl border border-slate-700">
          <div className="text-center mb-8">
            <div className="w-12 h-12 bg-red-600 rounded-lg mx-auto flex items-center justify-center mb-4 shadow-lg shadow-red-600/20">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path></svg>
            </div>
            <h1 className="text-2xl font-bold">Admin Restricted Area</h1>
            <p className="text-sm text-slate-400 mt-2">Authorized personnel only</p>
          </div>

          <form onSubmit={handleAdminLogin} className="space-y-6">
            <div>
              <label className="block text-sm font-medium mb-2 text-slate-300">Admin ID</label>
              <input type="text" required value={adminId} onChange={(e) => setAdminId(e.target.value)} className="w-full px-4 py-3 bg-slate-900 border border-slate-600 rounded-lg focus:ring-2 focus:ring-red-500 outline-none transition-all" placeholder="Enter ID" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2 text-slate-300">Passcode</label>
              <input type="password" required value={adminPassword} onChange={(e) => setAdminPassword(e.target.value)} className="w-full px-4 py-3 bg-slate-900 border border-slate-600 rounded-lg focus:ring-2 focus:ring-red-500 outline-none transition-all" placeholder="........" />
            </div>

            {authError && <div className="text-red-400 text-sm text-center bg-red-900/30 p-3 rounded border border-red-900/50">{authError}</div>}

            <button type="submit" disabled={authLoading} className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3 rounded-lg transition-colors disabled:opacity-50 flex justify-center items-center shadow-lg shadow-red-600/20">
              {authLoading ? "Verifying..." : "Access Control Panel"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // ==========================================
  // RENDER: DASHBOARD VIEW
  // ==========================================
  return (
    <div className="min-h-screen flex bg-slate-50 dark:bg-zinc-950 text-slate-900 dark:text-slate-100">
      
      {/* SIDEBAR */}
      <aside className="w-64 border-r flex flex-col bg-white dark:bg-zinc-900" style={{ borderColor: 'var(--card-border)' }}>
        <div className="h-16 flex items-center px-6 border-b" style={{ borderColor: 'var(--card-border)' }}>
          <div className="flex items-center gap-3">
            <div className="relative w-8 h-8 rounded overflow-hidden">
              <Image src="/diet-logo.png" alt="Logo" fill className="object-cover" sizes="32px" />
            </div>
            <span className="font-bold tracking-tight">Admin Portal</span>
          </div>
        </div>
        
        <nav className="flex-1 p-4 space-y-2">
          <button 
            onClick={() => { setActiveTab("assessments"); setIsCreating(false); resetAssessmentForm(); }}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-semibold transition-colors ${activeTab === 'assessments' ? 'bg-blue-600 text-white' : 'hover:bg-slate-100 dark:hover:bg-zinc-800 opacity-70'}`}
          >
            Assessments
          </button>
          <button 
            onClick={() => { setActiveTab("leaderboard"); setIsCreating(false); resetAssessmentForm(); }}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-semibold transition-colors ${activeTab === 'leaderboard' ? 'bg-blue-600 text-white' : 'hover:bg-slate-100 dark:hover:bg-zinc-800 opacity-70'}`}
          >
            Live Leaderboard
          </button>
          <button 
            onClick={() => { setActiveTab("questions"); setIsCreating(false); resetAssessmentForm(); }}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-semibold transition-colors ${activeTab === 'questions' ? 'bg-blue-600 text-white' : 'hover:bg-slate-100 dark:hover:bg-zinc-800 opacity-70'}`}
          >
            Questions
          </button>
        </nav>

        <div className="p-4 border-t" style={{ borderColor: 'var(--card-border)' }}>
          <button
            onClick={() => {
              setIsAuthenticated(false);
              localStorage.removeItem('token');
            }}
            className="w-full text-sm font-bold text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 py-2 rounded-lg transition-colors"
          >
            Lock Session
          </button>
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        
        {/* Topbar */}
        <header className="h-16 border-b flex items-center justify-between px-8 bg-white dark:bg-zinc-900" style={{ borderColor: 'var(--card-border)' }}>
          <h1 className="text-xl font-bold capitalize">{activeTab.replace('-', ' ')}</h1>
          <div className="flex items-center gap-4">
            <span className="text-sm font-medium px-3 py-1 bg-green-100 text-green-700 rounded-full">System Status: Online</span>
          </div>
        </header>

        {/* Dynamic Content */}
        <div className="flex-1 overflow-y-auto p-8">
          
          {/* ========================================== */}
          {/* VIEW: MANAGE ASSESSMENTS (LIST)            */}
          {/* ========================================== */}
          {activeTab === "assessments" && !isCreating && (
            <div>
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-lg font-semibold">Manage Assessments</h2>
                <button 
                  onClick={() => { resetAssessmentForm(); setIsCreating(true); }}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors shadow-md"
                >
                  + Create New Assessment
                </button>
              </div>

              {/* REAL ASSESSMENTS LIST */}
              <div className="space-y-4">
                {assessmentsList.length === 0 ? (
                  <div className="p-12 text-center border-2 border-dashed rounded-xl opacity-50 border-slate-300 dark:border-zinc-700">
                    <svg className="mx-auto h-12 w-12 mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
                    <p className="font-semibold text-lg">No assessments created yet.</p>
                    <p className="text-sm">Click the button above to launch your first round.</p>
                  </div>
                ) : (
                  assessmentsList.map((assessment) => (
                    <div key={assessment._id} className="p-6 rounded-xl border bg-white dark:bg-zinc-900 shadow-sm" style={{ borderColor: 'var(--card-border)' }}>
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <h3 className="text-xl font-bold">{assessment.title}</h3>
                          <p className="text-sm opacity-60 mt-1">
                            Status: <span className={`font-bold ml-1 ${assessment.status === 'active' ? 'text-green-500' : assessment.status === 'finished' ? 'text-gray-500' : 'text-yellow-500'}`}>
                              {assessment.status.toUpperCase()}
                            </span>
                          </p>
                        </div>
                        
                        <div className="flex gap-3">
                          {assessment.status === 'waiting' && (
                            <>
                              <button
                                onClick={() => handleEditAssessment(assessment)}
                                className="bg-amber-600 hover:bg-amber-700 text-white px-6 py-2 rounded-lg font-bold shadow-md transition-colors">
                                EDIT
                              </button>
                              <button 
                                onClick={() => handleStartExam(assessment._id)}
                                className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg font-bold shadow-md transition-colors">
                                START
                              </button>
                              <button 
                                onClick={() => handleDeleteAssessment(assessment._id)}
                                className="bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded-lg font-bold shadow-md transition-colors">
                                DELETE
                              </button>
                            </>
                          )}
                          {assessment.status === 'active' && (
                            <>
                              <button
                                onClick={() => handleEditAssessment(assessment)}
                                className="bg-amber-600 hover:bg-amber-700 text-white px-6 py-2 rounded-lg font-bold shadow-md transition-colors">
                                EDIT
                              </button>
                              <button
                                onClick={() => handleEndExam(assessment._id)}
                                className="bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded-lg font-bold shadow-md transition-colors">
                                END
                              </button>
                            </>
                          )}
                          {assessment.status === 'finished' && (
                            <button 
                              onClick={() => handleDeleteAssessment(assessment._id)}
                              className="bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded-lg font-bold shadow-md transition-colors">
                              DELETE
                            </button>
                          )}
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-3 gap-4 mt-6 pt-6 border-t" style={{ borderColor: 'var(--card-border)' }}>
                        <div><span className="opacity-60 text-sm block">Mapped Users</span><span className="font-bold text-lg">{assessment.allowedUsers?.length || 0}</span></div>
                        <div><span className="opacity-60 text-sm block">Problems</span><span className="font-bold text-lg">{assessment.questions?.length || 0}</span></div>
                        <div><span className="opacity-60 text-sm block">Duration</span><span className="font-bold text-lg">{assessment.durationMinutes} Mins</span></div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* ========================================== */}
          {/* VIEW: CREATE NEW ASSESSMENT FORM           */}
          {/* ========================================== */}
          {activeTab === "assessments" && isCreating && (
            <div className="max-w-4xl mx-auto pb-12">
              <button onClick={() => { setIsCreating(false); resetAssessmentForm(); }} className="text-sm text-blue-600 font-semibold mb-6 flex items-center gap-2 hover:underline">
                ← Back to Assessments
              </button>
              
              <div className="bg-white dark:bg-zinc-900 p-8 rounded-xl border shadow-sm" style={{ borderColor: 'var(--card-border)' }}>
                <h2 className="text-2xl font-bold mb-3">{editingAssessment ? 'Edit Assessment' : 'Create New Assessment'}</h2>
                <p className="text-sm opacity-70 mb-8">
                  {editingAssessment
                    ? `Editing ${editingAssessment.status.toUpperCase()} assessment.`
                    : 'Create and map users before launching.'}
                </p>

                {editingAssessment?.status === 'active' && (
                  <div className="mb-8 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-900/40 dark:bg-amber-900/10 dark:text-amber-300">
                    Active edit warning: removing users blocks them immediately, and removing questions deletes related submissions and scores.
                  </div>
                )}
                
                {/* 1. Basic Details */}
                <div className="grid grid-cols-2 gap-6 mb-8">
                  <div>
                    <label className="block text-sm font-bold mb-2 opacity-80">Assessment Title</label>
                    <input type="text" placeholder="e.g., Code Sprint - Round 1" value={newAssessment.title} onChange={e => setNewAssessment({...newAssessment, title: e.target.value})} className="w-full p-3 border rounded-lg bg-slate-50 dark:bg-zinc-800/50 outline-none focus:ring-2 focus:ring-blue-500" style={{ borderColor: 'var(--card-border)' }} />
                  </div>
                  <div>
                    <label className="block text-sm font-bold mb-2 opacity-80">Duration (Minutes)</label>
                    <input type="number" placeholder="120" value={newAssessment.duration} onChange={e => setNewAssessment({...newAssessment, duration: e.target.value})} className="w-full p-3 border rounded-lg bg-slate-50 dark:bg-zinc-800/50 outline-none focus:ring-2 focus:ring-blue-500" style={{ borderColor: 'var(--card-border)' }} />
                  </div>
                </div>

                {/* 2. Problem Selection */}
                <div className="mb-8">
                  <label className="block text-sm font-bold mb-3 opacity-80">Select Problems ({newAssessment.selectedProblems.length} selected)</label>
                  <div className="border rounded-lg p-2 max-h-48 overflow-y-auto bg-slate-50 dark:bg-zinc-800/20" style={{ borderColor: 'var(--card-border)' }}>
                    {problemPool.map((prob) => {
                      const problemId = String(prob.id || prob._id);
                      const difficulty = prob.difficulty || "Medium";
                      return (
                        <label key={problemId} className="flex items-center justify-between p-3 hover:bg-white dark:hover:bg-zinc-800 rounded-md cursor-pointer transition-colors border border-transparent hover:border-slate-200 dark:hover:border-zinc-700">
                          <div className="flex items-center gap-3">
                            <input type="checkbox" checked={newAssessment.selectedProblems.includes(problemId)} onChange={() => toggleProblem(problemId)} className="w-4 h-4 text-blue-600 rounded" />
                            <span className="font-medium">{prob.title}</span>
                          </div>
                          <span className={`text-[10px] uppercase tracking-wider font-bold px-2 py-1 rounded ${difficulty === 'Easy' ? 'bg-green-100 text-green-700' : difficulty === 'Medium' ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>
                            {difficulty}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                <hr className="my-8 border-slate-200 dark:border-zinc-800" />

                {/* 3. User Mapping (Hybrid) */}
                <h3 className="text-xl font-bold mb-6">Authorize Participants</h3>
                
                <div className="grid grid-cols-2 gap-8 mb-8">
                  {/* Left: Excel */}
                  <div className="p-6 border-2 border-dashed rounded-xl text-center bg-slate-50 dark:bg-zinc-800/20" style={{ borderColor: 'var(--card-border)' }}>
                    <svg className="mx-auto h-10 w-10 opacity-40 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"></path></svg>
                    <p className="font-bold mb-1">Upload Excel File</p>
                    <p className="text-xs opacity-60 mb-4">Requires columns: Roll Number, Name, Email, Phone</p>
                    <input type="file" accept=".xlsx, .csv" onChange={handleExcelUpload} className="text-sm file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-100 file:text-blue-700 hover:file:bg-blue-200" />
                  </div>

                  {/* Right: Manual */}
                  <div className="p-6 border rounded-xl bg-slate-50 dark:bg-zinc-800/20" style={{ borderColor: 'var(--card-border)' }}>
                    <p className="font-bold mb-4">Add Single Participant</p>
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <input type="text" placeholder="Roll Number *" value={manualUser.roll} onChange={e => setManualUser({...manualUser, roll: e.target.value})} className="w-full p-2 text-sm border rounded bg-white dark:bg-zinc-900 outline-none" style={{ borderColor: 'var(--card-border)' }} />
                        <input type="text" placeholder="Phone (Passcode) *" value={manualUser.phone} onChange={e => setManualUser({...manualUser, phone: e.target.value})} className="w-full p-2 text-sm border rounded bg-white dark:bg-zinc-900 outline-none" style={{ borderColor: 'var(--card-border)' }} />
                      </div>
                      <input type="text" placeholder="Full Name" value={manualUser.name} onChange={e => setManualUser({...manualUser, name: e.target.value})} className="w-full p-2 text-sm border rounded bg-white dark:bg-zinc-900 outline-none" style={{ borderColor: 'var(--card-border)' }} />
                      <button onClick={addManualUser} className="w-full bg-slate-800 hover:bg-slate-700 text-white py-2 rounded-lg text-sm font-bold transition-colors">
                        Add to Mapped List
                      </button>
                    </div>
                  </div>
                </div>

                {/* Staged Users Preview */}
                <div className="border rounded-xl overflow-hidden" style={{ borderColor: 'var(--card-border)' }}>
                  <div className="bg-slate-100 dark:bg-zinc-800 p-3 text-xs font-bold flex justify-between items-center border-b" style={{ borderColor: 'var(--card-border)' }}>
                    <span>MAPPED USERS READY FOR EXAM ({stagedUsers.length})</span>
                    {stagedUsers.length > 0 && (
                      <button onClick={() => setStagedUsers([])} className="text-red-500 hover:underline">Clear All</button>
                    )}
                  </div>
                  <div className="max-h-48 overflow-y-auto bg-white dark:bg-zinc-900">
                    {stagedUsers.length === 0 ? (
                      <div className="p-4 text-center text-sm opacity-50 font-medium">No users mapped yet.</div>
                    ) : (
                      stagedUsers.map((u, i) => (
                        <div key={i} className="p-3 border-b last:border-0 text-sm flex justify-between items-center hover:bg-slate-50 dark:hover:bg-zinc-800" style={{ borderColor: 'var(--card-border)' }}>
                          <span className="font-mono">{u.username} <span className="font-sans ml-2 opacity-70">- {u.fullName || u.username || "No Name"}</span></span>
                          <button onClick={() => setStagedUsers(stagedUsers.filter((_, idx) => idx !== i))} className="text-red-500 text-xs font-bold hover:underline">Remove</button>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <button onClick={handleCreateSubmit} className="mt-8 w-full bg-blue-600 hover:bg-blue-700 text-white py-4 rounded-xl font-bold shadow-lg transition-transform active:scale-[0.98] text-lg">
                  {editingAssessment ? 'SAVE ASSESSMENT CHANGES' : 'FINALIZE & CREATE ASSESSMENT'}
                </button>
              </div>
            </div>
          )}

          {/* ========================================== */}
          {/* VIEW: LEADERBOARD                          */}
          {/* ========================================== */}
          {activeTab === "leaderboard" && (
            <div>
              <div className="mb-6 flex items-center justify-between gap-4">
                <h2 className="text-xl font-bold">Live Leaderboard</h2>
                <button
                  type="button"
                  onClick={loadLeaderboard}
                  disabled={isLeaderboardLoading}
                  className="inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-semibold transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 dark:hover:bg-zinc-800"
                  style={{ borderColor: 'var(--card-border)' }}
                >
                  <svg className={`h-4 w-4 ${isLeaderboardLoading ? 'animate-spin' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 1 1-2.64-6.36" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 3v6h-6" />
                  </svg>
                  {isLeaderboardLoading ? 'Refreshing...' : 'Refresh'}
                </button>
              </div>
              <div className="rounded-xl border overflow-hidden bg-white dark:bg-zinc-900 shadow-sm" style={{ borderColor: 'var(--card-border)' }}>
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-zinc-800/50 text-sm opacity-70 border-b" style={{ borderColor: 'var(--card-border)' }}>
                      <th className="p-4 font-semibold">Rank</th>
                      <th className="p-4 font-semibold">Roll Number</th>
                      <th className="p-4 font-semibold">Name</th>
                      <th className="p-4 font-semibold text-right">Total Score</th>
                    </tr>
                  </thead>
                  <tbody>
                    {leaderboard.length === 0 ? (
                      <tr>
                        <td colSpan="4" className="p-8 text-center opacity-50 font-medium">No submissions yet.</td>
                      </tr>
                    ) : (
                      leaderboard.map((user, idx) => (
                        <tr key={user._id || idx} className="border-b last:border-0 hover:bg-slate-50 dark:hover:bg-zinc-800/50 transition-colors" style={{ borderColor: 'var(--card-border)' }}>
                          <td className="p-4 font-bold">
                            {idx === 0 ? '🥇 1' : idx === 1 ? '🥈 2' : idx === 2 ? '🥉 3' : idx + 1}
                          </td>
                          <td className="p-4 font-mono">{user.rollNo || user.username || "-"}</td>
                          <td className="p-4 font-medium">{user.fullName || "-"}</td>
                          <td className="p-4 font-bold text-blue-600 dark:text-blue-400 text-right">{user.score ?? user.totalScore ?? 0} XP</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === "questions" && (
            <div className="grid grid-cols-[320px_minmax(0,1fr)] gap-8">
              <div className="rounded-xl border bg-white dark:bg-zinc-900 shadow-sm" style={{ borderColor: 'var(--card-border)' }}>
                <div className="flex items-center justify-between border-b p-4" style={{ borderColor: 'var(--card-border)' }}>
                  <div>
                    <h2 className="text-lg font-bold">Question Bank</h2>
                    <p className="text-xs opacity-60">{questionBank.length} questions available</p>
                  </div>
                  <button
                    onClick={handleNewQuestion}
                    className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-bold text-white transition-colors hover:bg-blue-700"
                  >
                    + New
                  </button>
                </div>
                <div className="max-h-[calc(100vh-220px)] overflow-y-auto p-3 space-y-2">
                  {questionBank.length === 0 ? (
                    <div className="rounded-lg border border-dashed p-4 text-sm opacity-60" style={{ borderColor: 'var(--card-border)' }}>
                      No questions found. Create one from the editor.
                    </div>
                  ) : (
                    questionBank.map((question) => (
                      <button
                        key={question._id}
                        onClick={() => handleSelectQuestion(question)}
                        className={`w-full rounded-lg border p-3 text-left transition-colors ${selectedQuestionId === question._id ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/10' : 'border-transparent hover:border-slate-200 hover:bg-slate-50 dark:hover:border-zinc-700 dark:hover:bg-zinc-800'}`}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <span className="font-semibold">{question.title}</span>
                          <span className={`rounded px-2 py-1 text-[10px] font-bold uppercase tracking-wider ${question.difficulty === 'Easy' ? 'bg-green-100 text-green-700' : question.difficulty === 'Medium' ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>
                            {question.difficulty}
                          </span>
                        </div>
                        <div className="mt-2 text-xs opacity-60">
                          {question.points} XP
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </div>

              <div className="rounded-xl border bg-white dark:bg-zinc-900 p-6 shadow-sm" style={{ borderColor: 'var(--card-border)' }}>
                <div className="mb-6 flex items-center justify-between gap-4">
                  <div>
                    <h2 className="text-2xl font-bold">{selectedQuestionId ? 'Edit Question' : 'Create Question'}</h2>
                    <p className="text-sm opacity-60">Paste code snippets directly into each language block and save the full question.</p>
                  </div>
                  <div className="flex gap-3">
                    {selectedQuestionId && (
                      <button
                        onClick={handleDeleteQuestion}
                        className="rounded-lg bg-red-600 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-red-700"
                      >
                        Delete
                      </button>
                    )}
                    <button
                      onClick={handleSaveQuestion}
                      disabled={isSavingQuestion}
                      className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
                    >
                      {isSavingQuestion ? 'Saving...' : 'Save Question'}
                    </button>
                  </div>
                </div>

                {questionError && (
                  <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-900/10 dark:text-red-300">
                    {questionError}
                  </div>
                )}

                <div className="grid grid-cols-3 gap-4 mb-6">
                  <input type="text" placeholder="Question Title" value={questionForm.title} onChange={(e) => handleQuestionFieldChange('title', e.target.value)} className="w-full rounded-lg border p-3 outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50 dark:bg-zinc-800/50" style={{ borderColor: 'var(--card-border)' }} />
                  <select value={questionForm.difficulty} onChange={(e) => handleQuestionFieldChange('difficulty', e.target.value)} className="w-full rounded-lg border p-3 outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50 dark:bg-zinc-800/50" style={{ borderColor: 'var(--card-border)' }}>
                    <option value="Easy">Easy</option>
                    <option value="Medium">Medium</option>
                    <option value="Hard">Hard</option>
                  </select>
                  <input type="number" min="0" placeholder="Points" value={questionForm.points} onChange={(e) => handleQuestionFieldChange('points', e.target.value)} className="w-full rounded-lg border p-3 outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50 dark:bg-zinc-800/50" style={{ borderColor: 'var(--card-border)' }} />
                </div>

                <div className="space-y-4 mb-8">
                  <textarea rows={3} placeholder="Task" value={questionForm.task} onChange={(e) => handleQuestionFieldChange('task', e.target.value)} className="w-full rounded-lg border p-3 outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50 dark:bg-zinc-800/50" style={{ borderColor: 'var(--card-border)' }} />
                  <textarea rows={4} placeholder="Description" value={questionForm.description} onChange={(e) => handleQuestionFieldChange('description', e.target.value)} className="w-full rounded-lg border p-3 outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50 dark:bg-zinc-800/50" style={{ borderColor: 'var(--card-border)' }} />
                  <div className="grid grid-cols-2 gap-4">
                    <textarea rows={3} placeholder="Constraints" value={questionForm.constraints} onChange={(e) => handleQuestionFieldChange('constraints', e.target.value)} className="w-full rounded-lg border p-3 outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50 dark:bg-zinc-800/50" style={{ borderColor: 'var(--card-border)' }} />
                    <div className="space-y-4">
                      <textarea rows={3} placeholder="Input Format" value={questionForm.inputFormat} onChange={(e) => handleQuestionFieldChange('inputFormat', e.target.value)} className="w-full rounded-lg border p-3 outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50 dark:bg-zinc-800/50" style={{ borderColor: 'var(--card-border)' }} />
                      <textarea rows={3} placeholder="Output Format" value={questionForm.outputFormat} onChange={(e) => handleQuestionFieldChange('outputFormat', e.target.value)} className="w-full rounded-lg border p-3 outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50 dark:bg-zinc-800/50" style={{ borderColor: 'var(--card-border)' }} />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-6 mb-8">
                  <div>
                    <label className="mb-2 block text-sm font-bold opacity-80">Examples JSON</label>
                    <textarea rows={12} value={questionForm.examplesText} onChange={(e) => handleQuestionFieldChange('examplesText', e.target.value)} className="w-full rounded-lg border p-3 font-mono text-sm outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50 dark:bg-zinc-800/50" style={{ borderColor: 'var(--card-border)' }} />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-bold opacity-80">Hidden Test Cases JSON</label>
                    <textarea rows={12} value={questionForm.hiddenTestCasesText} onChange={(e) => handleQuestionFieldChange('hiddenTestCasesText', e.target.value)} className="w-full rounded-lg border p-3 font-mono text-sm outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50 dark:bg-zinc-800/50" style={{ borderColor: 'var(--card-border)' }} />
                  </div>
                </div>

                <div className="space-y-6">
                  {['cpp', 'python', 'java'].map((language) => (
                    <div key={language} className="rounded-xl border p-4" style={{ borderColor: 'var(--card-border)' }}>
                      <div className="mb-4 flex items-center justify-between">
                        <h3 className="text-lg font-bold uppercase tracking-wide">{language} Templates</h3>
                        <span className="text-xs opacity-60">Keep both visibleCode and hiddenDriver</span>
                      </div>
                      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                        <div>
                          <label className="mb-2 block text-sm font-semibold opacity-80">Visible Code</label>
                          <div className="overflow-hidden rounded-lg border bg-slate-950" style={{ borderColor: 'var(--card-border)' }}>
                            <Editor
                              height="320px"
                              language={editorLanguageMap[language]}
                              theme="vs-dark"
                              value={questionForm.templates[language].visibleCode}
                              onChange={(value) => handleTemplateFieldChange(language, 'visibleCode', value || '')}
                              options={{
                                minimap: { enabled: false },
                                fontSize: 14,
                                fontFamily: "'Fira Code', 'JetBrains Mono', monospace",
                                lineHeight: 22,
                                padding: { top: 12 },
                                scrollBeyondLastLine: false,
                                automaticLayout: true,
                                tabSize: 4,
                                insertSpaces: true,
                              }}
                            />
                          </div>
                        </div>
                        <div>
                          <label className="mb-2 block text-sm font-semibold opacity-80">Hidden Driver</label>
                          <div className="overflow-hidden rounded-lg border bg-slate-950" style={{ borderColor: 'var(--card-border)' }}>
                            <Editor
                              height="320px"
                              language={editorLanguageMap[language]}
                              theme="vs-dark"
                              value={questionForm.templates[language].hiddenDriver}
                              onChange={(value) => handleTemplateFieldChange(language, 'hiddenDriver', value || '')}
                              options={{
                                minimap: { enabled: false },
                                fontSize: 14,
                                fontFamily: "'Fira Code', 'JetBrains Mono', monospace",
                                lineHeight: 22,
                                padding: { top: 12 },
                                scrollBeyondLastLine: false,
                                automaticLayout: true,
                                tabSize: 4,
                                insertSpaces: true,
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

        </div>
      </main>
    </div>
  );
}