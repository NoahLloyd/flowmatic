import React, { useEffect, useState } from "react";
import Sidebar from "./Sidebar";
import { useTheme } from "../../context/ThemeContext";
import { useTimer } from "../../hooks/useTimer";
import { useAuth } from "../../context/AuthContext";

type LayoutProps = {
  children: React.ReactNode;
  selected: string;
  setSelected: (label: string) => void;
};

const Layout: React.FC<LayoutProps> = ({ children, selected, setSelected }) => {
  const { isDarkMode } = useTheme();
  const { user } = useAuth();
  const [isFocusMode, setIsFocusMode] = useState(false);

  // Theme-based default colors for dark/light mode
  const defaultLightFromColor = "#E8CBC0";
  const defaultLightToColor = "#636FA4";
  const defaultDarkFromColor = "#1E293B";
  const defaultDarkToColor = "#0F172A";

  // Use user preferences if available, otherwise use theme defaults
  const fromColor = isDarkMode
    ? user?.preferences?.darkModeFromColor ||
      user?.preferences?.fromColor ||
      defaultDarkFromColor
    : user?.preferences?.lightModeFromColor ||
      user?.preferences?.fromColor ||
      defaultLightFromColor;

  const toColor = isDarkMode
    ? user?.preferences?.darkModeToColor ||
      user?.preferences?.toColor ||
      defaultDarkToColor
    : user?.preferences?.lightModeToColor ||
      user?.preferences?.toColor ||
      defaultLightToColor;

  // Get timer state - minimal version
  const {
    timeRemaining,
    breakTimeRemaining,
    isBreakMode,
    isRunning,
    breakIsRunning,
    showInSidebar,
    synchronizeTimerState,
    isStopwatchMode,
  } = useTimer();

  // Force sync timer state when Layout mounts/updates
  useEffect(() => {
    // This ensures timer state is always fresh in the sidebar
    synchronizeTimerState();

    // Set up a more frequent check for timer state changes
    const syncInterval = setInterval(() => {
      synchronizeTimerState();
    }, 1000); // Check every second to ensure timely updates

    // We only want this to run once on mount and when the selected page changes
    // Don't include synchronizeTimerState in dependencies to avoid infinite loops
    return () => {
      clearInterval(syncInterval);
    };
  }, [selected]); // Only re-run when selected page changes

  // Set up a listener for storage events to handle changes from other components
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "timerState") {
        console.log("Timer state changed in localStorage, syncing...");
        synchronizeTimerState();
      }
    };

    window.addEventListener("storage", handleStorageChange);
    return () => {
      window.removeEventListener("storage", handleStorageChange);
    };
  }, [synchronizeTimerState]);

  // Focus mode keyboard shortcut (backslash to toggle)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Skip if focused on input elements
      if (
        document.activeElement instanceof HTMLInputElement ||
        document.activeElement instanceof HTMLTextAreaElement ||
        document.activeElement instanceof HTMLSelectElement ||
        (document.activeElement &&
          document.activeElement.hasAttribute("contenteditable"))
      ) {
        return;
      }

      // Toggle focus mode with backslash
      if (e.key === "\\") {
        e.preventDefault();
        setIsFocusMode((prev) => !prev);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  // Determine if we should show the timer in the sidebar
  // - Show only if timer is actually running (not paused)
  // - And either 1) showInSidebar flag is true, or 2) not on Compass page with active timer
  const displaySidebarTimer =
    (isRunning || (isBreakMode && breakIsRunning)) && // Only show when timer is actively running
    (showInSidebar ||
      (selected !== "Compass" &&
        // For stopwatch: always show when running (timeRemaining starts at 0)
        (isStopwatchMode ||
          // For normal timer: either it's running or has remaining time
          timeRemaining > 0 ||
          // For break timer: either it's running or has remaining time
          (isBreakMode && breakTimeRemaining > 0))));

  console.log("Sidebar timer visibility:", {
    displaySidebarTimer,
    isRunning,
    breakIsRunning,
    isBreakMode,
    showInSidebar,
    timeRemaining,
    breakTimeRemaining,
  });

  return (
    <div
      style={
        isFocusMode
          ? { background: isDarkMode ? "#0f172a" : "#ffffff" }
          : {
              background: `linear-gradient(to bottom right, ${fromColor}, ${toColor})`,
            }
      }
      className={`flex h-screen overflow-hidden transition-all duration-300 ${
        isFocusMode ? "p-0" : "p-4"
      }`}
    >
      {/* Sidebar with timer and title */}
      {!isFocusMode && (
        <Sidebar
          selected={selected}
          onSelect={setSelected}
          timerProps={
            displaySidebarTimer
              ? {
                  isVisible: true,
                  time: isBreakMode ? breakTimeRemaining : timeRemaining,
                  isBreakTimer: isBreakMode,
                  isStopwatchMode: isStopwatchMode,
                }
              : undefined
          }
        />
      )}

      {/* Main content area */}
      <div
        className={`flex-1 flex flex-col min-h-0 overflow-hidden ${
          isDarkMode ? "bg-slate-900" : "bg-white"
        } transition-all duration-300 ${
          isFocusMode ? "rounded-none" : "rounded-xl shadow-lg"
        }`}
      >
        <div
          className={`flex-1 min-h-0 flex flex-col overflow-auto ${
            isFocusMode ? "p-8" : "p-6"
          }`}
        >
          {children}
        </div>
      </div>
    </div>
  );
};

export default Layout;
