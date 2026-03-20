import React, { useEffect, useState, useRef } from "react";
import SidebarItem from "./SidebarItem";
import SidebarScoreCard from "./SidebarScoreCard";
import {
  Settings,
  Sunrise,
  Check,
  Compass,
  BarChart2,
  ChevronsUpDown,
  User,
  Moon,
  Sun,
  Monitor,
  StickyNote,
  ClipboardList,
} from "lucide-react";
import logoImage from "../../assets/logo-black-Template.png";
import logoDarkImage from "../../assets/logo-white-Template.png";
import { useTheme } from "../../context/ThemeContext";
import { useAuth } from "../../context/AuthContext";
import SidebarTimer from "./SidebarTimer";
import { api } from "../../utils/api";
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
    isStopwatchMode?: boolean;
  };
};

const Sidebar: React.FC<SidebarProps> = ({
  selected,
  onSelect,
  title,
  timerProps,
}) => {
  const { isDarkMode, themeMode, setThemeMode } = useTheme();
  const [isThemeDropdownOpen, setIsThemeDropdownOpen] = useState(false);
  const themeDropdownRef = useRef<HTMLDivElement>(null);
  const { user } = useAuth();

  // Weekly review completion state for indicator
  // Default to true (completed) so we don't show red while loading
  const [isReviewCompleted, setIsReviewCompleted] = useState(true);
  const [isReviewStatusLoaded, setIsReviewStatusLoaded] = useState(false);
  const [currentDayOfWeek, setCurrentDayOfWeek] = useState(-1); // -1 = not loaded yet

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
    { label: "Review", icon: ClipboardList },
    { label: "Notes", icon: StickyNote },
    { label: "Insights", icon: BarChart2 },
    { label: "Settings", icon: Settings },
  ];

  // Define keyboard shortcuts
  const keyboardShortcuts: Record<string, string> = {
    Compass: "c",
    Tasks: "t",
    Morning: "m",
    Review: "r",
    Notes: "n",
    Insights: "i",
    Settings: "s",
  };

  // Helper to format a date as YYYY-MM-DD in a specific timezone
  const formatDateInTimezone = (date: Date, tz: string): string => {
    const formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    return formatter.format(date);
  };

  // Helper to get the day of week (0=Sun, 6=Sat) in a specific timezone
  const getDayOfWeekInTimezone = (date: Date, tz: string): number => {
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      weekday: "short",
    });
    const dayStr = formatter.format(date);
    const dayMap: Record<string, number> = {
      Sun: 0,
      Mon: 1,
      Tue: 2,
      Wed: 3,
      Thu: 4,
      Fri: 5,
      Sat: 6,
    };
    return dayMap[dayStr] ?? 0;
  };

  // Fetch weekly review status and update day of week for indicator
  useEffect(() => {
    const checkReviewStatus = async () => {
      if (!user) return;

      try {
        // Get current day of week in user's timezone using proper timezone-aware formatting
        const now = new Date();
        const day = getDayOfWeekInTimezone(now, timezone);
        setCurrentDayOfWeek(day);

        // Calculate current review week start (Monday).
        // Week period is Mon-Sun. Review is editable Fri through Tue after.
        // On Fri/Sat/Sun: show this week's Monday
        // On Mon/Tue: show previous week's Monday
        // On Wed/Thu: show this week's Monday (preview, not yet editable)
        let daysToSubtract;
        if (day === 0) {
          // Sunday -> go back 6 to Monday
          daysToSubtract = 6;
        } else if (day <= 2) {
          // Mon(1), Tue(2) -> previous week's Monday
          daysToSubtract = day + 6;
        } else {
          // Wed(3)-Sat(6) -> this week's Monday
          daysToSubtract = day - 1;
        }

        // Subtract days using milliseconds to avoid date rollover issues
        const weekMonday = new Date(
          now.getTime() - daysToSubtract * 24 * 60 * 60 * 1000
        );
        // Format the date in the user's timezone to get consistent YYYY-MM-DD
        const weekStart = formatDateInTimezone(weekMonday, timezone);

        // Review is considered "done" only if it exists AND is marked completed.
        const review = await api.getWeeklyReview(weekStart);
        setIsReviewCompleted(Boolean(review?.is_completed));
        setIsReviewStatusLoaded(true);
      } catch (error) {
        console.error("Failed to fetch review status:", error);
        // On error, don't show red (assume completed to avoid false alarms)
        setIsReviewCompleted(true);
        setIsReviewStatusLoaded(true);
      }
    };

    checkReviewStatus();

    // Refresh every hour to catch day changes
    const interval = setInterval(checkReviewStatus, 60 * 60 * 1000);

    // Also refresh immediately when the review is saved/completed
    const onReviewUpdated = () => {
      checkReviewStatus();
    };
    window.addEventListener("weekly-review-updated", onReviewUpdated);

    return () => {
      clearInterval(interval);
      window.removeEventListener("weekly-review-updated", onReviewUpdated);
    };
  }, [user, timezone]);

  // Determine review highlight status
  // Red on Sat, Sun, Mon, Tue if the current Wed–Tue review is not completed
  // Only show indicator after status has loaded (default to none while loading)
  const getReviewHighlight = (): "none" | "warning" | "urgent" => {
    // Don't show red while loading or if review is completed
    if (!isReviewStatusLoaded || isReviewCompleted) return "none";

    // Show urgent on Fri(5), Sat(6), Sun(0), Mon(1), Tue(2) — the editable window
    if (
      currentDayOfWeek === 5 ||
      currentDayOfWeek === 6 ||
      currentDayOfWeek === 0 ||
      currentDayOfWeek === 1 ||
      currentDayOfWeek === 2
    ) {
      return "urgent";
    }

    return "none";
  };

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

  // Close theme dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        themeDropdownRef.current &&
        !themeDropdownRef.current.contains(event.target as Node)
      ) {
        setIsThemeDropdownOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const themeOptions = [
    { value: "light" as const, label: "Light", icon: Sun },
    { value: "dark" as const, label: "Dark", icon: Moon },
    { value: "system" as const, label: "System", icon: Monitor },
  ];

  const currentThemeOption =
    themeOptions.find((opt) => opt.value === themeMode) || themeOptions[2];
  const CurrentThemeIcon = currentThemeOption.icon;

  return (
    <div className="w-64 flex flex-col pr-4 space-y-4">
      <div className="p-4 flex items-center justify-between bg-white/10 dark:bg-slate-800/30 border-white/20 dark:border-slate-700/60 rounded-xl border">
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

        {/* Theme Dropdown */}
        <div className="relative" ref={themeDropdownRef}>
          <button
            onClick={() => setIsThemeDropdownOpen(!isThemeDropdownOpen)}
            className="p-2 rounded-lg hover:bg-slate-200/20 dark:hover:bg-slate-700/30 transition-colors"
          >
            <CurrentThemeIcon className="w-5 h-5 text-slate-600 dark:text-slate-300" />
          </button>

          {isThemeDropdownOpen && (
            <div className="absolute right-0 mt-2 w-36 py-1 bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700 z-50">
              {themeOptions.map((option) => {
                const Icon = option.icon;
                const isActive = themeMode === option.value;
                return (
                  <button
                    key={option.value}
                    onClick={() => {
                      setThemeMode(option.value);
                      setIsThemeDropdownOpen(false);
                    }}
                    className={`w-full px-3 py-2 flex items-center gap-3 text-left text-sm transition-colors ${
                      isActive
                        ? "bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400"
                        : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/50"
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{option.label}</span>
                    {isActive && <Check className="w-4 h-4 ml-auto" />}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {icons.map((icon) => (
        <SidebarItem
          key={icon.label}
          Icon={icon.icon}
          label={icon.label}
          isSelected={selected === icon.label}
          onSelect={onSelect}
          highlight={icon.label === "Review" ? getReviewHighlight() : "none"}
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

      <div
        onClick={() => onSelect("Settings")}
        className="p-4 cursor-pointer rounded-xl border bg-white/10 dark:bg-slate-800/30 border-white/20 dark:border-slate-700/60 flex items-center justify-between hover:bg-white/15 dark:hover:bg-slate-700/40 transition-colors"
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
