import React, { useEffect, useState, useRef } from "react";
import SidebarItem from "./SidebarItem";
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

  const displayName = user?.email ? user.email.split("@")[0] : title;

  const icons = [
    { label: "Compass", icon: Compass },
    { label: "Friends", icon: Users },
    { label: "Tasks", icon: Check },
    { label: "Morning", icon: Sunrise },
    { label: "Notes", icon: StickyNote },
    { label: "Articles", icon: BookOpen },
    { label: "Insights", icon: BarChart2 },
    { label: "Settings", icon: Settings },
  ];

  // Define keyboard shortcuts
  const keyboardShortcuts: Record<string, string> = {
    Compass: "c",
    Friends: "f",
    Tasks: "t",
    Morning: "m",
    Notes: "n",
    Articles: "a",
    Insights: "i",
    Settings: "s",
  };

  // Get today's focus goal from user preferences
  const getDailyGoal = (date: Date = new Date()) => {
    // Get the day of week (0 = Sunday, 1 = Monday, etc.)
    const day = date.getDay();
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
      const date = new Date(session.created_at).toISOString().split("T")[0];
      if (!sessionsByDay[date]) {
        sessionsByDay[date] = [];
      }
      sessionsByDay[date].push(session);
    });

    // Get sorted unique dates
    const dates = Object.keys(sessionsByDay).sort().reverse();
    if (!dates.length) return 0;

    // Check if each day met the goal
    let currentStreak = 0;
    const today = new Date().toISOString().split("T")[0];

    // Start from today or the most recent date with sessions
    let currentDate = today;
    const mostRecentDate = dates[0];

    // If today has no sessions yet but yesterday did and met the goal, we still count the streak
    if (!sessionsByDay[today] && dates[0] !== today) {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split("T")[0];

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
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Filter sessions for today (using same filter logic as SessionStats)
        const todaySessions = allSessions.filter(
          (session) => new Date(session.created_at) >= today
        );

        // Calculate hours using same reducer logic as SessionStats
        const hours = todaySessions.reduce(
          (acc, session) => acc + session.minutes / 60,
          0
        );

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
  }, [user]);

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

  // Determine if we exceeded the goal
  const exceededGoal = displayHours > dailyGoal;

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
      <div
        onClick={() => onSelect("Compass")}
        className={`mb-0 px-4 py-3 cursor-pointer rounded-xl border ${
          signalScore >= 80
            ? "bg-green-50/30 dark:bg-green-900/20 border-green-200 dark:border-green-800"
            : "bg-white/10 dark:bg-slate-800 border-white/20 dark:border-slate-700"
        } hover:bg-white/15 dark:hover:bg-slate-700/80`}
      >
        <div className="flex justify-between items-center mb-1">
          <div className="flex items-center">
            <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
              Signals
            </span>
            {signalScore >= 80 && (
              <div className="ml-2">
                <Trophy
                  className="w-3 h-3 text-yellow-500 dark:text-yellow-400"
                  style={{ display: "inline" }}
                />
              </div>
            )}
          </div>

          <span
            className={`text-xs font-semibold ${
              signalScore >= 80
                ? "text-green-600 dark:text-green-400"
                : "text-slate-700 dark:text-slate-300"
            }`}
          >
            {signalScore}%
            {totalSignals > 0 && (
              <span className="text-slate-500 dark:text-slate-400">
                {" "}
                ({completedSignals}/{totalSignals})
              </span>
            )}
          </span>
        </div>
        <div className="w-full h-2.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full ${
              signalScore >= 80
                ? "bg-green-500 dark:bg-green-600"
                : signalScore >= 60
                ? "bg-green-500 dark:bg-green-600"
                : signalScore >= 40
                ? "bg-yellow-500 dark:bg-yellow-600"
                : "bg-red-500 dark:bg-red-600"
            }`}
            style={{ width: `${signalScore}%` }}
          >
            {/* No shimmer effect */}
          </div>
        </div>
      </div>

      {/* Hours Today Visualization - All animations removed */}
      <div
        onClick={() => onSelect("Compass")}
        className={`mb-0 px-4 py-3 cursor-pointer rounded-xl border ${
          exceededGoal
            ? "bg-green-50/30 dark:bg-green-900/20 border-green-200 dark:border-green-800"
            : "bg-white/10 dark:bg-slate-800 border-white/20 dark:border-slate-700"
        } hover:bg-white/15 dark:hover:bg-slate-700/80`}
      >
        <div className="flex justify-between items-center mb-1">
          <div className="flex items-center">
            <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
              Hours
            </span>
            {exceededGoal && (
              <div className="ml-2">
                <Trophy
                  className="w-3 h-3 text-yellow-500 dark:text-yellow-400"
                  style={{ display: "inline" }}
                />
              </div>
            )}
          </div>

          {/* Current Streak Display */}
          {/* {streak > 0 && (
            <div className="flex items-center absolute right-4 top-1">
              <Flame className="w-3 h-3 text-orange-500 dark:text-orange-400 mr-1" />
              <span className="text-xs font-semibold text-orange-600 dark:text-orange-400">
                {streak}d
              </span>
            </div>
          )} */}

          <span
            className={`text-xs font-semibold ${
              exceededGoal
                ? "text-green-600 dark:text-green-400"
                : "text-slate-700 dark:text-slate-300"
            }`}
          >
            {displayHours.toFixed(1)}h
            <span className="text-slate-500 dark:text-slate-400">
              {" / "}
              {dailyGoal}h
            </span>
            {exceededGoal && ` (+${(displayHours - dailyGoal).toFixed(1)}h)`}
          </span>
        </div>
        <div className="w-full h-2.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full ${
              exceededGoal
                ? "bg-green-500 dark:bg-green-600"
                : progressPercentage >= 75
                ? "bg-blue-500 dark:bg-blue-600"
                : progressPercentage >= 50
                ? "bg-yellow-500 dark:bg-yellow-600"
                : "bg-red-500 dark:bg-red-600"
            }`}
            style={{ width: `${progressPercentage}%` }}
          >
            {/* Removed shimmer effect */}
          </div>
        </div>
      </div>

      <div
        onClick={() => onSelect("Settings")}
        className="p-4 shadow cursor-pointer bg-white dark:bg-slate-800 rounded-xl flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
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
