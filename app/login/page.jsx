"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { loginUser } from "../../lib/api";

export default function LoginPage() {
  const router = useRouter();
  const [rollNo, setRollNo] = useState("");
  const [password, setPassword] = useState(""); // This is their Phone Number
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const clearAssessmentContext = () => {
    localStorage.removeItem("assessmentId");
    localStorage.removeItem("assessmentTitle");
    localStorage.removeItem("assessmentDurationMinutes");
    localStorage.removeItem("assessmentStartTime");
    localStorage.removeItem("assessmentStatus");
    localStorage.removeItem("assessmentTotalQuestions");
  };

  const saveAssessmentContextFromLogin = (assessment) => {
    if (!assessment) {
      clearAssessmentContext();
      return;
    }

    const assessmentId = assessment.id || assessment._id;

    if (assessmentId) {
      localStorage.setItem("assessmentId", String(assessmentId));
    }
    if (assessment.title) localStorage.setItem("assessmentTitle", String(assessment.title));
    if (assessment.durationMinutes !== undefined) {
      localStorage.setItem("assessmentDurationMinutes", String(assessment.durationMinutes));
    }
    if (assessment.startTime) localStorage.setItem("assessmentStartTime", String(assessment.startTime));
    if (assessment.status) localStorage.setItem("assessmentStatus", String(assessment.status));
    if (assessment.totalQuestions !== undefined) {
      localStorage.setItem("assessmentTotalQuestions", String(assessment.totalQuestions));
    }
  };

  // Clear any existing session data when they land on the login page
  useEffect(() => {
    localStorage.removeItem("token");
    localStorage.removeItem("sessionId");
    localStorage.removeItem("userName");
    localStorage.removeItem("rollNo");
    clearAssessmentContext();
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      // Clean inputs to prevent accidental spacebar errors
      const cleanRoll = rollNo.trim();
      const cleanPass = password.trim();

      const res = await loginUser(cleanRoll, cleanPass);

      if (res && res.success) {
        // 1. Token is already saved in localStorage by lib/api.js
        // 2. Save the Session ID and User Details for the Dashboard
        localStorage.setItem("sessionId", res.user.sessionId);
        localStorage.setItem("userName", res.user.fullName);
        localStorage.setItem("rollNo", res.user.username);

        // Persist assessment context returned by participantLogin.
        saveAssessmentContextFromLogin(res.assessment);

        // 3. Route to the exam dashboard
        router.push("/");
      } else {
        // Show specific error (e.g., "Roll Number not registered")
        setError(res?.error || "Invalid credentials. Please contact the invigilator.");
      }
    } catch (err) {
      setError("Server connection failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-zinc-950 p-4 relative overflow-hidden">
      
      {/* Background Decorative Elements */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-600/10 dark:bg-blue-600/5 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-600/10 dark:bg-blue-600/5 rounded-full blur-3xl pointer-events-none"></div>

      <div className="max-w-md w-full relative z-10">
        
        {/* College Branding Header */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 mx-auto relative mb-4 bg-white rounded-2xl shadow-sm p-2 border border-slate-200 dark:border-zinc-800">
            {/* Make sure you have a diet-logo.png in your public folder */}
            <Image src="/diet-logo.png" alt="DIET Logo" fill className="object-contain p-2" sizes="80px" />
          </div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">Code Sprint 2026</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-2 font-medium">Dhanekula Institute of Engineering & Technology</p>
        </div>

        {/* Login Card */}
        <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-xl border border-slate-200 dark:border-zinc-800 overflow-hidden">
          <div className="p-8">
            <h2 className="text-lg font-bold text-slate-800 dark:text-slate-200 mb-6">Participant Login</h2>
            
            <form onSubmit={handleLogin} className="space-y-5">
              <div>
                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Roll Number</label>
                <input 
                  type="text" 
                  required 
                  value={rollNo} 
                  onChange={(e) => setRollNo(e.target.value)} 
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-zinc-800 border border-slate-300 dark:border-zinc-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all font-mono" 
                  placeholder="e.g., 22ABC101" 
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Passcode (Phone Number)</label>
                <input 
                  type="password" 
                  required 
                  value={password} 
                  onChange={(e) => setPassword(e.target.value)} 
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-zinc-800 border border-slate-300 dark:border-zinc-700 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all font-mono" 
                  placeholder="Enter 10-digit number" 
                />
              </div>

              {/* Error Message Display */}
              {error && (
                <div className="flex items-center gap-2 text-red-600 dark:text-red-400 text-sm font-semibold bg-red-50 dark:bg-red-900/20 p-3 rounded-lg border border-red-200 dark:border-red-900/50">
                  <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                  <span>{error}</span>
                </div>
              )}

              <button 
                type="submit" 
                disabled={loading} 
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3.5 rounded-xl transition-transform active:scale-[0.98] disabled:opacity-70 disabled:active:scale-100 flex justify-center items-center shadow-lg shadow-blue-600/20 mt-2"
              >
                {loading ? (
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>Authenticating...</span>
                  </div>
                ) : (
                  "Access Assessment"
                )}
              </button>
            </form>
          </div>
          
          <div className="bg-slate-50 dark:bg-zinc-800/50 p-4 text-center border-t border-slate-200 dark:border-zinc-800 text-xs font-medium text-slate-500 dark:text-slate-400">
            By logging in, you agree to the strict zero-tolerance academic integrity policy.
          </div>
        </div>

      </div>
    </div>
  );
}