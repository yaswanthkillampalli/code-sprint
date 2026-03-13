"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Progress } from "../../components/ui/progress";
import { fetchAllQuestionsOfUsername, fetchAssessmentById, fetchQuestionsByAssessmentId } from "../../lib/api";
import useAntiCheat from "../../hooks/useAntiCheat"; // Adjust path as needed

export default function DashboardPage() {
  const router = useRouter();
  const [problems, setProblems] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const { isFullscreen, enforceFullscreen, tabSwitchCount } = useAntiCheat();
  const prevCountRef = useRef(tabSwitchCount)
  
  // Header State
  const [timeLeft, setTimeLeft] = useState(7200); 
  const [totalDuration, setTotalDuration] = useState(7200);
  const [assessmentEndMs, setAssessmentEndMs] = useState(null);
  const [serverOffsetMs, setServerOffsetMs] = useState(0);
  const [userName, setUserName] = useState("Student");
  const [rollNo, setRollNo] = useState("");

  useEffect(() => {
    if (tabSwitchCount > prevCountRef.current) {
      toast("Just a gentle reminder", {
        id: "tab-switch-warning",
        description: "Please keep this tab active. Navigating away might interrupt your assessment.",
        action: {
          label: "Got it",
          onClick: () => console.log("User acknowledged warning"),
        },
      });
      
      prevCountRef.current = tabSwitchCount;
    }
  }, [tabSwitchCount]);

  useEffect(() => {
    // 1. Initialize User Identity from LocalStorage safely
    const roll = localStorage.getItem("rollNo") || "N/A";
    const name = localStorage.getItem("userName") || "Student";
    
    console.log("Initializing Dashboard for:", { roll, name });
    
    // These update in the background for the UI to use later
    setRollNo(roll);
    setUserName(name);

    const loadDashboardData = async () => {
      try {
        if (!localStorage.getItem("token") || !roll || roll === "N/A") {
          router.push("/login");
          return;
        }

        const assessmentId = localStorage.getItem("assessmentId");
        if (!assessmentId) {
          router.push("/");
          return;
        }

        // 2. Fetch this participant's mapped assessment status and timing by ID
        const examRes = await fetchAssessmentById(assessmentId);

        if (!examRes?.success || !examRes?.data) {
          router.push("/");
          return;
        }

        const examData = examRes.data;
        const currentStatus = examData.status;
        const serverNowMs = examRes?.serverNow ? new Date(examRes.serverNow).getTime() : Date.now();
        setServerOffsetMs(serverNowMs - Date.now());

        if (currentStatus !== "active") {
          router.push("/");
          return;
        }

        const { startTime, durationMinutes } = examData;
        if (startTime && durationMinutes) {
          const nowMs = Date.now();
          const startMs = new Date(startTime).getTime();

          // Calculate the end time manually (duration * 60 seconds * 1000 milliseconds)
          const durationMs = durationMinutes * 60 * 1000;
          const endMs = startMs + durationMs;

          // Access Control: Check if the assessment has started
          if (serverNowMs < startMs) {
            toast.error("Assessment Not Started", {
              description: "Please wait for the scheduled time to begin the assessment.",
              duration: 4000,
              style: {
                padding: '16px',
                fontSize: '16px',
                fontWeight: '600'
              }
            });
            setTimeout(() => router.push("/"), 2000);
            return;
          }

          // Access Control: Check if the assessment has already ended
          if (serverNowMs > endMs) {
            toast.error("Assessment Ended", {
              description: "The assessment has ended. Review your performance on the leaderboard.",
              duration: 4000,
              style: {
                padding: '16px',
                fontSize: '16px',
                fontWeight: '600'
              }
            });
            setTimeout(() => router.push("/login"), 2000);
            return;
          }

          const remainingSeconds = Math.floor((endMs - serverNowMs) / 1000);
          const totalSeconds = durationMinutes * 60;
          setAssessmentEndMs(endMs);
          setTimeLeft(remainingSeconds > 0 ? remainingSeconds : 0);
          setTotalDuration(totalSeconds);
        }

        // 3. Fetch only questions mapped to the current assessment

        if (!assessmentId) {
          console.warn("Current assessment ID was not found in response");
          setProblems([]);
        } else {
          const [assessmentQuestionsRes, progressRes] = await Promise.all([
            fetchQuestionsByAssessmentId(assessmentId),
            fetchAllQuestionsOfUsername(roll, assessmentId)
          ]);

          const assessmentQuestions = assessmentQuestionsRes?.success
            ? assessmentQuestionsRes?.data?.questions || []
            : [];

          const progressList = progressRes?.success ? progressRes?.data || [] : [];
          const progressById = new Map(
            progressList.map((item) => [String(item.id || item._id), item])
          );

          const mergedQuestions = assessmentQuestions.map((q) => {
            const qid = String(q._id || q.id || "");
            const progress = progressById.get(qid);
            const total = q.hiddenTestCases?.length ?? progress?.testCasesTotal ?? 0;
            const passed = progress?.testCasesPassed ?? 0;
            const xp = q.points ?? progress?.xp ?? 0;

            return {
              ...q,
              id: qid,
              xp,
              testCasesTotal: total,
              testCasesPassed: passed,
              score: progress?.score ?? progress?.bestPoints ?? passed
            };
          });

          if (assessmentQuestionsRes?.success) {
            setProblems(mergedQuestions);
          } else {
            console.warn("Assessment questions fetched but data was empty or unsuccessful");
            setProblems([]);
          }
        }

      } catch (err) {
        console.error("Dashboard Load Error:", err);
      } finally {
        setIsLoading(false);
      }
    };
    
    loadDashboardData();
  }, [router]);

  // 2. Timer Countdown Logic
  useEffect(() => {
    if (!assessmentEndMs) return;

    const tick = () => {
      const nowMs = Date.now() + serverOffsetMs;
      const remainingSeconds = Math.max(0, Math.floor((assessmentEndMs - nowMs) / 1000));
      setTimeLeft(remainingSeconds);

      if (remainingSeconds <= 0) {
        router.push("/login");
      }
    };

    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [assessmentEndMs, serverOffsetMs, router]);

  // Periodically verify status/timing from server to keep device clocks in sync.
  useEffect(() => {
    const assessmentId = localStorage.getItem("assessmentId");
    if (!assessmentId) return;

    const verifyAssessment = async () => {
      try {
        const examRes = await fetchAssessmentById(assessmentId);
        if (!examRes?.success || !examRes?.data) {
          router.push("/");
          return;
        }

        const examData = examRes.data;
        const serverNowMs = examRes?.serverNow ? new Date(examRes.serverNow).getTime() : Date.now();
        setServerOffsetMs(serverNowMs - Date.now());

        if (examData.status !== "active") {
          router.push("/");
          return;
        }

        if (examData.startTime && examData.durationMinutes) {
          const startMs = new Date(examData.startTime).getTime();
          const endMs = startMs + examData.durationMinutes * 60 * 1000;
          setAssessmentEndMs(endMs);

          if (serverNowMs > endMs) {
            router.push("/login");
          }
        }
      } catch (err) {
        console.error("Dashboard verify error:", err);
      }
    };

    const verifyInterval = setInterval(verifyAssessment, 15000);
    return () => clearInterval(verifyInterval);
  }, [router]);

  // Format seconds to HH:MM:SS
  const formatTime = (seconds) => {
    const h = Math.floor(seconds / 3600).toString().padStart(2, "0");
    const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, "0");
    const s = (seconds % 60).toString().padStart(2, "0");
    return `${h}:${m}:${s}`;
  };

  // 3. Quit Handler
  const handleQuit = () => {
    localStorage.clear();
    toast.success("Exam Ended", { 
      description: "You have exited the assessment.",
      duration: 2000,
      style: {
        padding: '16px',
        fontSize: '16px',
        fontWeight: '600'
      }
    });
    setTimeout(() => router.push("/login"), 1500);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 dark:bg-zinc-950">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="font-semibold text-slate-600 dark:text-slate-400">Loading Assessment...</p>
      </div>
    );
  }

  return (
    <>
      {!isFullscreen && (
        <div className="fixed inset-0 z-[9999] bg-slate-900/95 backdrop-blur-md flex flex-col items-center justify-center text-white p-6">
          <div className="bg-red-600/20 p-6 rounded-full mb-6">
            <svg className="w-16 h-16 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
          </div>
          <h1 className="text-4xl font-black mb-4 text-center">FULLSCREEN EXITED</h1>
          <p className="text-lg text-slate-300 mb-8 max-w-xl text-center">
            You have exited the secure exam environment. Leaving fullscreen is a violation of the exam rules. Please return to fullscreen immediately to continue your assessment.
          </p>
          <button 
            onClick={enforceFullscreen}
            className="bg-red-600 hover:bg-red-700 text-white font-bold py-4 px-12 rounded-xl text-xl shadow-lg transition-transform active:scale-95"
          >
            Return to Exam
          </button>
        </div>
      )}
      <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-zinc-950 text-slate-900 dark:text-slate-100">
        
        {/* HEADER ROW 1: Branding & User Profile */}
        <nav className="w-full h-16 border-b flex items-center justify-between px-6 bg-white dark:bg-zinc-900" style={{ borderColor: 'var(--card-border)' }}>
          <div className="flex items-center gap-3">
            <div className="relative w-8 h-8 rounded overflow-hidden">
              <Image src="/diet-logo.png" alt="Logo" fill className="object-cover" sizes="32px" />
            </div>
            <span className="font-semibold text-lg tracking-tight hidden sm:block">Code Sprint 2026 - Dhanekula Institute</span>
            <span className="font-semibold text-lg tracking-tight sm:hidden">Code Sprint</span>
          </div>
          
          {/* User Profile Info */}
          <div className="flex items-center gap-3">
            <div className="text-right hidden md:block">
              <div className="text-sm font-bold leading-none mb-1">{userName}</div>
              <div className="text-xs font-mono opacity-60 leading-none">{rollNo}</div>
            </div>
            <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold text-lg border border-blue-200 dark:border-blue-800">
              {userName.charAt(0).toUpperCase()}
            </div>
          </div>
        </nav>

        {/* HEADER ROW 2: Exam Controls & Timer (Sticky) */}
        <div className="w-full h-16 border-b flex items-center justify-between px-6 shadow-sm sticky top-0 z-10 bg-slate-50 dark:bg-zinc-950/90 backdrop-blur-md" style={{ borderColor: 'var(--card-border)' }}>
          {/* Left: Test Info */}
          <div className="text-sm font-bold text-blue-600 dark:text-blue-400 flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
            <span className="hidden sm:inline">Assessment Overview</span>
            <span className="sm:hidden">Overview</span>
          </div>

          {/* Center: Global Timer */}
          <div className="flex flex-col items-center">
            <span className="text-[10px] uppercase tracking-widest opacity-60 font-bold mb-0.5">Time Remaining</span>
            <span className={`text-2xl font-mono font-black leading-none ${timeLeft < 300 ? 'text-red-600 dark:text-red-400 animate-pulse' : ''}`}>
              {formatTime(timeLeft)}
            </span>
          </div>

          {/* Right: Quit Button */}
          <button 
            onClick={handleQuit}
            className="px-4 py-2 border-2 border-red-500/20 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 hover:border-red-500 rounded-lg text-sm font-bold transition-all"
          >
            Quit Exam
          </button>
        </div>

        {/* TIME PROGRESS BAR - Right to Left */}
        <div className="w-full h-1 sticky top-16 z-10 shadow-sm" dir="rtl">
          <Progress 
            value={Math.max(0, (timeLeft / totalDuration) * 100)}
            className="w-full h-full rounded-none bg-slate-200 dark:bg-slate-700"
            style={{ height: "100%" }}
          />
        </div>

        {/* MAIN CONTENT: Problem List */}
        <div className="flex-1 max-w-6xl w-full mx-auto p-4 sm:p-6 mt-2">
          
          {/* List Header */}
          <div className="hidden md:grid grid-cols-12 gap-4 px-6 py-3 rounded-t-xl text-xs font-bold opacity-70 uppercase tracking-wider bg-slate-200/50 dark:bg-zinc-800/50">
            <div className="col-span-4">Question</div>
            <div className="col-span-1 text-center">XP</div>
            <div className="col-span-3 text-center">Testcases Passed</div>
            <div className="col-span-2 text-center">Score</div>
            <div className="col-span-2 text-center text-right pr-4">Action</div>
          </div>

          {/* Problem Cards */}
          <div className="space-y-3 mt-2">
            {problems.map((prob) => {
              const questionId = prob._id || prob.id || "";
              const totalTC = prob.testCasesTotal || 1; 
              const safePassed = Number(prob.testCasesPassed || 0);
              const testCasePercent = Math.max(0, Math.min(100, (safePassed / totalTC) * 100));

              return (
                <div key={questionId || prob.title} className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center px-6 py-5 rounded-xl border bg-white dark:bg-zinc-900 shadow-sm hover:shadow-md transition-all" style={{ borderColor: 'var(--card-border)' }}>
                  
                  <div className="md:col-span-4">
                    <span className="text-xs font-bold text-slate-400 dark:text-slate-500 block mb-1">PROB-{String(questionId || "NA").slice(-4).toUpperCase()}</span>
                    <h3 className="font-bold text-lg leading-tight">{prob.title}</h3>
                  </div>

                  <div className="md:col-span-1 flex md:block justify-between items-center text-center font-bold text-yellow-600 dark:text-yellow-500">
                    <span className="md:hidden text-sm text-slate-500">Points: </span>
                    {prob.xp} XP
                  </div>

                  <div className="md:col-span-3 flex flex-col items-center justify-center">
                    <div className="flex items-end gap-1 mb-1">
                      <span className="text-xl font-black">{safePassed}</span>
                      <span className="text-sm opacity-40 mb-0.5">/{prob.testCasesTotal}</span>
                    </div>
                    <div className="w-full max-w-[140px] h-2 bg-slate-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                      <div className="h-full bg-blue-500 transition-all duration-500" style={{ width: `${testCasePercent}%` }}></div>
                    </div>
                  </div>

                  <div className="md:col-span-2 flex flex-col items-center justify-center border-t md:border-t-0 pt-4 md:pt-0 mt-2 md:mt-0 border-slate-100 dark:border-zinc-800">
                    <span className="font-black text-2xl text-slate-800 dark:text-slate-100">{prob.score || 0}</span>
                    <span className="text-[10px] uppercase font-bold opacity-50 tracking-wider">Points Earned</span>
                  </div>

                  <div className="md:col-span-2 flex justify-center md:justify-end mt-2 md:mt-0">
                    <Link href={`/editor/${questionId}`} className="w-full md:w-auto">
                      <button className="w-full md:w-auto flex items-center justify-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-bold transition-all transform active:scale-95 shadow-sm">
                        {safePassed === prob.testCasesTotal ? "Solved" : "Solve"} 
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M9 5l7 7-7 7"></path></svg>
                      </button>
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}