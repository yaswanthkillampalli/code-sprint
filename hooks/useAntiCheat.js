"use client";

import { useEffect, useRef, useState } from "react";

export default function useAntiCheat() {
  const [isFullscreen, setIsFullscreen] = useState(true); // Assume true initially to avoid flashing
  const [tabSwitchCount, setTabSwitchCount] = useState(0); // Track cheating attempts
  const lastViolationAtRef = useRef(0);

  useEffect(() => {
    const registerViolation = (reason) => {
      const now = Date.now();

      // visibilitychange + blur often fire together; count them once.
      if (now - lastViolationAtRef.current < 1200) {
        return;
      }

      lastViolationAtRef.current = now;
      setTabSwitchCount((prevCount) => prevCount + 1);
      console.warn(`Anti-cheat violation detected: ${reason}`);
    };

    // 1. DISABLE RIGHT CLICK (Context Menu)
    const handleContextMenu = (e) => e.preventDefault();

    // 2. DISABLE COPY, CUT, & PASTE GLOBALLY
    const handleClipboard = (e) => {
      e.preventDefault();
      // Optional: Trigger API call to flag user in database
    };

    // 3. DISABLE SPECIFIC KEYBOARD SHORTCUTS
    const handleKeyDown = (e) => {
      // Block Ctrl+C, Ctrl+V, Ctrl+X, Ctrl+S, Ctrl+P
      if (e.ctrlKey || e.metaKey) {
        const forbiddenKeys = ['c', 'v', 'x', 's', 'p'];
        if (forbiddenKeys.includes(e.key.toLowerCase())) {
          e.preventDefault();
        }
      }
      // Block F12 (DevTools)
      if (e.key === 'F12') {
        e.preventDefault();
      }
    };

    // 4. MONITOR FULLSCREEN STATUS
    const handleFullscreenChange = () => {
      if (!document.fullscreenElement) {
        setIsFullscreen(false);
      } else {
        setIsFullscreen(true);
      }
    };

    // 5. DETECT TAB SWITCHING (Document Visibility)
    const handleVisibilityChange = () => {
      if (document.hidden) {
        registerViolation("tab switched or minimized");
      }
    };

    // 6. DETECT LOSS OF WINDOW FOCUS (Multiple Monitors / App Switching)
    const handleWindowBlur = () => {
      registerViolation("window lost focus");
    };

    // Attach Listeners
    document.addEventListener("contextmenu", handleContextMenu);
    document.addEventListener("copy", handleClipboard);
    document.addEventListener("cut", handleClipboard);
    document.addEventListener("paste", handleClipboard);
    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("blur", handleWindowBlur);

    // Initial check just in case
    if (typeof window !== "undefined" && !document.fullscreenElement) {
      setIsFullscreen(false);
    }

    // Cleanup Listeners
    return () => {
      document.removeEventListener("contextmenu", handleContextMenu);
      document.removeEventListener("copy", handleClipboard);
      document.removeEventListener("cut", handleClipboard);
      document.removeEventListener("paste", handleClipboard);
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("blur", handleWindowBlur);
    };
  }, []);

  // Expose a function to let the user return to fullscreen if they escape
  const enforceFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(err => console.error("Fullscreen blocked:", err));
    }
  };

  // Return the new tabSwitchCount so your UI can react to it
  return { isFullscreen, enforceFullscreen, tabSwitchCount };
}