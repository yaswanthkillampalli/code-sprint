"use client";

import { useEffect, useState } from "react";

export default function useAntiCheat() {
  const [isFullscreen, setIsFullscreen] = useState(true); // Assume true initially to avoid flashing

  useEffect(() => {
    // 1. DISABLE RIGHT CLICK (Context Menu)
    const handleContextMenu = (e) => e.preventDefault();

    // 2. DISABLE COPY, CUT, & PASTE GLOBALLY
    const handleClipboard = (e) => {
      e.preventDefault();
      // Optional: You could trigger an API call here to flag the user in the database
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

    // Attach Listeners
    document.addEventListener("contextmenu", handleContextMenu);
    document.addEventListener("copy", handleClipboard);
    document.addEventListener("cut", handleClipboard);
    document.addEventListener("paste", handleClipboard);
    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("fullscreenchange", handleFullscreenChange);

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
    };
  }, []);

  // Expose a function to let the user return to fullscreen if they escape
  const enforceFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(err => console.error("Fullscreen blocked:", err));
    }
  };

  return { isFullscreen, enforceFullscreen };
}