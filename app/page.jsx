"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { fetchAssessmentById } from "../lib/api";

export default function WaitingPage() {
  const router = useRouter();
  const appTitle = process.env.NEXT_PUBLIC_APP_TITLE || "Code Sprint 2026";
  const providerName = process.env.NEXT_PUBLIC_PROVIDER_NAME || "Dhanekula Institute";
  const logoUrl = process.env.NEXT_PUBLIC_LOGO_URL || "/diet-logo.png";
  const logoAlt = process.env.NEXT_PUBLIC_LOGO_ALT || "Platform logo";
  const [examStatus, setExamStatus] = useState("waiting"); // waiting | countdown | active | finished
  const [details, setDetails] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const canStart = examStatus === "active";
  const statusLabel = {
    waiting: "WAITING FOR HOST",
    countdown: "STARTING SOON",
    active: "READY TO START",
    finished: "ASSESSMENT CLOSED"
  }[examStatus] || "STATUS UNKNOWN";

  const statusClass = {
    waiting: "bg-yellow-100 text-yellow-700",
    countdown: "bg-blue-100 text-blue-700",
    active: "bg-green-100 text-green-700",
    finished: "bg-slate-200 text-slate-700"
  }[examStatus] || "bg-slate-200 text-slate-700";

  const clearAssessmentContext = () => {
    localStorage.removeItem("assessmentId");
    localStorage.removeItem("assessmentTitle");
    localStorage.removeItem("assessmentDurationMinutes");
    localStorage.removeItem("assessmentStartTime");
    localStorage.removeItem("assessmentStatus");
    localStorage.removeItem("assessmentTotalQuestions");
  };

  const handleSignOut = () => {
    localStorage.clear();
    router.push("/login");
  };

  const getRequiredSessionContext = () => {
    const token = localStorage.getItem("token");
    const sessionId = localStorage.getItem("sessionId");
    const rollNo = localStorage.getItem("rollNo");
    const assessmentId = localStorage.getItem("assessmentId");

    const hasRequiredContext = Boolean(token && sessionId && rollNo && assessmentId);

    if (!hasRequiredContext) {
      localStorage.clear();
      router.push("/login");
      return null;
    }

    return {
      id: assessmentId,
      title: localStorage.getItem("assessmentTitle"),
      durationMinutes: localStorage.getItem("assessmentDurationMinutes"),
      startTime: localStorage.getItem("assessmentStartTime"),
      status: localStorage.getItem("assessmentStatus"),
      totalQuestions: localStorage.getItem("assessmentTotalQuestions")
    };
  };

  const syncAssessmentContext = (assessment) => {
    const assessmentId = assessment.id;

    if (assessmentId) localStorage.setItem("assessmentId", String(assessmentId));
    if (assessment.title) localStorage.setItem("assessmentTitle", String(assessment.title));
    if (assessment.durationMinutes !== undefined) {
      localStorage.setItem("assessmentDurationMinutes", String(assessment.durationMinutes));
    }
    if (assessment.startTime) localStorage.setItem("assessmentStartTime", String(assessment.startTime));
    if (assessment.totalQuestions !== undefined) {
      localStorage.setItem("assessmentTotalQuestions", String(assessment.totalQuestions));
    }
    if (assessment.status) {
      localStorage.setItem("assessmentStatus", String(assessment.status));
    }
  };

  // Refresh status from DB using assessmentId and sync localStorage.
  const checkStatus = async () => {
    setIsRefreshing(true);
    try {
      const session = getRequiredSessionContext();

      if (!session) {
        setDetails(null);
        setExamStatus("waiting");
        return;
      }

      const res = await fetchAssessmentById(session.id);

      if (!res?.success || !res?.data) {
        clearAssessmentContext();
        setDetails(null);
        setExamStatus("waiting");
        return;
      }

      syncAssessmentContext(res.data);

      const data = {
        id: res.data.id || res.data._id,
        title: res.data.title,
        durationMinutes: res.data.durationMinutes,
        startTime: res.data.startTime,
        status: res.data.status,
        totalQuestions: res.data.totalQuestions
      };

      if (!data) {
        setDetails(null);
        setExamStatus("waiting");
        return;
      }

      if (!data.id) {
        clearAssessmentContext();
        setDetails(null);
        setExamStatus("waiting");
      } else {
        setDetails(data);
        setExamStatus(data.status || "waiting");
      }
    } finally {
      // Small delay just so the user sees the refresh spinner spin
      setTimeout(() => setIsRefreshing(false), 500);
    }
  };

  // Check once when the page loads
  useEffect(() => {
    checkStatus();
  }, []);

  const handleStartAssessment = async () => {
    if (examStatus === "active") {
      try {
        // 1. Request Fullscreen first!
        if (document.documentElement.requestFullscreen) {
          await document.documentElement.requestFullscreen();
        }
      } catch (err) {
        console.log("Fullscreen request failed, but continuing:", err);
      }
      
      // 2. Route to Dashboard
      router.push("/dashboard");
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-zinc-950 text-slate-900 dark:text-slate-100">
      {/* Navbar */}
      <nav className="w-full h-16 border-b flex items-center justify-between px-6 bg-white dark:bg-zinc-900 shadow-sm" style={{ borderColor: 'var(--card-border)' }}>
        <div className="flex items-center gap-3">
          <div className="relative w-8 h-8 rounded overflow-hidden">
            <Image src={logoUrl} alt={logoAlt} fill className="object-contain" sizes="32px" unoptimized />
          </div>
          <span className="font-semibold text-lg tracking-tight">{`${appTitle} - ${providerName}`}</span>
        </div>

        <button
          onClick={handleSignOut}
          className="px-4 py-2 border-2 border-red-500/20 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 hover:border-red-500 rounded-lg text-sm font-bold transition-all"
        >
          Sign out
        </button>
      </nav>

      {/* Main Content Split View */}
      <div className="flex-1 max-w-7xl w-full mx-auto p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* LEFT COLUMN: Exam Details & Controls */}
        <div className="lg:col-span-1 space-y-6">
          <div className="p-6 rounded-xl border bg-white dark:bg-zinc-900 shadow-sm" style={{ borderColor: 'var(--card-border)' }}>
            <h2 className="text-xl font-bold mb-4 border-b pb-3 dark:border-zinc-800">Exam Details</h2>
            
            <ul className="space-y-4 text-sm">
              <li className="flex justify-between">
                <span className="opacity-70">Event Name</span>
                <span className="font-semibold">{details?.title || "Code Sprint"}</span>
              </li>
              <li className="flex justify-between">
                <span className="opacity-70">Duration</span>
                <span className="font-semibold">{details?.durationMinutes || "--"} Minutes</span>
              </li>
              <li className="flex justify-between">
                <span className="opacity-70">Total Questions</span>
                <span className="font-semibold">{details?.totalQuestions || "--"}</span>
              </li>
              <li className="flex justify-between items-center mt-4 pt-4 border-t dark:border-zinc-800">
                <span className="opacity-70">Current Status</span>
                <span className={`px-3 py-1 rounded-full text-xs font-bold ${statusClass}`}>
                  {statusLabel}
                </span>
              </li>
            </ul>
          </div>

          {/* CONTROL CARD */}
          <div className="p-6 rounded-xl border text-center bg-white dark:bg-zinc-900 shadow-sm" style={{ borderColor: 'var(--card-border)' }}>
            
            {/* Refresh Button */}
            <button 
              onClick={checkStatus}
              disabled={isRefreshing}
              className="mb-6 flex items-center justify-center gap-2 mx-auto text-sm font-semibold text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/20 dark:hover:bg-blue-900/40 px-4 py-2 rounded-full transition-colors disabled:opacity-50"
            >
              <svg className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg>
              {isRefreshing ? 'Checking...' : 'Refresh Status'}
            </button>

            {/* Start Button */}
            <button
              onClick={handleStartAssessment}
              disabled={!canStart}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-blue-600 shadow-lg active:scale-[0.98]"
            >
              {canStart ? "Start Assessment" : examStatus === "finished" ? "Assessment Closed" : "Assessment Locked"}
            </button>
            
            {!canStart && (
              <p className="text-xs text-slate-500 mt-3 font-medium">
                {examStatus === "finished"
                  ? "This assessment has ended. Contact the invigilator for the next round."
                  : "Click refresh to check if the invigilator has opened the exam."}
              </p>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: Instructions (Keep your existing HTML here) */}
        <div className="lg:col-span-2 p-8 rounded-xl border h-[calc(100vh-8rem)] overflow-y-auto bg-white dark:bg-zinc-900 shadow-sm" style={{ borderColor: 'var(--card-border)' }}>
          <h2 className="text-2xl font-bold mb-6">Instructions & Guidelines</h2>
          
          <div className="space-y-6 opacity-90 leading-relaxed text-sm lg:text-base">
            <section>
              <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">
                <span className="w-6 h-6 rounded bg-blue-100 text-blue-600 flex items-center justify-center text-sm">1</span>
                Marking System
              </h3>
              <p>Each question is divided into multiple test cases. You will receive partial points for every test case your code passes successfully. Accuracy is prioritized over speed. A perfect score will always rank higher than a faster, imperfect score.</p>
            </section>

            <section>
              <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">
                <span className="w-6 h-6 rounded bg-blue-100 text-blue-600 flex items-center justify-center text-sm">2</span>
                Execution & Submissions
              </h3>
              <ul className="list-disc pl-5 space-y-2">
                <li>Use the <strong>"Run"</strong> button to test your code against the visible sample test cases.</li>
                <li>Use the <strong>"Submit"</strong> button to evaluate your code against hidden test cases. Your score will only update upon a successful submit.</li>
                <li>To prevent server overload, there is a short cooldown between submissions.</li>
              </ul>
            </section>

            <section>
              <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">
                <span className="w-6 h-6 rounded bg-blue-100 text-blue-600 flex items-center justify-center text-sm">3</span>
                Session Rules
              </h3>
              <p>Do not share your login credentials. Logging into a second device will immediately terminate your active session on the first device. Ensure you maintain a stable internet connection.</p>
            </section>
          </div>
        </div>

      </div>
    </div>
  );
}