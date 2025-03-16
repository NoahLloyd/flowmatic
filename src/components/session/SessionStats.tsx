import React from "react";
import { Session } from "../../types/Session";
import { useAuth } from "../../context/AuthContext";

interface SessionStatsProps {
  sessions: Session[];
}

const SessionStats: React.FC<SessionStatsProps> = ({ sessions }) => {
  const { user } = useAuth();

  // Get user daily goals or use default value (4)
  const getDailyTarget = () => {
    // Get the current day of week (0 = Sunday, 1 = Monday, etc.)
    const day = new Date().getDay();
    // Convert to our day format (monday, tuesday, etc.)
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

    // Get daily hours goals from user preferences or use default
    if (
      user?.preferences?.dailyHoursGoals &&
      dayName in user.preferences.dailyHoursGoals
    ) {
      return user.preferences.dailyHoursGoals[dayName];
    }
    return 4; // Default if not set
  };

  // Get user yearly goal or use default
  const getYearlyTarget = () => {
    if (user?.preferences?.yearlyHoursGoal?.hoursPerYear) {
      return user.preferences.yearlyHoursGoal.hoursPerYear;
    }
    return 1400; // Default if not set
  };

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

  const dailyTarget = getDailyTarget(); // Get user's daily target

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

  // Calculate weekly target based on daily goals for each day of the week
  const getWeeklyTarget = () => {
    // If user doesn't have preferences, use default (4 hours * 7 days)
    if (!user?.preferences?.dailyHoursGoals) {
      return 28;
    }

    // Sum up the daily goals for each day of the week
    const dayNames = [
      "monday",
      "tuesday",
      "wednesday",
      "thursday",
      "friday",
      "saturday",
      "sunday",
    ];
    return dayNames.reduce((sum, day) => {
      return sum + (user.preferences.dailyHoursGoals[day] || 4);
    }, 0);
  };

  const weeklyTarget = getWeeklyTarget();

  const weekSessions = sessions.filter(
    (session) => new Date(session.created_at) >= weekStart
  );

  const hoursThisWeek = weekSessions.reduce(
    (acc, session) => acc + session.minutes / 60,
    0
  );

  // Calculate expected hours based on days passed and current day progress
  const fullDaysPassed = daysFromMonday;

  // Calculate expected weekly hours based on specific daily targets for passed days
  const calculateExpectedWeeklyHours = () => {
    if (!user?.preferences?.dailyHoursGoals) {
      return fullDaysPassed * 4 + expectedDailyHours; // Default calculation
    }

    // Get the days that have passed this week
    const dayNames = [
      "monday",
      "tuesday",
      "wednesday",
      "thursday",
      "friday",
      "saturday",
      "sunday",
    ];
    const passedDays = dayNames.slice(0, daysFromMonday);

    // Sum up target hours for passed days
    const passedDaysSum = passedDays.reduce((sum, day) => {
      return sum + (user.preferences.dailyHoursGoals[day] || 4);
    }, 0);

    // Add expected hours for current day
    return passedDaysSum + expectedDailyHours;
  };

  const expectedWeeklyHours = calculateExpectedWeeklyHours();
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
  // Get the user's configured year start date or default to Jan 1
  const getYearStartDate = () => {
    if (user?.preferences?.yearlyHoursGoal?.startDate) {
      return new Date(user.preferences.yearlyHoursGoal.startDate);
    }
    return new Date(new Date().getFullYear(), 0, 1); // Default to Jan 1
  };

  const yearStart = getYearStartDate();
  const yearlyHours = sessions
    .filter((session) => new Date(session.created_at) >= yearStart)
    .reduce((acc, session) => acc + session.minutes / 60, 0);

  const yearTarget = getYearlyTarget(); // Get user's yearly target

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
