import React from "react";
import TimerDisplay from "./TimerDisplay";
import SessionForm from "./SessionForm";
import SessionCard from "../../components/session/SessionCard";
import { Session } from "../../types/Session";
import SessionsOverview from "../../components/session/SessionsOverview";
import SessionStats from "../../components/session/SessionStats";
import Signals from "./signal/Signals";

interface CompassProps {
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

const Compass: React.FC<CompassProps> = ({
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
    <div className="container mx-auto px-4 py-6 bg-white dark:bg-gray-900">
      {/* Signals Section */}
      <div className="mb-8">
        <Signals />
      </div>

      {/* Timer and Sessions Section */}
      <div className="flex space-x-6 mb-8">
        {/* Timer */}
        <div className="flex-shrink-0">
          <div className="">
            <TimerDisplay
              time={time}
              isRunning={isRunning}
              onStartPause={onStartPause}
              onReset={onReset}
              onAdjustTime={onAdjustTime}
            />
          </div>
        </div>

        {/* Sessions Overview */}
        <div className="flex-grow">
          <div className="overflow-x-auto">
            <SessionsOverview
              sessions={sessions}
              isLoading={isLoadingSessions}
              onSessionsUpdate={onSessionsUpdate}
            />
          </div>
        </div>
      </div>

      {/* Bottom section: Form and Stats */}
      <div className="text-gray-900 dark:text-gray-100">
        <SessionForm onSessionCreated={onSessionCreated} />
        <div className="mt-4">
          <SessionStats sessions={sessions} />
        </div>
      </div>
    </div>
  );
};

export default Compass;
