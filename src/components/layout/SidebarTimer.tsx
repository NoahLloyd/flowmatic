import React from "react";
import { motion } from "framer-motion";

interface SidebarTimerProps {
  isVisible: boolean;
  time: number; // Directly from timeRemaining or breakTimeRemaining
  isBreakTimer?: boolean; // Whether this is a break timer or main timer
}

const SidebarTimer: React.FC<SidebarTimerProps> = ({
  isVisible,
  time,
  isBreakTimer = false,
}) => {
  // Format time as MM:SS
  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}:${secs < 10 ? "0" : ""}${secs}`;
  };

  if (!isVisible) return null;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="w-full mb-0 bg-white/10 dark:bg-slate-800 rounded-xl shadow-sm border border-white/20 dark:border-slate-700 p-3 transition-all hover:bg-white/15 dark:hover:bg-slate-700/80 cursor-pointer"
      title="Click to go to timer"
    >
      <div className="flex flex-col items-center">
        <div className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1 opacity-70">
          {isBreakTimer ? "Break" : "Focus"}
        </div>
        <span className="text-3xl font-bold text-slate-700 dark:text-slate-200">
          {formatTime(time)}
        </span>
      </div>
    </motion.div>
  );
};

export default SidebarTimer;
