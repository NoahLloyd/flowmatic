import React from "react";
import { Session } from "../../types/Session";

interface SessionStatsProps {
  sessions: Session[];
}

const SessionStats: React.FC<SessionStatsProps> = ({ sessions }) => {
  // Calculate today's stats
  const today = new Date();
  today.setHours(0, 0, 0, 0); // Set to start of day

  const todaySessions = sessions.filter(
    (session) => new Date(session.created_at) >= today
  );

  const hoursToday = todaySessions.reduce(
    (acc, session) => acc + session.minutes / 60,
    0
  );

  const dailyTarget = 4; // Target hours per day

  // Calculate expected progress based on current time (9 AM - 4 PM workday)
  const now = new Date();
  const workdayStart = new Date(now);
  workdayStart.setHours(9, 0, 0, 0); // 9 AM
  const workdayEnd = new Date(now);
  workdayEnd.setHours(16, 0, 0, 0); // 4 PM

  let expectedDailyProgress = 100; // Default to 100% if after workday end

  if (now < workdayStart) {
    // Before workday starts
    expectedDailyProgress = 0;
  } else if (now < workdayEnd) {
    // During workday - calculate percentage of workday completed
    const totalWorkMinutes = 7 * 60; // 7 hours in minutes
    const minutesSinceStart =
      (now.getTime() - workdayStart.getTime()) / (1000 * 60);
    expectedDailyProgress = Math.min(
      100,
      Math.round((minutesSinceStart / totalWorkMinutes) * 100)
    );
  }

  // Calculate daily expected hours based on workday progress
  const expectedDailyHours = (dailyTarget * expectedDailyProgress) / 100;
  const todayHoursOffset = hoursToday - expectedDailyHours;

  // Remove the cap to allow exceeding 100%
  const todayProgressPercent = Math.round((hoursToday / dailyTarget) * 100);

  // Calculate weekly stats
  const weekStart = new Date();
  weekStart.setHours(0, 0, 0, 0);
  const currentDay = weekStart.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  const daysFromMonday = currentDay === 0 ? 6 : currentDay - 1; // Convert to Monday-based
  weekStart.setDate(weekStart.getDate() - daysFromMonday); // Go back to Monday

  const weekSessions = sessions.filter(
    (session) => new Date(session.created_at) >= weekStart
  );

  const hoursThisWeek = weekSessions.reduce(
    (acc, session) => acc + session.minutes / 60,
    0
  );

  // Use 7-day workweek (4 hours per day)
  const weeklyTarget = 28; // 4 hours * 7 days

  // Calculate expected hours based on days passed and current day progress
  const fullDaysPassed = daysFromMonday;
  const expectedWeeklyHours = fullDaysPassed * dailyTarget + expectedDailyHours;
  const weeklyHoursOffset = hoursThisWeek - expectedWeeklyHours;

  // Remove the cap to allow exceeding 100%
  const weeklyProgressPercent = Math.round(
    (hoursThisWeek / weeklyTarget) * 100
  );

  // How much progress should be made by now (based on day of week and time of day)
  const weeklyExpectedPercent = Math.min(
    100,
    Math.round((expectedWeeklyHours / weeklyTarget) * 100)
  );

  const hoursThisWeekFormatted = hoursThisWeek.toFixed(1).replace(/\.0$/, "");

  // Calculate yearly progress
  const yearStart = new Date(new Date().getFullYear(), 0, 1);
  const yearlyHours = sessions
    .filter((session) => new Date(session.created_at) >= yearStart)
    .reduce((acc, session) => acc + session.minutes / 60, 0);

  const yearTarget = 1500;
  const dayOfYear = Math.floor(
    (new Date().getTime() - yearStart.getTime()) / (24 * 60 * 60 * 1000)
  );

  // Calculate expected yearly progress based on days passed and current day progress
  const daysInYear = 365 + (new Date().getFullYear() % 4 === 0 ? 1 : 0); // Account for leap years
  const expectedYearlyDays = dayOfYear + expectedDailyProgress / 100;
  const expectedProgress = (expectedYearlyDays / daysInYear) * yearTarget;

  const hoursOffset = yearlyHours - expectedProgress;
  // Remove the cap to allow exceeding 100%
  const progressPercent = Math.round((yearlyHours / yearTarget) * 100);
  const yearlyExpectedPercent = Math.min(
    100,
    Math.round((expectedProgress / yearTarget) * 100)
  );

  // Helper function to create the progress bar cards
  const ProgressCard = ({
    title,
    hours,
    target,
    offset,
    progress,
    expectedProgress,
  }: {
    title: string;
    hours: number | string;
    target: number;
    offset: number;
    progress: number;
    expectedProgress: number;
  }) => (
    <div className="flex-1 relative overflow-hidden rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
      {/* Progress background - expected progress */}
      <div
        className="absolute inset-0 bg-gray-100 dark:bg-gray-800 opacity-30"
        style={{ width: `${expectedProgress}%` }}
      />

      {/* Progress background - actual progress */}
      <div
        className={`absolute inset-0 ${
          offset >= 0
            ? "bg-green-100 dark:bg-green-900/30"
            : "bg-red-100 dark:bg-red-900/30"
        }`}
        style={{ width: `${Math.min(100, progress)}%` }}
      />

      {/* Expected progress marker - vertical line */}
      <div
        className="absolute top-0 bottom-0 w-px bg-gray-400 dark:bg-gray-500"
        style={{ left: `${expectedProgress}%` }}
      />

      {/* Card content */}
      <div className="relative p-4">
        <div className="flex items-baseline gap-2">
          <p className="text-2xl font-bold text-gray-900 dark:text-white">
            {typeof hours === "number"
              ? hours.toFixed(1).replace(/\.0$/, "")
              : hours}
          </p>

          {target && (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              / {target}
            </p>
          )}

          <p
            className={`text-sm font-medium ${
              offset >= 0
                ? "text-green-600 dark:text-green-400"
                : "text-red-600 dark:text-red-400"
            }`}
          >
            ({offset >= 0 ? "+" : ""}
            {Math.round(offset)}h)
          </p>
        </div>
        <h3 className="text-xs font-medium text-gray-500 dark:text-gray-400 mt-1">
          {title} ({progress}%)
        </h3>
      </div>
    </div>
  );

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {/* Hours Today Card */}
      <ProgressCard
        title="hours today"
        hours={hoursToday}
        target={dailyTarget}
        offset={todayHoursOffset}
        progress={todayProgressPercent}
        expectedProgress={expectedDailyProgress} // Based on time of day
      />

      {/* Hours This Week Card */}
      <ProgressCard
        title="hours week"
        hours={hoursThisWeekFormatted}
        target={weeklyTarget}
        offset={weeklyHoursOffset}
        progress={weeklyProgressPercent}
        expectedProgress={weeklyExpectedPercent}
      />

      {/* Hours This Year Card */}
      <ProgressCard
        title="hours year"
        hours={Math.round(yearlyHours)}
        target={yearTarget}
        offset={hoursOffset}
        progress={progressPercent}
        expectedProgress={yearlyExpectedPercent}
      />
    </div>
  );
};

export default SessionStats;
