import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { ChevronUp, ChevronDown } from "lucide-react";

const SIDEBAR_TIMER_HIDDEN_KEY = "sidebarTimerHidden";
const TIMER_SIMPLE_MODE_KEY = "timerSimpleMode";

interface SidebarTimerProps {
  isVisible: boolean;
  time: number;
  isBreakTimer?: boolean;
  onNavigateToTimer?: () => void;
  isStopwatchMode?: boolean;
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

  useEffect(() => {
    localStorage.setItem(SIDEBAR_TIMER_HIDDEN_KEY, isHidden.toString());
  }, [isHidden]);

  useEffect(() => {
    const handleStorageChange = () => {
      const saved = localStorage.getItem(TIMER_SIMPLE_MODE_KEY);
      setIsSimpleMode(saved === "true");
    };

    const interval = setInterval(handleStorageChange, 1000);
    window.addEventListener("storage", handleStorageChange);

    return () => {
      clearInterval(interval);
      window.removeEventListener("storage", handleStorageChange);
    };
  }, []);

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}:${secs < 10 ? "0" : ""}${secs}`;
  };

  const formatTimeMinutesOnly = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    return `${minutes}m`;
  };

  const label = isBreakTimer ? "Break" : isStopwatchMode ? "Stopwatch" : "Focus";
  const labelColor = isBreakTimer
    ? "text-sky-400/60"
    : isStopwatchMode
      ? "text-amber-400/60"
      : "text-slate-500";

  if (!isVisible) return null;

  // Collapsed
  if (isHidden) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        className="w-full"
      >
        <button
          onClick={(e) => {
            e.stopPropagation();
            setIsHidden(false);
          }}
          className="w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-2xl bg-white/[0.04] dark:bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.06] transition-all group"
          title="Show timer"
        >
          <span className={`text-[10px] font-medium uppercase tracking-wider ${labelColor}`}>
            {label}
          </span>
          <span className="text-sm font-medium tabular-nums text-slate-300">
            {formatTimeMinutesOnly(time)}
          </span>
          <ChevronDown className="w-3 h-3 text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity" />
        </button>
      </motion.div>
    );
  }

  // Expanded
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="w-full rounded-2xl bg-white/[0.04] dark:bg-white/[0.03] border border-white/[0.06] p-4 transition-all hover:bg-white/[0.06] cursor-pointer relative group"
      title="Click to go to timer"
    >
      {/* Hide button */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          setIsHidden(true);
        }}
        className="absolute top-2 right-2 p-1 rounded-lg text-slate-600 hover:text-slate-300 hover:bg-white/[0.06] opacity-0 group-hover:opacity-100 transition-all"
        title="Hide timer"
      >
        <ChevronUp className="w-3.5 h-3.5" />
      </button>

      <div className="flex flex-col items-center gap-1">
        <span className={`text-[10px] font-medium uppercase tracking-wider ${labelColor}`}>
          {label}
        </span>
        <span className="text-2xl font-semibold tabular-nums tracking-tight text-slate-300">
          {isSimpleMode ? formatTimeMinutesOnly(time) : formatTime(time)}
        </span>
      </div>
    </motion.div>
  );
};

export default SidebarTimer;
