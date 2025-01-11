import React from "react";
import { Timer, Pause, RefreshCw, Play } from "lucide-react";

interface WritingTimerProps {
  timeRemaining: number;
  isTimerRunning: boolean;
  isTimerComplete: boolean;
  onTimerToggle: () => void;
  onTimerReset: () => void;
}

const WritingTimer: React.FC<WritingTimerProps> = ({
  timeRemaining,
  isTimerRunning,
  onTimerToggle,
  onTimerReset,
}) => {
  return (
    <div className="flex items-center space-x-2 px-4 py-2 bg-white dark:bg-gray-800 rounded-lg border border-slate-200 dark:border-gray-700">
      <Timer className="w-5 h-5 text-slate-500 dark:text-slate-400" />
      <span className="text-slate-700 dark:text-slate-200">
        {Math.ceil(timeRemaining)} min
      </span>
      <button
        onClick={onTimerToggle}
        className="p-1 hover:bg-slate-100 dark:hover:bg-gray-700 rounded"
      >
        {isTimerRunning ? (
          <Pause className="w-4 h-4 dark:text-slate-400" />
        ) : (
          <Play className="w-4 h-4 dark:text-slate-400" />
        )}
      </button>
      <button
        onClick={onTimerReset}
        className="p-1 hover:bg-slate-100 dark:hover:bg-gray-700 rounded"
      >
        <RefreshCw className="w-4 h-4 dark:text-slate-400" />
      </button>
    </div>
  );
};

export default WritingTimer;
