import React from "react";
import TimerDisplay from "./TimerDisplay";
import SessionForm from "./SessionForm";
import SessionCard from "../../components/SessionCard";
import { Session } from "../../types/Session";

interface FocusProps {
  time: number;
  isRunning: boolean;
  onStartPause: () => void;
  onReset: () => void;
  onAdjustTime: (amount: number) => void;
  sessions: Session[];
  isLoadingSessions: boolean;
  onSessionCreated: () => Promise<void>;
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
}) => {
  return (
    <div className="">
      <div className="flex-col space-y-4 lg:space-y-0 lg:space-x-4 flex lg:flex-row">
        <TimerDisplay
          time={time}
          isRunning={isRunning}
          onStartPause={onStartPause}
          onReset={onReset}
          onAdjustTime={onAdjustTime}
        />
        <SessionForm onSessionCreated={onSessionCreated} />
      </div>
      {isLoadingSessions ? (
        <p>Loading sessions...</p>
      ) : (
        <div className="mt-4">
          <div className="grid gap-4 grid-cols-1 md:grid-cols-3 xl:grid-cols-4">
            {sessions.map((session) => (
              <SessionCard key={session.created_at} session={session} />
            ))}
          </div>
          {sessions.length === 0 && (
            <div className="text-center py-6 text-gray-500">
              No sessions recorded yet. Start a focus session to track your
              progress!
            </div>
          )}
        </div>
      )}
      Start a task, list all tasks that are for day and when one is clicked
      start a 1 hour timer where that task will automatically be connected to
      this timing session <br></br>Soundscape/lo-fi radio
    </div>
  );
};

export default Focus;
