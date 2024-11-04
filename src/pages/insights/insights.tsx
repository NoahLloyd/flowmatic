import React from "react";
import { Session } from "../../types/Session";

interface InsightsProps {
  sessions: Session[];
  isLoadingSessions: boolean;
}

const Insights: React.FC<InsightsProps> = ({ sessions, isLoadingSessions }) => {
  return (
    <div>
      <h1>Insights Page</h1>
      {isLoadingSessions ? (
        <p>Loading sessions...</p>
      ) : (
        <div>
          {sessions.map((session) => (
            <div key={session.created_at}>
              <p>Task: {session.task}</p>
              <p>Project: {session.project}</p>
              <p>Minutes: {session.minutes}</p>
              <p>Focus Score: {session.focus}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Insights;
