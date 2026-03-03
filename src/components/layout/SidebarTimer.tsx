import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Timer, ChevronUp, ChevronDown } from "lucide-react";

const SIDEBAR_TIMER_HIDDEN_KEY = "sidebarTimerHidden";
const TIMER_SIMPLE_MODE_KEY = "timerSimpleMode";

interface SidebarTimerProps {
  isVisible: boolean;
  time: number; // Directly from timeRemaining or breakTimeRemaining
  isBreakTimer?: boolean; // Whether this is a break timer or main timer
  onNavigateToTimer?: () => void; // Optional callback to navigate to timer
  isStopwatchMode?: boolean; // Whether the timer is in stopwatch (count-up) mode
}

const SidebarTimer: React.FC<SidebarTimerProps> = ({
  isVisible,
  time,
  isBreakTimer = false,
  onNavigateToTimer,
  isStopwatchMode = false,
}) => {
  const [isHidden, setIsHidden] = useState(() => {
    const stored = localStorage.getItem(SIDEBAR_TIMER_HIDDEN_KEY);
    return stored === "true";
  });

  const [isSimpleMode, setIsSimpleMode] = useState(() => {
    const saved = localStorage.getItem(TIMER_SIMPLE_MODE_KEY);
    return saved === "true";
  });

  // Persist hidden state to localStorage
  useEffect(() => {
    localStorage.setItem(SIDEBAR_TIMER_HIDDEN_KEY, isHidden.toString());
  }, [isHidden]);

  // Listen for changes to simple mode from other components (like TimerDisplay)
  useEffect(() => {
    const handleStorageChange = () => {
      const saved = localStorage.getItem(TIMER_SIMPLE_MODE_KEY);
      setIsSimpleMode(saved === "true");
    };

    // Check on interval since storage events don't fire in same window
    const interval = setInterval(handleStorageChange, 1000);
    window.addEventListener("storage", handleStorageChange);

    return () => {
      clearInterval(interval);
      window.removeEventListener("storage", handleStorageChange);
    };
  }, []);

  // Format time as MM:SS
  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}:${secs < 10 ? "0" : ""}${secs}`;
  };

  // Format time as minutes only
  const formatTimeMinutesOnly = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    return `${minutes}m`;
  };

  if (!isVisible) return null;

  // Collapsed state - just show a small icon
  if (isHidden) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        className="w-full mb-0"
      >
        <button
          onClick={(e) => {
            e.stopPropagation();
            setIsHidden(false);
          }}
          className="w-full flex items-center justify-center gap-2 py-2 px-3 bg-white/10 dark:bg-slate-800 rounded-xl border border-white/20 dark:border-slate-700 hover:bg-white/15 dark:hover:bg-slate-700/80 transition-all group"
          title="Show timer"
        >
          <Timer className="w-4 h-4 text-slate-600 dark:text-slate-400" />
          <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
            {formatTimeMinutesOnly(time)}
          </span>
          <ChevronDown className="w-3 h-3 text-slate-500 dark:text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity" />
        </button>
      </motion.div>
    );
  }

  // Expanded state - full timer display
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="w-full mb-0 bg-white/10 dark:bg-slate-800 rounded-xl shadow-sm border border-white/20 dark:border-slate-700 p-3 transition-all hover:bg-white/15 dark:hover:bg-slate-700/80 cursor-pointer relative group"
      title="Click to go to timer"
    >
      {/* Hide button */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          setIsHidden(true);
        }}
        className="absolute top-1.5 right-1.5 p-1 rounded-md text-slate-500 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-white/20 dark:hover:bg-slate-600/50 opacity-0 group-hover:opacity-100 transition-all"
        title="Hide timer"
      >
        <ChevronUp className="w-3.5 h-3.5" />
      </button>

      <div className="flex flex-col items-center">
        <div className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1 opacity-70">
          {isBreakTimer ? "Break" : isStopwatchMode ? "Stopwatch" : "Focus"}
        </div>
        <span className="text-3xl font-bold text-slate-700 dark:text-slate-200">
          {isSimpleMode ? formatTimeMinutesOnly(time) : formatTime(time)}
        </span>
      </div>
    </motion.div>
  );
};

export default SidebarTimer;
