import React from "react";
import { Pause, Play, RefreshCw } from "lucide-react";

interface TimerDisplayProps {
  time: number;
  isRunning: boolean;
  onStartPause: () => void;
  onReset: () => void;
  onAdjustTime: (amount: number) => void;
}

const TimerDisplay: React.FC<TimerDisplayProps> = ({
  time,
  isRunning,
  onStartPause,
  onReset,
  onAdjustTime,
}) => {
  return (
    <div className="flex flex-col w-full lg:w-1/2 items-center justify-center p-4 bg-white border text-black shadow rounded-lg">
      <div className="text-4xl font-bold mb-4">
        {Math.floor(time / 60)}:{time % 60 < 10 ? "0" : ""}
        {time % 60}
      </div>
      <div className="flex space-x-4 mb-4">
        <button onClick={() => onAdjustTime(-600)}>-10m</button>
        <button onClick={() => onAdjustTime(-60)}>-1m</button>
        <button onClick={() => onAdjustTime(60)}>+1m</button>
        <button onClick={() => onAdjustTime(600)}>+10m</button>
      </div>
      <div className="flex space-x-4">
        <button onClick={onStartPause}>
          {isRunning ? <Pause size={32} /> : <Play size={32} />}
        </button>
        <button onClick={onReset}>
          <RefreshCw size={32} />
        </button>
      </div>
    </div>
  );
};

export default TimerDisplay;
