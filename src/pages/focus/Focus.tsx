import React from "react";
import TimerDisplay from "./TimerDisplay";
import SessionForm from "./SessionForm";
import SessionCard from "../../components/session/SessionCard";
import { Session } from "../../types/Session";
import SessionsOverview from "../../components/session/SessionsOverview";
import SessionStats from "../../components/session/SessionStats";

interface FocusProps {
  time: number;
  isRunning: boolean;
  onStartPause: () => void;
  onReset: () => void;
  onAdjustTime: (amount: number) => void;
  sessions: Session[];
  isLoadingSessions: boolean;
  onSessionCreated: () => Promise<void>;
  onSessionsUpdate: () => Promise<void>;
}
const Focus: React.FC<FocusProps> = ({
  time,
  isRunning,
  onStartPause,
  onReset,
  onAdjustTime,
  sessions,
  isLoadingSessions,
  onSessionCreated,
  onSessionsUpdate,
}) => {
  return (
    <div className="container mx-auto px-4 py-6">
      <div className="flex justify-center flex-col xl:flex-row mb-8 space-x-0 xl:space-x-8 space-y-8 xl:space-y-0">
        <div className="max-w-2/3">
          <TimerDisplay
            time={time}
            isRunning={isRunning}
            onStartPause={onStartPause}
            onReset={onReset}
            onAdjustTime={onAdjustTime}
          />
          <SessionForm onSessionCreated={onSessionCreated} />
        </div>
        <div>
          <SessionStats sessions={sessions} />
        </div>
        <div className="w-1/3">
          <div className="px-4 py-2 border shadow-sm rounded-lg mb-2">
            <h3 className="text-slate-700 font-medium">Sessions today</h3>
          </div>
          <SessionsOverview
            sessions={sessions}
            isLoading={isLoadingSessions}
            onSessionsUpdate={onSessionsUpdate}
          />
        </div>
      </div>
    </div>
  );
};
export default Focus;
