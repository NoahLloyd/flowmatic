import React from "react";
import { Session } from "../../types/Session";
import { useAuth } from "../../context/AuthContext";
import { useTimezone } from "../../context/TimezoneContext";

interface SessionCardProps {
  session: Session;
  small?: boolean;
  todaysHours?: number;
  todaysGoal?: number;
}

const SessionCard: React.FC<SessionCardProps> = ({
  session,
  small = false,
  todaysHours,
  todaysGoal,
}) => {
  const { user } = useAuth();
  const { formatTime } = useTimezone();

  const getDailyGoal = () => {
    const day = new Date().getDay();
    const dayNames = [
      "sunday",
      "monday",
      "tuesday",
      "wednesday",
      "thursday",
      "friday",
      "saturday",
    ];
    const dayName = dayNames[day];

    if (
      user?.preferences?.dailyHoursGoals &&
      dayName in user.preferences.dailyHoursGoals
    ) {
      return user.preferences.dailyHoursGoals[dayName];
    }
    return 4;
  };

  const dailyGoal = todaysGoal || getDailyGoal();

  const getFocusColor = (focus: number) => {
    switch (focus) {
      case 5:
        return {
          bg: "bg-indigo-100 dark:bg-indigo-900",
          text: "text-indigo-700 dark:text-indigo-200",
        };
      case 4:
        return {
          bg: "bg-green-100 dark:bg-green-900",
          text: "text-green-700 dark:text-green-200",
        };
      case 3:
        return {
          bg: "bg-yellow-100 dark:bg-yellow-900",
          text: "text-yellow-700 dark:text-yellow-200",
        };
      case 2:
        return {
          bg: "bg-orange-100 dark:bg-orange-900",
          text: "text-orange-700 dark:text-orange-200",
        };
      default:
        return {
          bg: "bg-red-100 dark:bg-red-900",
          text: "text-red-700 dark:text-red-200",
        };
    }
  };

  const focusColors = getFocusColor(session.focus);

  const formatTimeString = (timestamp: string) => {
    return formatTime(new Date(timestamp));
  };

  const timeString = formatTimeString(session.created_at);

  const focusProgressPercent =
    todaysHours && dailyGoal
      ? Math.min(100, Math.round((todaysHours / dailyGoal) * 100))
      : null;

  return (
    <div
      key={session.created_at}
      className={`bg-white dark:bg-gray-900 w-full rounded-lg border border-gray-200 dark:border-gray-800 ${
        small ? "p-3" : "p-4"
      } hover:shadow-sm transition-all hover:border-gray-300 dark:hover:border-gray-700`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span
            className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${focusColors.bg} ${focusColors.text}`}
          >
            {session.focus === 5
              ? "Flow"
              : session.focus === 4
              ? "Locked-in"
              : session.focus === 3
              ? "Attentive"
              : session.focus === 2
              ? "Browsing"
              : "Distracted"}
          </span>
          {small && (
            <span className="text-gray-700 dark:text-gray-300 text-sm">
              {session.project}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span className="text-gray-600 dark:text-gray-400">
            {timeString.charAt(0) === "0"
              ? timeString.substring(1)
              : timeString}
          </span>
          <span className="px-2 py-1 rounded-md bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-medium">
            {session.minutes}
          </span>
        </div>
      </div>

      {session.notes && (
        <p className="text-sm text-gray-700 dark:text-gray-300 mt-2 mb-1 line-clamp-2">
          {session.notes}
        </p>
      )}

      {!small && (
        <div className="flex flex-wrap gap-3 text-sm mt-3 pt-3 border-t border-gray-100 dark:border-gray-800">
          <div className="inline-flex items-center px-2.5 py-1 bg-gray-50 dark:bg-gray-800/50 rounded-md text-gray-700 dark:text-gray-300">
            <svg
              className="w-4 h-4 mr-1.5 text-gray-500 dark:text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
              />
            </svg>
            {session.project}
          </div>

          <div className="inline-flex items-center px-2.5 py-1 bg-gray-50 dark:bg-gray-800/50 rounded-md text-gray-700 dark:text-gray-300">
            <svg
              className="w-4 h-4 mr-1.5 text-gray-500 dark:text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
            {(() => {
              const endTime = new Date(session.created_at);
              const startTime = new Date(
                endTime.getTime() - session.minutes * 60 * 1000
              );
              return `${startTime.toLocaleTimeString("en-GB", {
                hour: "2-digit",
                minute: "2-digit",
                hour12: false,
              })} - ${endTime.toLocaleTimeString("en-GB", {
                hour: "2-digit",
                minute: "2-digit",
                hour12: false,
              })}`;
            })()}
          </div>

          {todaysHours !== undefined && (
            <div className="inline-flex items-center px-2.5 py-1 bg-gray-50 dark:bg-gray-800/50 rounded-md text-gray-700 dark:text-gray-300">
              <svg
                className="w-4 h-4 mr-1.5 text-gray-500 dark:text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M13 10V3L4 14h7v7l9-11h-7z"
                />
              </svg>
              <div className="flex items-center gap-1">
                <span>
                  {todaysHours.toFixed(1).replace(/\.0$/, "")}/{dailyGoal}h
                </span>
                {focusProgressPercent !== null && (
                  <span
                    className={`text-xs ml-1 px-1.5 py-0.5 rounded ${
                      focusProgressPercent >= 100
                        ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300"
                        : "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
                    }`}
                  >
                    {focusProgressPercent}%
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SessionCard;
