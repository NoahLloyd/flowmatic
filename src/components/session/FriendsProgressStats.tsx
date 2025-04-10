import React, { useState, useEffect } from "react";
import { Session } from "../../types/Session";
import { useAuth } from "../../context/AuthContext";
import { api } from "../../utils/api";

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
}

interface FriendsProgressStatsProps {
  sessions: Session[];
}

// Create a separate component for daily session visualization
const DailySessionBar = ({
  sessions,
  target,
  expectedProgress,
}: {
  sessions: Session[];
  target: number;
  expectedProgress: number;
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
    <div className="w-full rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 h-12 relative overflow-hidden">
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
              className={`h-full relative ${focusBg}`}
              style={{ width: `${widthPercent}%` }}
            >
              {/* Only show divider if it's not the same project as previous */}
              {showLeftDivider && (
                <div className="absolute left-0 top-0 bottom-0 w-px bg-gray-200 dark:bg-gray-800 z-10"></div>
              )}
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
const DayProgress = ({ stats }: { stats: FriendStats }) => {
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
        />
      </div>
    );
  }

  // Fall back to simplified version if no session data
  return (
    <div className="w-full rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 h-12 relative overflow-hidden">
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

const FriendsProgressCard = ({
  friend,
  stats,
  onClick,
}: {
  friend: string;
  stats: FriendStats;
  onClick?: () => void;
}) => {
  const hours = stats.todayHours;
  const target = stats.todayTarget;
  const offset = stats.todayOffset;
  const progress = stats.todayProgress;

  // Format hours for display
  const formattedHours =
    typeof hours === "number" ? hours.toFixed(1).replace(/\.0$/, "") : hours;
  const formattedOffset = Math.round(offset);
  const offsetDisplay = `(${offset >= 0 ? "+" : ""}${formattedOffset}h)`;
  const offsetClass =
    offset >= 0
      ? "text-green-600 dark:text-green-400"
      : "text-red-600 dark:text-red-400";

  return (
    <div
      onClick={onClick}
      className={`bg-white dark:bg-gray-950 p-3 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm ${
        onClick ? "cursor-pointer" : ""
      }`}
    >
      <div className="flex mb-2 items-center">
        <div className="font-medium text-gray-900 dark:text-gray-100">
          {friend}
        </div>
        <div className="ml-auto flex items-center space-x-1 text-sm">
          <span className="text-gray-700 dark:text-gray-300">
            {formattedHours}/{target}h
          </span>
          <span className={offsetClass}>{offsetDisplay}</span>
        </div>
      </div>
      <DayProgress stats={stats} />
    </div>
  );
};

const FriendsProgressStats: React.FC<FriendsProgressStatsProps> = ({
  sessions,
}) => {
  const { user } = useAuth();
  const [friends, setFriends] = useState<string[]>([]);
  const [statsData, setStatsData] = useState<Record<string, FriendStats>>({});
  const [isLoading, setIsLoading] = useState(true);

  // Get user info for display
  const userName = user?.name || "You";
  const userEmail = user?.email?.split("@")[0] || "You";
  const displayName = userName !== "You" ? userName : userEmail;

  // Calculate the user's own stats based on sessions
  useEffect(() => {
    // Get friends list from localStorage (matching the Friends page implementation)
    const storedFriends = localStorage.getItem("friends");
    if (storedFriends) {
      try {
        setFriends(JSON.parse(storedFriends));
      } catch (error) {
        console.error("Error parsing friends from localStorage:", error);
        setFriends([]);
      }
    }

    // Calculate user's stats using the same methods as in SessionStats
    calculateUserStats();
  }, [sessions]);

  // Calculate user stats
  const calculateUserStats = () => {
    setIsLoading(true);

    // Get daily target (match SessionStats implementation)
    const getDailyTarget = () => {
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

    // Today's stats
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todaySessions = sessions.filter(
      (session) => new Date(session.created_at) >= today
    );

    const hoursToday = todaySessions.reduce(
      (acc, session) => acc + session.minutes / 60,
      0
    );

    // Get activities for today
    const activities = todaySessions
      .map((session) => session.task || session.project || "Focus session")
      .filter((activity, index, self) => self.indexOf(activity) === index)
      .slice(0, 3); // Limit to 3 recent activities

    // Better activity tracking based on actual project names to match the screenshot
    const projectMinutes = todaySessions.reduce(
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
    const now = new Date();
    const workdayStart = new Date(now);
    workdayStart.setHours(9, 0, 0, 0); // 9 AM
    const workdayEnd = new Date(now);
    workdayEnd.setHours(16, 0, 0, 0); // 4 PM

    let expectedDailyProgress = 100; // Default to 100% if after workday end

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

    const dailyTarget = getDailyTarget();
    const expectedDailyHours = (dailyTarget * expectedDailyProgress) / 100;
    const todayHoursOffset = hoursToday - expectedDailyHours;
    const todayProgressPercent = Math.round((hoursToday / dailyTarget) * 100);

    // Weekly stats
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

    // Yearly stats
    const getYearStartDate = () => {
      if (user?.preferences?.yearlyHoursGoal?.startDate) {
        return new Date(user.preferences.yearlyHoursGoal.startDate);
      }
      return new Date(new Date().getFullYear(), 0, 1); // Default to Jan 1
    };

    const yearStart = getYearStartDate();
    const yearSessions = sessions.filter(
      (session) => new Date(session.created_at) >= yearStart
    );

    const yearlyHours = yearSessions.reduce(
      (acc, session) => acc + session.minutes / 60,
      0
    );

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
      [user?._id || "you"]: {
        todayHours: hoursToday,
        weekHours: hoursThisWeek,
        yearHours: yearlyHours,
        todayTarget: dailyTarget,
        weeklyTarget,
        yearlyTarget,
        todayOffset: todayHoursOffset,
        weeklyOffset: weeklyHoursOffset,
        yearlyOffset: yearlyHoursOffset,
        todayProgress: todayProgressPercent,
        weeklyProgress: weeklyProgressPercent,
        yearlyProgress: yearlyProgressPercent,
        todayExpectedProgress: expectedDailyProgress,
        weeklyExpectedProgress: weeklyExpectedPercent,
        yearlyExpectedProgress: yearlyExpectedPercent,
        activities: sortedProjects.length > 0 ? sortedProjects : activities,
        todaySessions: todaySessions, // Add actual session data for detailed visualization
      },
    });

    // Now fetch friend stats
    fetchFriendsStats();
  };

  // Fetch stats for friends
  const fetchFriendsStats = async () => {
    // In a real implementation, you would call the API for each friend
    // For now, we'll create some mock data based on the screenshot

    const mockFriendStats: Record<string, FriendStats> = {};

    // Create some mock data for friends
    for (const friend of friends) {
      // Generate realistic stats similar to what's shown in the screenshot
      const randomHoursToday = 2 + Math.random() * 3; // 2-5 hours
      const randomHoursWeek = 10 + Math.random() * 20; // 10-30 hours
      const randomHoursYear = 200 + Math.random() * 300; // 200-500 hours

      const dailyTarget = 4; // Assume default
      const weeklyTarget = 28; // Assume default
      const yearlyTarget = 1400; // Assume default

      // Calculate time-based expected progress (same as user)
      const now = new Date();
      const workdayStart = new Date(now);
      workdayStart.setHours(9, 0, 0, 0);
      const workdayEnd = new Date(now);
      workdayEnd.setHours(16, 0, 0, 0);

      let expectedDailyProgress = 100;
      if (now < workdayStart) {
        expectedDailyProgress = 0;
      } else if (now < workdayEnd) {
        const totalWorkMinutes = 7 * 60;
        const minutesSinceStart =
          (now.getTime() - workdayStart.getTime()) / (1000 * 60);
        expectedDailyProgress = Math.min(
          100,
          Math.round((minutesSinceStart / totalWorkMinutes) * 100)
        );
      }

      const expectedDailyHours = (dailyTarget * expectedDailyProgress) / 100;
      const todayOffset = randomHoursToday - expectedDailyHours;

      // Projects matching the screenshot
      const projectsFromScreenshot = ["Flow", "Flowmatic", "Locked-in"];

      // Randomly select 1-2 activities from the screenshot projects
      const numActivities = 1 + Math.floor(Math.random() * 2);
      const activities = Array.from(
        { length: numActivities },
        () =>
          projectsFromScreenshot[
            Math.floor(Math.random() * projectsFromScreenshot.length)
          ]
      );

      // Create mock session data for detailed visualization
      const mockSessions: Session[] = [];
      const totalMinutes = randomHoursToday * 60;
      let remainingMinutes = totalMinutes;

      // Create 1-4 mock sessions that add up to the total time
      const sessionCount = 1 + Math.floor(Math.random() * 3);
      for (let i = 0; i < sessionCount; i++) {
        const isLast = i === sessionCount - 1;
        const sessionMinutes = isLast
          ? remainingMinutes
          : Math.floor(
              (remainingMinutes / (sessionCount - i)) * (0.5 + Math.random())
            );

        remainingMinutes -= sessionMinutes;

        // Create a mock session with realistic data
        const mockSession: Session = {
          _id: `mock-${friend}-${i}`,
          user_id: friend,
          minutes: sessionMinutes,
          focus: 1 + Math.floor(Math.random() * 5), // Random focus 1-5
          created_at: new Date().toISOString(),
          project: activities[i % activities.length],
          task: "",
          notes: "",
        };

        mockSessions.push(mockSession);
      }

      mockFriendStats[friend] = {
        todayHours: randomHoursToday,
        weekHours: randomHoursWeek,
        yearHours: randomHoursYear,
        todayTarget: dailyTarget,
        weeklyTarget,
        yearlyTarget,
        todayOffset,
        weeklyOffset:
          randomHoursWeek - (expectedDailyProgress / 100) * weeklyTarget,
        yearlyOffset:
          randomHoursYear - (expectedDailyProgress / 100) * yearlyTarget,
        todayProgress: Math.round((randomHoursToday / dailyTarget) * 100),
        weeklyProgress: Math.round((randomHoursWeek / weeklyTarget) * 100),
        yearlyProgress: Math.round((randomHoursYear / yearlyTarget) * 100),
        todayExpectedProgress: expectedDailyProgress,
        weeklyExpectedProgress: expectedDailyProgress, // Simplified for mock
        yearlyExpectedProgress: expectedDailyProgress, // Simplified for mock
        activities,
        todaySessions: mockSessions,
      };
    }

    // Merge with user stats
    setStatsData((prevStats) => ({
      ...prevStats,
      ...mockFriendStats,
    }));

    setIsLoading(false);
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

  return (
    <div className="space-y-6">
      {/* User's card */}
      {statsData[user?._id || "you"] && (
        <div className="rounded-lg border border-gray-200 dark:border-gray-800 overflow-hidden h-full">
          <div className="border-b border-gray-200 dark:border-gray-800 px-5 py-3 flex items-center justify-between">
            <h2 className="text-sm font-medium text-gray-900 dark:text-white">
              {displayName}
            </h2>
            {!isLoading && (
              <div className="flex items-baseline gap-1">
                <span className="text-sm font-bold text-gray-900 dark:text-white">
                  {typeof statsData[user?._id || "you"].todayHours === "number"
                    ? statsData[user?._id || "you"].todayHours
                        .toFixed(1)
                        .replace(/\.0$/, "")
                    : statsData[user?._id || "you"].todayHours}
                </span>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  / {statsData[user?._id || "you"].todayTarget}
                </span>
                <span
                  className={`text-xs font-medium ${
                    statsData[user?._id || "you"].todayOffset >= 0
                      ? "text-green-600 dark:text-green-400"
                      : "text-red-600 dark:text-red-400"
                  }`}
                >
                  ({statsData[user?._id || "you"].todayOffset >= 0 ? "+" : ""}
                  {Math.round(statsData[user?._id || "you"].todayOffset)}h)
                </span>
              </div>
            )}
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
                  <DayProgress stats={statsData[user?._id || "you"]} />
                </div>

                {/* Custom divider with time information */}
                <div className="relative py-0 -my-0.5">
                  {/* Start time */}
                  {statsData[user?._id || "you"].todaySessions &&
                    statsData[user?._id || "you"].todaySessions.length > 0 && (
                      <>
                        <div className="flex items-center">
                          <div className="text-xs text-gray-500 dark:text-gray-400 pr-1">
                            {(() => {
                              const sessions =
                                statsData[user?._id || "you"].todaySessions ||
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
                                statsData[user?._id || "you"].todaySessions ||
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
                  {(!statsData[user?._id || "you"].todaySessions ||
                    statsData[user?._id || "you"].todaySessions.length ===
                      0) && (
                    <div className="border-t border-gray-200 dark:border-gray-800"></div>
                  )}
                </div>

                {/* Week/Year progress below */}
                <WeekYearProgress stats={statsData[user?._id || "you"]} />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Friend cards - use a more compact layout when there are multiple friends */}
      {friends.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {friends.map(
            (friend) =>
              statsData[friend] && (
                <FriendsProgressCard
                  key={friend}
                  friend={friend}
                  stats={statsData[friend]}
                />
              )
          )}
        </div>
      )}
    </div>
  );
};

export default FriendsProgressStats;
