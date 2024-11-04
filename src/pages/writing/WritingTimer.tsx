import React from "react";
import { Timer, Pause, RefreshCw } from "lucide-react";

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
    <div className="flex items-center space-x-2 px-4 py-2 bg-white rounded-lg border border-slate-200">
      <Timer className="w-5 h-5 text-slate-500" />
      <span className="text-slate-700">{Math.ceil(timeRemaining)} min</span>
      <button
        onClick={onTimerToggle}
        className="p-1 hover:bg-slate-100 rounded"
      >
        {isTimerRunning ? (
          <Pause className="w-4 h-4" />
        ) : (
          <Timer className="w-4 h-4" />
        )}
      </button>
      <button onClick={onTimerReset} className="p-1 hover:bg-slate-100 rounded">
        <RefreshCw className="w-4 h-4" />
      </button>
    </div>
  );
};

export default WritingTimer;
