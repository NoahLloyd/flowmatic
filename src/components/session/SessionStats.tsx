import React from "react";
import { Session } from "../../types/Session";

interface SessionStatsProps {
  sessions: Session[];
}

const SessionStats: React.FC<SessionStatsProps> = ({ sessions }) => {
  // Calculate stats
  const today = new Date().toISOString().split("T")[0];
  const todaySessions = sessions.filter(
    (session) => session.created_at.split("T")[0] === today
  );
  const hoursToday = todaySessions
    .reduce((acc, session) => acc + session.minutes / 60, 0)
    .toFixed(1)
    .replace(/\.0$/, "");

  const averageFocus =
    todaySessions.length > 0
      ? (
          todaySessions.reduce((acc, session) => acc + session.focus, 0) /
          todaySessions.length
        )
          .toFixed(1)
          .replace(/\.0$/, "")
      : "0";

  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - 7);
  const hoursThisWeek = sessions
    .filter((session) => new Date(session.created_at) >= weekStart)
    .reduce((acc, session) => acc + session.minutes / 60, 0)
    .toFixed(1)
    .replace(/\.0$/, "");

  return (
    <div className="flex flex-col gap-4">
      <div className="bg-blue-50 rounded-lg p-4 shadow-sm border border-blue-100">
        <p className="text-2xl font-bold text-blue-800">{hoursToday}</p>
        <h3 className="text-sm font-medium text-blue-600 mt-1">hours today</h3>
      </div>

      <div className="bg-purple-50 rounded-lg p-4 shadow-sm border border-purple-100">
        <p className="text-2xl font-bold text-purple-800">{averageFocus}</p>
        <h3 className="text-sm font-medium text-purple-600 mt-1">focus</h3>
      </div>

      <div className="bg-green-50 rounded-lg p-4 shadow-sm border border-green-100">
        <p className="text-2xl font-bold text-green-800">{hoursThisWeek}</p>
        <h3 className="text-sm font-medium text-green-600 mt-1">hours week</h3>
      </div>
    </div>
  );
};

export default SessionStats;
