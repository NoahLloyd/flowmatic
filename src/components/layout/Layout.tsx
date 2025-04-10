import React, { useEffect } from "react";
import Sidebar from "./Sidebar";
import { useTheme } from "../../context/ThemeContext";
import SidebarTimer from "./SidebarTimer";
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

  // Theme-based default colors for dark/light mode
  const defaultFromColor = isDarkMode ? "#1E293B" : "#E8CBC0";
  const defaultToColor = isDarkMode ? "#0F172A" : "#636FA4";

  // Use user preferences if available, otherwise use theme defaults
  const fromColor = user?.preferences?.fromColor || defaultFromColor;
  const toColor = user?.preferences?.toColor || defaultToColor;

  // Get timer state - minimal version
  const {
    timeRemaining,
    breakTimeRemaining,
    isBreakMode,
    isRunning,
    breakIsRunning,
    showInSidebar,
    synchronizeTimerState,
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

  // Determine if we should show the timer in the sidebar
  // - Show only if timer is actually running (not paused)
  // - And either 1) showInSidebar flag is true, or 2) not on Compass page with active timer
  const displaySidebarTimer =
    (isRunning || (isBreakMode && breakIsRunning)) && // Only show when timer is actively running
    (showInSidebar ||
      (selected !== "Compass" &&
        // For normal timer: either it's running or has remaining time
        (timeRemaining > 0 ||
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
      style={{
        background: `linear-gradient(to bottom right, ${fromColor}, ${toColor})`,
      }}
      className="flex h-screen p-4"
    >
      {/* Sidebar with timer and title */}
      <Sidebar
        title="User"
        selected={selected}
        onSelect={setSelected}
        timerProps={
          displaySidebarTimer
            ? {
                isVisible: true,
                time: isBreakMode ? breakTimeRemaining : timeRemaining,
                isBreakTimer: isBreakMode,
              }
            : undefined
        }
      />

      {/* Main content area */}
      <div
        className={`flex-1 ${
          isDarkMode ? "bg-slate-900" : "bg-white"
        } rounded-xl overflow-auto p-6 shadow-lg`}
      >
        {children}
      </div>
    </div>
  );
};

export default Layout;
