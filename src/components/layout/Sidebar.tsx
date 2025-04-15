import React, { useEffect, useState, useRef } from "react";
import SidebarItem from "./SidebarItem";
import SidebarScoreCard from "./SidebarScoreCard";
import {
  Users,
  Settings,
  Sunrise,
  Check,
  Compass,
  BarChart2,
  ChevronsUpDown,
  User,
  Moon,
  Sun,
  StickyNote,
  BookOpen,
  Trophy,
  Flame,
  Activity,
} from "lucide-react";
import logoImage from "../../assets/logo-black-Template.png";
import logoDarkImage from "../../assets/logo-white-Template.png";
import { useTheme } from "../../context/ThemeContext";
import { useAuth } from "../../context/AuthContext";
import SidebarTimer from "./SidebarTimer";
import { api } from "../../utils/api";
import { Session } from "../../types/Session";
import { AVAILABLE_SIGNALS } from "../../pages/settings/components/SignalSettings";
import { useSignals } from "../../context/SignalsContext";
import { useTimezone } from "../../context/TimezoneContext";

type SidebarProps = {
  selected: string;
  onSelect: (label: string) => void;
  title: string;
  timerProps?: {
    isVisible: boolean;
    time: number;
    isBreakTimer?: boolean;
  };
};

const Sidebar: React.FC<SidebarProps> = ({
  selected,
  onSelect,
  title,
  timerProps,
}) => {
  const { isDarkMode, toggleDarkMode } = useTheme();
  const { user } = useAuth();
  const [hoursToday, setHoursToday] = useState(0);
  const [dailyGoal, setDailyGoal] = useState(4); // Default 4 hours
  const [streak, setStreak] = useState(0);
  const [sessions, setSessions] = useState<Session[]>([]);
  // For testing: set to true to simulate under 4 hours
  const [testUnderFourHours, setTestUnderFourHours] = useState(false);

  // Use the SignalsContext instead of local state for signals
  const { signals, signalScore, totalSignals, completedSignals, updateSignal } =
    useSignals();

  // Get the timezone context
  const { timezone } = useTimezone();

  const displayName = user?.email ? user.email.split("@")[0] : title;

  const icons = [
    { label: "Compass", icon: Compass },
    { label: "Tasks", icon: Check },
    { label: "Morning", icon: Sunrise },
    { label: "Notes", icon: StickyNote },
    { label: "Documents", icon: BookOpen },
    { label: "Insights", icon: BarChart2 },
    { label: "Settings", icon: Settings },
  ];

  // Define keyboard shortcuts
  const keyboardShortcuts: Record<string, string> = {
    Compass: "c",
    Tasks: "t",
    Morning: "m",
    Notes: "n",
    Documents: "d",
    Insights: "i",
    Settings: "s",
  };

  // Get date in user's timezone
  const getDateInUserTimezone = (date: Date) => {
    try {
      // Get the date string in the user's timezone
      const dateInTZ = new Date(
        date.toLocaleString("en-US", { timeZone: timezone })
      );

      // Create a fixed offset to compensate for the timezone difference
      const utcDate = new Date(date.toISOString());
      const tzOffset = utcDate.getTime() - dateInTZ.getTime();

      // Apply the offset to get the correct date in user's timezone
      return new Date(date.getTime() - tzOffset);
    } catch (error) {
      console.error("Error formatting date with timezone:", error);
      return date; // Fallback to original date
    }
  };

  // Get today's date string in user's timezone (YYYY-MM-DD)
  const getTodayStringInUserTimezone = () => {
    try {
      const now = new Date();
      const todayInUserTZ = getDateInUserTimezone(now);
      return todayInUserTZ.toISOString().split("T")[0];
    } catch (error) {
      console.error("Error getting today's date string:", error);
      return new Date().toISOString().split("T")[0]; // Fallback
    }
  };

  // Modified to use timezone-aware date
  const getDailyGoal = (date: Date = new Date()) => {
    // Get the day of week in user's timezone
    const dateInUserTZ = getDateInUserTimezone(date);
    const day = dateInUserTZ.getDay();

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

    // Check if user has preferences set
    if (
      user?.preferences?.dailyHoursGoals &&
      dayName in user.preferences.dailyHoursGoals
    ) {
      return user.preferences.dailyHoursGoals[dayName];
    }
    return 4; // Default if not set
  };

  // Use timezone-aware date string for today
  const todayString = getTodayStringInUserTimezone();

  // Calculate the current streak
  const calculateStreak = (allSessions: Session[]) => {
    if (!allSessions.length) return 0;

    // Sort sessions by date (newest first)
    const sortedSessions = [...allSessions].sort((a, b) => {
      return (
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    });

    // Group sessions by day
    const sessionsByDay: Record<string, Session[]> = {};
    sortedSessions.forEach((session) => {
      try {
        // Get date in user's timezone in a consistent format
        const rawDate = new Date(session.created_at);
        const dateStr = rawDate.toLocaleString("en-US", {
          timeZone: timezone,
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        });

        if (!sessionsByDay[dateStr]) {
          sessionsByDay[dateStr] = [];
        }
        sessionsByDay[dateStr].push(session);
      } catch (error) {
        console.error("Error grouping session by day:", error);
        // Fallback to previous method
        const sessionDate = getDateInUserTimezone(new Date(session.created_at));
        const date = sessionDate.toISOString().split("T")[0];
        if (!sessionsByDay[date]) {
          sessionsByDay[date] = [];
        }
        sessionsByDay[date].push(session);
      }
    });

    // Get sorted unique dates
    const dates = Object.keys(sessionsByDay).sort().reverse();
    if (!dates.length) return 0;

    // Check if each day met the goal
    let currentStreak = 0;

    // Get today's date in user's timezone in the same format as session grouping
    const now = new Date();
    const today = now.toLocaleString("en-US", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });

    // Start from today or the most recent date with sessions
    let currentDate = today;
    const mostRecentDate = dates[0];

    // If today has no sessions yet but yesterday did and met the goal, we still count the streak
    if (!sessionsByDay[today] && dates[0] !== today) {
      // Calculate yesterday's date in user's timezone
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toLocaleString("en-US", {
        timeZone: timezone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      });

      if (mostRecentDate === yesterdayStr) {
        currentDate = yesterdayStr;
      }
    }

    // Start checking from the current date backwards
    while (true) {
      const dateObj = new Date(currentDate);
      const sessionsOnDay = sessionsByDay[currentDate] || [];

      if (sessionsOnDay.length === 0) {
        // No sessions on this day, streak ends
        break;
      }

      // Calculate total hours for this day
      const hoursOnDay = sessionsOnDay.reduce(
        (total, session) => total + session.minutes / 60,
        0
      );

      // Get the goal for this specific day
      const goalForDay = getDailyGoal(dateObj);

      if (hoursOnDay >= goalForDay) {
        // Goal met, continue streak
        currentStreak++;
      } else {
        // Goal not met, streak ends
        break;
      }

      // Move to the previous day
      dateObj.setDate(dateObj.getDate() - 1);
      currentDate = dateObj.toISOString().split("T")[0];
    }

    return currentStreak;
  };

  // Toggle test mode for displaying under 4 hours
  const toggleTestMode = () => {
    setTestUnderFourHours(!testUnderFourHours);
  };

  // Fetch sessions and calculate hours today
  useEffect(() => {
    const fetchSessions = async () => {
      if (!user) return;

      try {
        // Fetch all sessions for the user
        const fetchedSessions = await api.getUserSessions();
        // Explicitly cast the response to Session[] to help TypeScript
        const allSessions = fetchedSessions as Session[];
        setSessions(allSessions);

        // Calculate streak
        const currentStreak = calculateStreak(allSessions);
        setStreak(currentStreak);

        // ----- Calculate today's hours exactly as SessionStats does -----
        // Set to start of today
        const today = new Date().toISOString().split("T")[0];
        const todayInTZ = getTodayStringInUserTimezone();

        console.log("Timezone debugging:");
        console.log("- Current timezone:", timezone);
        console.log("- Raw today:", today);
        console.log("- Today in user timezone:", todayInTZ);

        // Log the last few sessions to debug
        const recentSessions = [...allSessions]
          .sort(
            (a, b) =>
              new Date(b.created_at).getTime() -
              new Date(a.created_at).getTime()
          )
          .slice(0, 3);

        recentSessions.forEach((session, i) => {
          const rawDate = new Date(session.created_at);
          const tzDate = getDateInUserTimezone(rawDate);
          console.log(`- Session ${i}:`);
          console.log(`  * Raw date: ${rawDate.toISOString()}`);
          console.log(`  * TZ date: ${tzDate.toISOString()}`);
          console.log(
            `  * TZ date string: ${tzDate.toISOString().split("T")[0]}`
          );
          console.log(
            `  * Included in today: ${
              tzDate.toISOString().split("T")[0] === todayInTZ
            }`
          );
        });

        // Filter sessions for today (using same filter logic as SessionStats)
        const todaySessions = allSessions.filter((session) => {
          try {
            // Convert the session date to the user's timezone
            const rawDate = new Date(session.created_at);

            // Create a date string in the user's timezone format
            const sessionDateStr = rawDate.toLocaleString("en-US", {
              timeZone: timezone,
              year: "numeric",
              month: "2-digit",
              day: "2-digit",
            });

            // Create today's date string in the same format
            const now = new Date();
            const todayDateStr = now.toLocaleString("en-US", {
              timeZone: timezone,
              year: "numeric",
              month: "2-digit",
              day: "2-digit",
            });

            // Compare the date strings directly
            return sessionDateStr === todayDateStr;
          } catch (error) {
            console.error("Error filtering session date:", error);
            // Fallback to the previous approach
            const sessionDate = getDateInUserTimezone(
              new Date(session.created_at)
            );
            return sessionDate.toISOString().split("T")[0] === todayInTZ;
          }
        });

        console.log("- Today's sessions count:", todaySessions.length);

        // Calculate hours using same reducer logic as SessionStats
        const hours = todaySessions.reduce(
          (acc, session) => acc + session.minutes / 60,
          0
        );

        console.log("- Hours today:", hours);

        setHoursToday(hours);

        // Update daily goal
        setDailyGoal(getDailyGoal());
      } catch (error) {
        console.error("Failed to fetch sessions:", error);
      }
    };

    fetchSessions();

    // Set up interval to refresh the data every 5 minutes
    const interval = setInterval(fetchSessions, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, [user, timezone]);

  // Add keyboard shortcut handlers
  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      // Ignore key presses when input/textarea elements are focused
      if (
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      // Check if the pressed key matches any of our shortcuts
      const page = Object.keys(keyboardShortcuts).find(
        (key) => keyboardShortcuts[key] === event.key.toLowerCase()
      );

      if (page) {
        onSelect(page);
      }
    };

    window.addEventListener("keydown", handleKeyPress);
    return () => {
      window.removeEventListener("keydown", handleKeyPress);
    };
  }, [onSelect]);

  // Get display hours (either real or test mode)
  const displayHours = testUnderFourHours ? 2.5 : hoursToday;

  // Calculate progress percentage - don't cap it for internal calculations
  const rawProgressPercentage = Math.round((displayHours / dailyGoal) * 100);

  // For display, cap at 100%
  const progressPercentage = Math.min(rawProgressPercentage, 100);

  // Determine if we exceeded the goal - now requires exactly meeting or exceeding the goal
  const exceededGoal = displayHours >= dailyGoal;

  return (
    <div className="w-64 flex flex-col pr-4 space-y-4">
      <div className="p-4 flex items-center justify-between bg-white/10 dark:bg-slate-800 dark:border-slate-700 border rounded-xl">
        <div className="flex items-center">
          <img
            src={isDarkMode ? logoDarkImage : logoImage}
            alt="Logo"
            className="w-8 h-8 mr-4"
          />
          <h1 className="text-lg font-medium text-slate-700 dark:text-slate-200">
            Flowmatic
          </h1>
        </div>
        <button
          onClick={toggleDarkMode}
          className="p-2 rounded-lg hover:bg-slate-200/20 dark:hover:bg-slate-700 transition-colors"
        >
          {isDarkMode ? (
            <Sun className="w-5 h-5 text-slate-200" />
          ) : (
            <Moon className="w-5 h-5 text-slate-600" />
          )}
        </button>
      </div>

      {icons.map((icon) => (
        <SidebarItem
          key={icon.label}
          Icon={icon.icon}
          label={icon.label}
          isSelected={selected === icon.label}
          onSelect={onSelect}
        />
      ))}

      <div className="flex-grow" />

      {/* Timer display above the profile */}
      {timerProps && (
        <div className="mb-0" onClick={() => onSelect("Compass")}>
          <SidebarTimer {...timerProps} />
        </div>
      )}

      {/* Signal Score Visualization */}
      <SidebarScoreCard
        title="Signals"
        value={signalScore}
        suffix="%"
        percentage={signalScore}
        total={totalSignals > 0 ? totalSignals : undefined}
        completed={completedSignals}
        exceededGoal={signalScore >= 80}
        showTrophy={signalScore >= 80}
        onClick={() => onSelect("Compass")}
      />

      {/* Hours Today Visualization */}
      <SidebarScoreCard
        title="Hours"
        value={displayHours.toFixed(1)}
        suffix="h"
        goal={dailyGoal}
        percentage={rawProgressPercentage}
        exceededGoal={exceededGoal}
        showTrophy={exceededGoal}
        onClick={() => onSelect("Compass")}
        extraDisplay={
          exceededGoal ? ` (+${(displayHours - dailyGoal).toFixed(1)}h)` : ""
        }
        progressColor={
          exceededGoal
            ? "green"
            : progressPercentage >= 75
            ? "blue"
            : progressPercentage >= 50
            ? "yellow"
            : "red"
        }
      />

      <div
        onClick={() => onSelect("Settings")}
        className="p-4 cursor-pointer rounded-xl border bg-white/10 dark:bg-slate-800 border-white/20 dark:border-slate-700 flex items-center justify-between hover:bg-white/15 dark:hover:bg-slate-700/80 transition-colors"
      >
        <div className="flex items-center">
          <User className="w-6 h-6 mr-2 text-slate-700 dark:text-slate-200" />
          <span className="text-md font-medium text-slate-700 dark:text-slate-200">
            {displayName}
          </span>
        </div>
        <ChevronsUpDown className="w-5 h-5 text-slate-700 dark:text-slate-200" />
      </div>
    </div>
  );
};

export default Sidebar;
