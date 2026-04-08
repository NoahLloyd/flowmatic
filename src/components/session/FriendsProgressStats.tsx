import React, { useState, useEffect, useCallback } from "react";
import { Session } from "../../types/Session";
import { useAuth } from "../../context/AuthContext";
import { api } from "../../utils/api";
import {
  ChevronLeft,
  ChevronRight,
  Calendar,
  Clock,
  Brain,
} from "lucide-react";
import SessionEditModal from "./SessionEditModal";
import { format, isToday, addDays, subDays, startOfDay } from "date-fns";

interface FriendStats {
  todayHours: number;
  weekHours: number;
  yearHours: number;
  todayTarget: number;
  weeklyTarget: number;
  yearlyTarget: number;
  todayOffset: number;
  weeklyOffset: number;
  yearlyOffset: number;
  todayProgress: number;
  weeklyProgress: number;
  yearlyProgress: number;
  todayExpectedProgress: number;
  weeklyExpectedProgress: number;
  yearlyExpectedProgress: number;
  activities: string[];
  todaySessions?: Session[]; // Add sessions for detailed visualization
  averageFocus: number;
}

// Create a separate component for daily session visualization
const DailySessionBar = ({
  sessions,
  target,
  expectedProgress,
  onSessionClick,
}: {
  sessions: Session[];
  target: number;
  expectedProgress: number;
  onSessionClick?: (session: Session) => void;
}) => {
  // Sort sessions by created_at
  const sortedSessions = [...sessions].sort(
    (a, b) =>
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );

  // Calculate total hours
  const totalMinutes = sortedSessions.reduce(
    (acc, session) => acc + session.minutes,
    0
  );

  const totalHours = totalMinutes / 60;

  // Get start and end time information
  const firstSessionStart =
    sortedSessions.length > 0 ? new Date(sortedSessions[0].created_at) : null;

  // If we have a first session, subtract its minutes to get the actual start time
  if (firstSessionStart && sortedSessions.length > 0) {
    firstSessionStart.setMinutes(
      firstSessionStart.getMinutes() - sortedSessions[0].minutes
    );
  }

  // Last session time is simply when it was created
  const lastSessionTime =
    sortedSessions.length > 0
      ? new Date(sortedSessions[sortedSessions.length - 1].created_at)
      : null;

  // Format times as HH:MM in 24h format
  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  };

  const startTimeDisplay = firstSessionStart
    ? formatTime(firstSessionStart)
    : "";
  const endTimeDisplay = lastSessionTime ? formatTime(lastSessionTime) : "";

  // Determine scale factor
  // If total hours <= target, each hour takes 1/target of the width
  // If total hours > target, each hour takes 1/totalHours of the width
  const scaleFactor = totalHours <= target ? target : totalHours;

  // Process sessions to maintain individual backgrounds but group for project name display
  const processedSessions = sortedSessions.map((session, index) => {
    const project = session.project || session.task || "Focus session";
    const hours = session.minutes / 60;
    const widthPercent = (hours / scaleFactor) * 100;

    // Check if this session has the same project as the previous one
    const prevProject =
      index > 0
        ? sortedSessions[index - 1].project ||
          sortedSessions[index - 1].task ||
          "Focus session"
        : null;

    // Check if this session has the same project as the next one
    const nextProject =
      index < sortedSessions.length - 1
        ? sortedSessions[index + 1].project ||
          sortedSessions[index + 1].task ||
          "Focus session"
        : null;

    const isPartOfGroup = prevProject === project || nextProject === project;
    const isStartOfGroup = prevProject !== project && nextProject === project;
    const isEndOfGroup = prevProject === project && nextProject !== project;
    const isMiddleOfGroup = prevProject === project && nextProject === project;
    const isStandaloneInGroup =
      !isStartOfGroup && !isEndOfGroup && !isMiddleOfGroup;

    return {
      session,
      project,
      widthPercent,
      hours,
      showLeftDivider: index > 0 && prevProject !== project,
      isPartOfGroup,
      isStartOfGroup,
      isEndOfGroup,
      isMiddleOfGroup,
      isStandaloneInGroup,
    };
  });

  // Group sessions by project for project name display
  const projectGroups: {
    project: string;
    startIndex: number;
    endIndex: number;
    totalWidth: number;
  }[] = [];

  let currentGroup: {
    project: string;
    startIndex: number;
    endIndex: number;
    totalWidth: number;
  } | null = null;

  processedSessions.forEach((session, index) => {
    if (!currentGroup || currentGroup.project !== session.project) {
      // Start a new group
      if (currentGroup) {
        projectGroups.push(currentGroup);
      }
      currentGroup = {
        project: session.project,
        startIndex: index,
        endIndex: index,
        totalWidth: session.widthPercent,
      };
    } else {
      // Extend the current group
      currentGroup.endIndex = index;
      currentGroup.totalWidth += session.widthPercent;
    }
  });

  // Add the last group
  if (currentGroup) {
    projectGroups.push(currentGroup);
  }

  // Function to get background color based on focus level
  const getFocusBackground = (focus: number) => {
    switch (focus) {
      case 5:
        return "bg-indigo-100 dark:bg-indigo-900";
      case 4:
        return "bg-green-100 dark:bg-green-900";
      case 3:
        return "bg-yellow-100 dark:bg-yellow-900";
      case 2:
        return "bg-orange-100 dark:bg-orange-900";
      case 1:
        return "bg-red-100 dark:bg-red-900";
      default:
        return "bg-gray-100 dark:bg-gray-800/50";
    }
  };

  // Calculate total progress percentage for the expected marker
  const totalProgress = Math.min(100, (totalHours / target) * 100);

  return (
    <div className="w-full rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 h-[100px] relative overflow-hidden">
      {/* Background for entire bar */}
      <div className="absolute inset-0 bg-gray-50 dark:bg-gray-900"></div>

      {/* Expected progress marker */}
      <div
        className="absolute top-0 bottom-0 w-px bg-gray-400 dark:bg-gray-500 z-20"
        style={{ left: `${expectedProgress}%` }}
      />

      {/* Session segments */}
      <div className="absolute inset-0 flex">
        {processedSessions.map((item, idx) => {
          const { session, widthPercent, showLeftDivider } = item;
          const focusBg = getFocusBackground(session.focus);

          return (
            <div
              key={idx}
              className={`h-full relative ${focusBg} ${
                onSessionClick
                  ? "cursor-pointer hover:opacity-80 transition-opacity"
                  : ""
              } group/session`}
              style={{ width: `${widthPercent}%` }}
              onClick={
                onSessionClick ? () => onSessionClick(session) : undefined
              }
            >
              {/* Only show divider if it's not the same project as previous */}
              {showLeftDivider && (
                <div className="absolute left-0 top-0 bottom-0 w-px bg-gray-200 dark:bg-gray-800 z-10"></div>
              )}
              {/* Hover tooltip */}
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 hidden group-hover/session:block z-30 pointer-events-none">
                <div className="bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 text-xs rounded-md px-2.5 py-1.5 whitespace-nowrap shadow-lg">
                  {session.task && <div className="font-medium mb-0.5">{session.task}</div>}
                  <div className="flex items-center gap-1.5">
                    <span>{session.project || "No project"}</span>
                    <span className="opacity-40">&middot;</span>
                    <span>{session.minutes}m</span>
                    <span className="opacity-40">&middot;</span>
                    <span>Focus {session.focus}/5</span>
                  </div>
                  {session.notes && <div className="text-gray-300 dark:text-gray-600 mt-0.5">{session.notes}</div>}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Project names overlay - one label per project group */}
      <div className="absolute inset-0 pointer-events-none">
        {projectGroups.map((group, idx) => {
          // Only show labels for groups with sufficient width
          if (group.totalWidth <= 10) return null;

          // Calculate the left position as the sum of widths of all previous sessions
          const leftPosition = processedSessions
            .slice(0, group.startIndex)
            .reduce((sum, item) => sum + item.widthPercent, 0);

          return (
            <div
              key={idx}
              className="absolute top-0 bottom-0 flex items-center justify-center"
              style={{
                left: `${leftPosition}%`,
                width: `${group.totalWidth}%`,
              }}
            >
              <span className="text-xs font-medium text-gray-800 dark:text-gray-200 truncate px-2 z-10">
                {group.project}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// Create separate component for day progress
const DayProgress = ({
  stats,
  onSessionClick,
}: {
  stats: FriendStats;
  onSessionClick?: (session: Session) => void;
}) => {
  const hours = stats.todayHours;
  const target = stats.todayTarget;
  const offset = stats.todayOffset;
  const progress = stats.todayProgress;
  const expectedProgress = stats.todayExpectedProgress;

  // Format hours for display at the top of the card
  const formattedHours =
    typeof hours === "number" ? hours.toFixed(1).replace(/\.0$/, "") : hours;
  const formattedOffset = Math.round(offset);
  const offsetDisplay = `(${offset >= 0 ? "+" : ""}${formattedOffset}h)`;
  const offsetClass =
    offset >= 0
      ? "text-green-600 dark:text-green-400"
      : "text-red-600 dark:text-red-400";

  // If we have detailed session data, use the new DailySessionBar component
  if (stats.todaySessions && stats.todaySessions.length > 0) {
    return (
      <div className="h-auto">
        <DailySessionBar
          sessions={stats.todaySessions}
          target={target}
          expectedProgress={expectedProgress}
          onSessionClick={onSessionClick}
        />
      </div>
    );
  }

  // Fall back to simplified version if no session data
  return (
    <div className="w-full rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 h-[100px] relative overflow-hidden">
      {/* Expected progress background */}
      <div
        className="absolute inset-0 bg-gray-100 dark:bg-gray-800 opacity-30"
        style={{ width: `${expectedProgress}%` }}
      />

      {/* Actual progress background */}
      <div
        className={`absolute inset-0 ${
          offset >= 0
            ? "bg-green-100 dark:bg-green-900/30"
            : "bg-red-100 dark:bg-red-900/30"
        }`}
        style={{ width: `${Math.min(100, progress)}%` }}
      />

      {/* Expected marker */}
      <div
        className="absolute top-0 bottom-0 w-px bg-gray-400 dark:bg-gray-500 z-10"
        style={{ left: `${expectedProgress}%` }}
      />

      {/* Main content */}
      <div className="relative flex items-center justify-between px-4 h-full">
        {/* Project names shown in smaller text */}
        <div className="text-xs font-medium text-gray-800 dark:text-gray-200 overflow-hidden">
          {stats.activities.length > 0 ? (
            <>
              {stats.activities[0]}
              {stats.activities.length > 1 && ", ..."}
            </>
          ) : (
            "-"
          )}
        </div>
      </div>
    </div>
  );
};

const FriendsProgressStats: React.FC = () => {
  const { user } = useAuth();
  const [statsData, setStatsData] = useState<Record<string, FriendStats>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<Date>(
    startOfDay(new Date())
  );
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);

  // Internal session data (self-sufficient — no longer depends on parent)
  const [recentSessions, setRecentSessions] = useState<Session[]>([]);
  const [yearHours, setYearHours] = useState<number>(0);

  // Get year start date from user preferences
  const getYearStartDate = useCallback(() => {
    if (user?.preferences?.yearlyHoursGoal?.startDate) {
      return new Date(user.preferences.yearlyHoursGoal.startDate);
    }
    return new Date(new Date().getFullYear(), 0, 1);
  }, [user?.preferences?.yearlyHoursGoal?.startDate]);

  // Fetch session data (targeted queries instead of loading everything)
  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true);
      const now = new Date();

      // Calculate how far back we need full session objects
      // Need at least 7 days for history dots, and potentially further for selectedDate
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      sevenDaysAgo.setHours(0, 0, 0, 0);

      const selectedDayStart = startOfDay(selectedDate);
      const fetchFrom =
        selectedDayStart < sevenDaysAgo ? selectedDayStart : sevenDaysAgo;

      const yearStart = getYearStartDate();

      // Fetch recent sessions (full objects) and year hours (lightweight) in parallel
      const [sessions, yearHrs] = await Promise.all([
        api.getSessionsByDateRange(fetchFrom.toISOString(), now.toISOString()),
        api.getSessionHoursSince(yearStart.toISOString()),
      ]);

      setRecentSessions(sessions);
      setYearHours(yearHrs);
    } catch (error) {
      console.error("Failed to fetch progress data:", error);
    } finally {
      setIsLoading(false);
    }
  }, [selectedDate, getYearStartDate]);

  // Fetch data on mount and when dependencies change
  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [fetchData, user]);

  // Listen for session created/updated/deleted events to refresh
  useEffect(() => {
    const handler = () => fetchData();
    window.addEventListener("sessionCreated", handler);
    window.addEventListener("sessionUpdated", handler);
    window.addEventListener("sessionDeleted", handler);
    return () => {
      window.removeEventListener("sessionCreated", handler);
      window.removeEventListener("sessionUpdated", handler);
      window.removeEventListener("sessionDeleted", handler);
    };
  }, [fetchData]);

  // Detect day change when app regains focus (e.g. coming back to office next morning)
  useEffect(() => {
    let lastCheckedDay = startOfDay(new Date()).getTime();

    const checkDayChange = () => {
      const today = startOfDay(new Date()).getTime();
      if (today !== lastCheckedDay) {
        lastCheckedDay = today;
        setSelectedDate(startOfDay(new Date()));
      }
    };

    // Check on visibility change (tab/window regains focus)
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        checkDayChange();
      }
    };

    // Also check on window focus (Electron app brought to foreground)
    const onFocus = () => checkDayChange();

    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("focus", onFocus);

    // Periodic check every 5 minutes as a fallback
    const interval = setInterval(checkDayChange, 5 * 60 * 1000);

    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("focus", onFocus);
      clearInterval(interval);
    };
  }, []);

  // Calculate stats when data changes
  useEffect(() => {
    if (recentSessions !== undefined) {
      calculateUserStats();
    }
  }, [recentSessions, yearHours, selectedDate]);

  // Calculate user stats from fetched data
  const calculateUserStats = () => {
    // Get daily target (match SessionStats implementation)
    const getDailyTarget = (date: Date) => {
      const day = date.getDay();
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
      return 4; // Default if not set
    };

    // Get weekly target
    const getWeeklyTarget = () => {
      if (!user?.preferences?.dailyHoursGoals) {
        return 28; // Default 4 hours * 7 days
      }

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

    // Get yearly target
    const getYearlyTarget = () => {
      if (user?.preferences?.yearlyHoursGoal?.hoursPerYear) {
        return user.preferences.yearlyHoursGoal.hoursPerYear;
      }
      return 1400; // Default if not set
    };

    // Selected date's stats
    const dayStart = startOfDay(selectedDate);
    const dayEnd = addDays(dayStart, 1);

    const daySessions = recentSessions.filter((session) => {
      const sessionDate = new Date(session.created_at);
      return sessionDate >= dayStart && sessionDate < dayEnd;
    });

    const hoursOnDay = daySessions.reduce(
      (acc, session) => acc + session.minutes / 60,
      0
    );

    // Calculate weighted average focus for the day
    const totalMinutesOnDay = daySessions.reduce(
      (acc, session) => acc + session.minutes,
      0
    );
    const weightedFocusSum = daySessions.reduce(
      (acc, session) => acc + session.focus * session.minutes,
      0
    );
    const averageFocus =
      totalMinutesOnDay > 0
        ? Number((weightedFocusSum / totalMinutesOnDay).toFixed(1))
        : 0;

    // Get activities for the selected day
    const activities = daySessions
      .map((session) => session.task || session.project || "Focus session")
      .filter((activity, index, self) => self.indexOf(activity) === index)
      .slice(0, 3); // Limit to 3 recent activities

    // Better activity tracking based on actual project names to match the screenshot
    const projectMinutes = daySessions.reduce(
      (acc: Record<string, number>, session) => {
        const projectName = session.project || session.task || "Flow";
        if (!acc[projectName]) {
          acc[projectName] = 0;
        }
        acc[projectName] += session.minutes;
        return acc;
      },
      {}
    );

    // Get projects sorted by minutes
    const sortedProjects = Object.entries(projectMinutes)
      .sort(([, aMinutes], [, bMinutes]) => bMinutes - aMinutes)
      .map(([name]) => name);

    // Calculate expected progress based on time of day (9 AM - 4 PM workday)
    // Only apply expected progress if viewing today, otherwise show 100% expected
    const isViewingToday = isToday(selectedDate);
    let expectedDailyProgress = 100; // Default to 100% if not viewing today or after workday end

    if (isViewingToday) {
      const now = new Date();
      const workdayStart = new Date(now);
      workdayStart.setHours(9, 0, 0, 0); // 9 AM
      const workdayEnd = new Date(now);
      workdayEnd.setHours(16, 0, 0, 0); // 4 PM

      if (now < workdayStart) {
        expectedDailyProgress = 0;
      } else if (now < workdayEnd) {
        const totalWorkMinutes = 7 * 60; // 7 hours in minutes
        const minutesSinceStart =
          (now.getTime() - workdayStart.getTime()) / (1000 * 60);
        expectedDailyProgress = Math.min(
          100,
          Math.round((minutesSinceStart / totalWorkMinutes) * 100)
        );
      }
    }

    const dailyTarget = getDailyTarget(selectedDate);
    const expectedDailyHours = (dailyTarget * expectedDailyProgress) / 100;
    const dayHoursOffset = hoursOnDay - expectedDailyHours;
    const dayProgressPercent = Math.round((hoursOnDay / dailyTarget) * 100);

    // Weekly stats
    const weekStart = new Date();
    weekStart.setHours(0, 0, 0, 0);
    const currentDay = weekStart.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
    const daysFromMonday = currentDay === 0 ? 6 : currentDay - 1; // Convert to Monday-based
    weekStart.setDate(weekStart.getDate() - daysFromMonday); // Go back to Monday

    const weekSessions = recentSessions.filter(
      (session) => new Date(session.created_at) >= weekStart
    );

    const hoursThisWeek = weekSessions.reduce(
      (acc, session) => acc + session.minutes / 60,
      0
    );

    // Calculate expected weekly hours
    const calculateExpectedWeeklyHours = () => {
      if (!user?.preferences?.dailyHoursGoals) {
        return daysFromMonday * 4 + expectedDailyHours; // Default calculation
      }

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

      const passedDaysSum = passedDays.reduce((sum, day) => {
        return sum + (user.preferences.dailyHoursGoals[day] || 4);
      }, 0);

      return passedDaysSum + expectedDailyHours;
    };

    const weeklyTarget = getWeeklyTarget();
    const expectedWeeklyHours = calculateExpectedWeeklyHours();
    const weeklyHoursOffset = hoursThisWeek - expectedWeeklyHours;
    const weeklyProgressPercent = Math.round(
      (hoursThisWeek / weeklyTarget) * 100
    );
    const weeklyExpectedPercent = Math.min(
      100,
      Math.round((expectedWeeklyHours / weeklyTarget) * 100)
    );

    // Yearly stats — yearHours is fetched server-side (lightweight, only minutes column)
    const yearStart = getYearStartDate();
    const yearlyHours = yearHours;

    const yearlyTarget = getYearlyTarget();
    const dayOfYear = Math.floor(
      (new Date().getTime() - yearStart.getTime()) / (24 * 60 * 60 * 1000)
    );

    const daysInYear = 365 + (new Date().getFullYear() % 4 === 0 ? 1 : 0); // Account for leap years
    const expectedYearlyDays = dayOfYear + expectedDailyProgress / 100;
    const expectedYearlyProgress =
      (expectedYearlyDays / daysInYear) * yearlyTarget;

    const yearlyHoursOffset = yearlyHours - expectedYearlyProgress;
    const yearlyProgressPercent = Math.round(
      (yearlyHours / yearlyTarget) * 100
    );
    const yearlyExpectedPercent = Math.min(
      100,
      Math.round((expectedYearlyProgress / yearlyTarget) * 100)
    );

    // Set the user's stats
    setStatsData({
      [user?.id || "you"]: {
        todayHours: hoursOnDay,
        weekHours: hoursThisWeek,
        yearHours: yearlyHours,
        todayTarget: dailyTarget,
        weeklyTarget,
        yearlyTarget,
        todayOffset: dayHoursOffset,
        weeklyOffset: weeklyHoursOffset,
        yearlyOffset: yearlyHoursOffset,
        todayProgress: dayProgressPercent,
        weeklyProgress: weeklyProgressPercent,
        yearlyProgress: yearlyProgressPercent,
        todayExpectedProgress: expectedDailyProgress,
        weeklyExpectedProgress: weeklyExpectedPercent,
        yearlyExpectedProgress: yearlyExpectedPercent,
        activities: sortedProjects.length > 0 ? sortedProjects : activities,
        todaySessions: daySessions, // Add actual session data for detailed visualization
        averageFocus,
      },
    });
  };

  // Color functions for pills (matching SessionsOverview style)
  const getFocusColor = (focus: number) => {
    if (focus < 2)
      return {
        bg: "bg-red-100 dark:bg-red-900",
        text: "text-red-700 dark:text-red-200",
      };
    if (focus < 3)
      return {
        bg: "bg-orange-100 dark:bg-orange-900",
        text: "text-orange-700 dark:text-orange-200",
      };
    if (focus < 4)
      return {
        bg: "bg-yellow-100 dark:bg-yellow-900",
        text: "text-yellow-700 dark:text-yellow-200",
      };
    if (focus < 4.5)
      return {
        bg: "bg-green-100 dark:bg-green-900",
        text: "text-green-700 dark:text-green-200",
      };
    return {
      bg: "bg-indigo-100 dark:bg-indigo-900",
      text: "text-indigo-700 dark:text-indigo-200",
    };
  };

  const getHoursColor = (hours: number, date: Date) => {
    // Get the daily goal for this specific day
    const getDailyGoalForDate = (date: Date) => {
      const day = date.getDay();
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
      return 4; // Default if not set
    };

    const dailyGoal = getDailyGoalForDate(date);

    // Calculate percentage of goal achieved
    const percentage = (hours / dailyGoal) * 100;

    // Color based on percentage of goal
    if (percentage < 25)
      return {
        bg: "bg-red-100 dark:bg-red-900",
        text: "text-red-700 dark:text-red-200",
      };
    if (percentage < 50)
      return {
        bg: "bg-orange-100 dark:bg-orange-900",
        text: "text-orange-700 dark:text-orange-200",
      };
    if (percentage < 75)
      return {
        bg: "bg-yellow-100 dark:bg-yellow-900",
        text: "text-yellow-700 dark:text-yellow-200",
      };
    if (percentage < 100)
      return {
        bg: "bg-green-100 dark:bg-green-900",
        text: "text-green-700 dark:text-green-200",
      };
    return {
      bg: "bg-indigo-100 dark:bg-indigo-900",
      text: "text-indigo-700 dark:text-indigo-200",
    };
  };

  const WeekYearProgress = ({ stats }: { stats: FriendStats }) => {
    return (
      <div className="grid grid-cols-2 gap-3">
        {/* Week progress */}
        <div className="relative overflow-hidden rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
          {/* Background / expected progress */}
          <div
            className="absolute inset-0 bg-gray-100 dark:bg-gray-800 opacity-30"
            style={{ width: `${stats.weeklyExpectedProgress}%` }}
          />

          {/* Actual progress */}
          <div
            className={`absolute inset-0 ${
              stats.weeklyOffset >= 0
                ? "bg-green-100 dark:bg-green-900/30"
                : "bg-red-100 dark:bg-red-900/30"
            }`}
            style={{ width: `${Math.min(100, stats.weeklyProgress)}%` }}
          />

          {/* Expected marker */}
          <div
            className="absolute top-0 bottom-0 w-px bg-gray-400 dark:bg-gray-500"
            style={{ left: `${stats.weeklyExpectedProgress}%` }}
          />

          {/* Content */}
          <div className="relative p-3">
            <div className="flex items-baseline gap-1">
              <span className="text-xl font-bold text-gray-900 dark:text-white">
                {typeof stats.weekHours === "number"
                  ? stats.weekHours.toFixed(1).replace(/\.0$/, "")
                  : stats.weekHours}
              </span>
              <span className="text-xs text-gray-500 dark:text-gray-400">
                / {stats.weeklyTarget}
              </span>
              <span
                className={`text-xs font-medium ${
                  stats.weeklyOffset >= 0
                    ? "text-green-600 dark:text-green-400"
                    : "text-red-600 dark:text-red-400"
                }`}
              >
                ({stats.weeklyOffset >= 0 ? "+" : ""}
                {Math.round(stats.weeklyOffset)}h)
              </span>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              hours week ({stats.weeklyProgress}%)
            </p>
          </div>
        </div>

        {/* Year progress - similar styling to week */}
        <div className="relative overflow-hidden rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
          {/* Background / expected progress */}
          <div
            className="absolute inset-0 bg-gray-100 dark:bg-gray-800 opacity-30"
            style={{ width: `${stats.yearlyExpectedProgress}%` }}
          />

          {/* Actual progress */}
          <div
            className={`absolute inset-0 ${
              stats.yearlyOffset >= 0
                ? "bg-green-100 dark:bg-green-900/30"
                : "bg-red-100 dark:bg-red-900/30"
            }`}
            style={{ width: `${Math.min(100, stats.yearlyProgress)}%` }}
          />

          {/* Expected marker */}
          <div
            className="absolute top-0 bottom-0 w-px bg-gray-400 dark:bg-gray-500"
            style={{ left: `${stats.yearlyExpectedProgress}%` }}
          />

          {/* Content */}
          <div className="relative p-3">
            <div className="flex items-baseline gap-1">
              <span className="text-xl font-bold text-gray-900 dark:text-white">
                {typeof stats.yearHours === "number"
                  ? Math.round(stats.yearHours).toString()
                  : stats.yearHours}
              </span>
              <span className="text-xs text-gray-500 dark:text-gray-400">
                / {stats.yearlyTarget}
              </span>
              <span
                className={`text-xs font-medium ${
                  stats.yearlyOffset >= 0
                    ? "text-green-600 dark:text-green-400"
                    : "text-red-600 dark:text-red-400"
                }`}
              >
                ({stats.yearlyOffset >= 0 ? "+" : ""}
                {Math.round(stats.yearlyOffset)}h)
              </span>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              hours year ({stats.yearlyProgress}%)
            </p>
          </div>
        </div>
      </div>
    );
  };

  // Render GitHub-like history visualization for the last 7 days
  const renderSessionsHistory = () => {
    // Create an array of the past 7 days
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const date = new Date();
      date.setHours(0, 0, 0, 0);
      date.setDate(date.getDate() - 6 + i);
      return date;
    });

    // Get daily goal helper
    const getDailyGoalForDate = (date: Date) => {
      const day = date.getDay();
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
      return 4; // Default if not set
    };

    // Calculate hours for each day
    const dayData = last7Days.map((date) => {
      const dayStart = startOfDay(date);
      const dayEnd = addDays(dayStart, 1);

      const daySessions = recentSessions.filter((session) => {
        const sessionDate = new Date(session.created_at);
        return sessionDate >= dayStart && sessionDate < dayEnd;
      });

      const hours = daySessions.reduce(
        (acc, session) => acc + session.minutes / 60,
        0
      );

      const goal = getDailyGoalForDate(date);
      const percentage = goal > 0 ? (hours / goal) * 100 : 0;

      return {
        date,
        hours,
        goal,
        percentage,
        dayLetter: date
          .toLocaleDateString("en-US", { weekday: "short" })
          .charAt(0),
      };
    });

    return (
      <div className="flex">
        {dayData.map((day, index) => {
          let bgColor = "bg-gray-200 dark:bg-gray-800";

          if (day.hours > 0) {
            if (day.percentage >= 100) {
              // At or above goal - fully green
              bgColor = "bg-green-500 dark:bg-green-900";
            } else if (day.percentage >= 80) {
              // Close to goal - lighter green
              bgColor = "bg-green-400 dark:bg-green-800";
            } else if (day.percentage >= 60) {
              // Getting there - yellow
              bgColor = "bg-yellow-400 dark:bg-yellow-900";
            } else if (day.percentage >= 40) {
              // Some progress - orange
              bgColor = "bg-orange-400 dark:bg-orange-900";
            } else if (day.percentage >= 20) {
              // Little progress - light red
              bgColor = "bg-red-400 dark:bg-red-800";
            } else {
              // Very little - darker red
              bgColor = "bg-red-500 dark:bg-red-900";
            }
          } else {
            // No hours recorded - completely red
            bgColor = "bg-red-500 dark:bg-red-900";
          }

          return (
            <div
              key={index}
              className={`w-4 h-4 mx-0.5 ${bgColor} rounded-sm flex items-center justify-center text-xs font-medium`}
              title={`${format(day.date, "MMM d")}: ${day.hours.toFixed(
                1
              )}h / ${day.goal}h (${Math.round(day.percentage)}%)`}
            >
              {/* No text in the small squares to keep it clean */}
            </div>
          );
        })}
      </div>
    );
  };

  // Date navigation handlers
  const goToPreviousDay = () => {
    setSelectedDate((prev) => subDays(prev, 1));
  };

  const goToNextDay = () => {
    const nextDay = addDays(selectedDate, 1);
    // Don't allow navigating to future dates
    if (nextDay <= startOfDay(new Date())) {
      setSelectedDate(nextDay);
    }
  };

  const goToToday = () => {
    setSelectedDate(startOfDay(new Date()));
  };

  // Session edit handlers
  const handleSessionClick = (session: Session) => {
    setSelectedSession(session);
  };

  const handleSaveSession = async (updatedSession: Session) => {
    try {
      await api.updateSession(updatedSession.id, updatedSession);
      window.dispatchEvent(new CustomEvent("sessionUpdated"));
    } catch (error) {
      console.error("Failed to update session:", error);
    }
  };

  const handleDeleteSession = async () => {
    if (!selectedSession) return;
    try {
      await api.deleteSession(selectedSession.id);
      window.dispatchEvent(new CustomEvent("sessionDeleted"));
    } catch (error) {
      console.error("Failed to delete session:", error);
    }
  };

  const isViewingToday = isToday(selectedDate);
  const canGoForward = !isViewingToday;

  return (
    <div className="space-y-6">
      {/* User's card */}
      {statsData[user?.id || "you"] && (
        <div className="rounded-lg border border-gray-200 dark:border-gray-800 overflow-hidden h-full">
          <div className="card-header border-b border-gray-200 dark:border-gray-800 px-5 py-2.5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h2 className="text-sm font-medium text-gray-900 dark:text-white">
                Sessions
              </h2>
              {!isViewingToday && (
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {format(selectedDate, "MMM d, yyyy")}
                </span>
              )}
              {/* Hours and Focus pills */}
              {!isLoading && (
                <div className="flex gap-1.5 text-xs">
                  <div
                    className={`flex items-center gap-1 px-1.5 py-0.5 rounded-full ${
                      getHoursColor(
                        statsData[user?.id || "you"].todayHours,
                        selectedDate
                      ).bg
                    }`}
                  >
                    <Clock
                      className={`w-3 h-3 ${
                        getHoursColor(
                          statsData[user?.id || "you"].todayHours,
                          selectedDate
                        ).text
                      }`}
                    />
                    <span
                      className={`font-medium ${
                        getHoursColor(
                          statsData[user?.id || "you"].todayHours,
                          selectedDate
                        ).text
                      }`}
                    >
                      {statsData[user?.id || "you"].todayHours
                        .toFixed(1)
                        .replace(".0", "")}
                      h
                    </span>
                  </div>
                  {statsData[user?.id || "you"].averageFocus > 0 && (
                    <div
                      className={`flex items-center gap-1 px-1.5 py-0.5 rounded-full ${
                        getFocusColor(
                          statsData[user?.id || "you"].averageFocus
                        ).bg
                      }`}
                    >
                      <Brain
                        className={`w-3 h-3 ${
                          getFocusColor(
                            statsData[user?.id || "you"].averageFocus
                          ).text
                        }`}
                      />
                      <span
                        className={`font-medium ${
                          getFocusColor(
                            statsData[user?.id || "you"].averageFocus
                          ).text
                        }`}
                      >
                        {statsData[user?.id || "you"].averageFocus}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="flex items-center gap-3">
              {!isLoading && (
                <div className="flex">{renderSessionsHistory()}</div>
              )}
              {/* Date navigation buttons */}
              <div className="flex items-center gap-1">
                <button
                  onClick={goToPreviousDay}
                  className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-gray-600 dark:text-gray-400"
                  title="Previous day"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                {canGoForward && (
                  <>
                    <button
                      onClick={goToToday}
                      className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-gray-600 dark:text-gray-400"
                      title="Go to today"
                    >
                      <Calendar className="w-4 h-4" />
                    </button>
                    <button
                      onClick={goToNextDay}
                      className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-gray-600 dark:text-gray-400"
                      title="Next day"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
          <div className="p-5 bg-white dark:bg-gray-900">
            {isLoading ? (
              <div className="text-center py-4">
                <p className="text-gray-500 dark:text-gray-400">
                  Loading progress stats...
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Daily progress always on top */}
                <div className="h-auto">
                  <DayProgress
                    stats={statsData[user?.id || "you"]}
                    onSessionClick={handleSessionClick}
                  />
                </div>

                {/* Custom divider with time information */}
                <div className="relative py-0 -my-0.5">
                  {/* Start time */}
                  {statsData[user?.id || "you"].todaySessions &&
                    statsData[user?.id || "you"].todaySessions.length > 0 && (
                      <>
                        <div className="flex items-center">
                          <div className="text-xs text-gray-500 dark:text-gray-400 pr-1">
                            {(() => {
                              const sessions =
                                statsData[user?.id || "you"].todaySessions ||
                                [];
                              if (sessions.length === 0) return "";

                              // Sort sessions by time
                              const sortedSessions = [...sessions].sort(
                                (a, b) =>
                                  new Date(a.created_at).getTime() -
                                  new Date(b.created_at).getTime()
                              );

                              // Get first session start time and subtract session minutes
                              const firstSessionStart = new Date(
                                sortedSessions[0].created_at
                              );
                              // Subtract minutes to get actual start time
                              firstSessionStart.setMinutes(
                                firstSessionStart.getMinutes() -
                                  sortedSessions[0].minutes
                              );

                              return firstSessionStart.toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                                hour12: false,
                              });
                            })()}
                          </div>
                          <div className="flex-grow border-t border-gray-200 dark:border-gray-800"></div>
                          <div className="text-xs text-gray-500 dark:text-gray-400 pl-1">
                            {(() => {
                              const sessions =
                                statsData[user?.id || "you"].todaySessions ||
                                [];
                              if (sessions.length === 0) return "";

                              // Sort sessions by time
                              const sortedSessions = [...sessions].sort(
                                (a, b) =>
                                  new Date(a.created_at).getTime() -
                                  new Date(b.created_at).getTime()
                              );

                              // Get the last session's creation time directly
                              const lastIndex = sortedSessions.length - 1;
                              const lastSessionTime = new Date(
                                sortedSessions[lastIndex].created_at
                              );

                              return lastSessionTime.toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                                hour12: false,
                              });
                            })()}
                          </div>
                        </div>
                      </>
                    )}
                  {(!statsData[user?.id || "you"].todaySessions ||
                    statsData[user?.id || "you"].todaySessions.length ===
                      0) && (
                    <div className="border-t border-gray-200 dark:border-gray-800"></div>
                  )}
                </div>

                {/* Week/Year progress below */}
                <WeekYearProgress stats={statsData[user?.id || "you"]} />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Session Edit Modal */}
      {selectedSession && (
        <SessionEditModal
          session={selectedSession}
          onClose={() => setSelectedSession(null)}
          onSave={handleSaveSession}
          onDelete={handleDeleteSession}
        />
      )}
    </div>
  );
};

export default FriendsProgressStats;
