import React from "react";
import { Session } from "../../types/Session";

interface SessionStatsProps {
  sessions: Session[];
}

const SessionStats: React.FC<SessionStatsProps> = ({ sessions }) => {
  // Calculate weekly stats
  const weekStart = new Date();
  weekStart.setHours(0, 0, 0, 0); // Set to start of day (00:00:00)
  const currentDay = weekStart.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  const daysFromMonday = currentDay === 0 ? 6 : currentDay - 1; // Convert to Monday-based
  weekStart.setDate(weekStart.getDate() - daysFromMonday); // Go back to Monday

  const weekSessions = sessions.filter(
    (session) => new Date(session.created_at) >= weekStart
  );

  const hoursThisWeek = weekSessions
    .reduce((acc, session) => acc + session.minutes / 60, 0)
    .toFixed(1)
    .replace(/\.0$/, "");

  const averageFocusWeek =
    weekSessions.length > 0
      ? (
          weekSessions.reduce((acc, session) => acc + session.focus, 0) /
          weekSessions.length
        )
          .toFixed(1)
          .replace(/\.0$/, "")
      : "0";

  // Calculate yearly progress
  const yearStart = new Date(new Date().getFullYear(), 0, 1);
  const yearlyHours = sessions
    .filter((session) => new Date(session.created_at) >= yearStart)
    .reduce((acc, session) => acc + session.minutes / 60, 0);

  const yearTarget = 1500;
  const dayOfYear = Math.floor(
    (new Date().getTime() - yearStart.getTime()) / (24 * 60 * 60 * 1000)
  );
  const expectedProgress = (dayOfYear / 365) * yearTarget;
  const hoursOffset = Math.round(yearlyHours - expectedProgress);
  const progressPercent = Math.round((yearlyHours / yearTarget) * 100);

  return (
    <div className="flex gap-4">
      <div className="flex-1 bg-blue-50 dark:bg-blue-900 rounded-lg p-4 shadow-sm border border-blue-100 dark:border-blue-800">
        <p className="text-2xl font-bold text-blue-800 dark:text-blue-100">
          {hoursThisWeek}
        </p>
        <h3 className="text-sm font-medium text-blue-600 dark:text-blue-300 mt-1">
          hours this week
        </h3>
      </div>

      <div className="flex-1 bg-purple-50 dark:bg-purple-900 rounded-lg p-4 shadow-sm border border-purple-100 dark:border-purple-800">
        <p className="text-2xl font-bold text-purple-800 dark:text-purple-100">
          {averageFocusWeek}
        </p>
        <h3 className="text-sm font-medium text-purple-600 dark:text-purple-300 mt-1">
          focus this week
        </h3>
      </div>

      <div className="flex-1 bg-green-50 dark:bg-green-900 rounded-lg p-4 shadow-sm border border-green-100 dark:border-green-800">
        <div className="flex items-baseline gap-2">
          <p className="text-2xl font-bold text-green-800 dark:text-green-100">
            {Math.round(yearlyHours)}
          </p>
          <p className="text-sm text-green-600 dark:text-green-300">
            / {yearTarget}
          </p>
          <p
            className={`text-sm font-medium ${
              hoursOffset >= 0
                ? "text-green-600 dark:text-green-300"
                : "text-red-600 dark:text-red-300"
            }`}
          >
            ({hoursOffset >= 0 ? "+" : ""}
            {hoursOffset}h)
          </p>
        </div>
        <h3 className="text-sm font-medium text-green-600 dark:text-green-300 mt-1">
          hours this year ({progressPercent}%)
        </h3>
      </div>
    </div>
  );
};

export default SessionStats;
