import React, { useEffect, useState } from "react";
import SidebarItem from "./SidebarItem";
import SidebarStreakCard from "./SidebarStreakCard";
import {
  Settings,
  Sunrise,
  Check,
  Compass,
  BarChart2,
  StickyNote,
  ClipboardList,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import SidebarTimer from "./SidebarTimer";
import { api } from "../../utils/api";
import { useSignals } from "../../context/SignalsContext";
import { useTimezone } from "../../context/TimezoneContext";

type SidebarProps = {
  selected: string;
  onSelect: (label: string) => void;
  timerProps?: {
    isVisible: boolean;
    time: number;
    isBreakTimer?: boolean;
    isStopwatchMode?: boolean;
  };
  currentTask?: string;
};

const Sidebar: React.FC<SidebarProps> = ({
  selected,
  onSelect,
  timerProps,
  currentTask,
}) => {
  const { user } = useAuth();

  const [isReviewCompleted, setIsReviewCompleted] = useState(true);
  const [isReviewStatusLoaded, setIsReviewStatusLoaded] = useState(false);
  const [currentDayOfWeek, setCurrentDayOfWeek] = useState(-1);

  const { signalScore, totalSignals, completedSignals, signalStreak, signalStreakDanger } =
    useSignals();

  const { timezone } = useTimezone();

  const navItems = [
    { label: "Compass", icon: Compass },
    { label: "Tasks", icon: Check },
    { label: "Morning", icon: Sunrise },
    { label: "Review", icon: ClipboardList },
    { label: "Notes", icon: StickyNote },
    { label: "Insights", icon: BarChart2 },
    { label: "Settings", icon: Settings },
  ];

  const keyboardShortcuts: Record<string, string> = {
    Compass: "c",
    Tasks: "t",
    Morning: "m",
    Review: "r",
    Notes: "n",
    Insights: "i",
    Settings: "s",
  };

  const formatDateInTimezone = (date: Date, tz: string): string => {
    const formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    return formatter.format(date);
  };

  const getDayOfWeekInTimezone = (date: Date, tz: string): number => {
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      weekday: "short",
    });
    const dayStr = formatter.format(date);
    const dayMap: Record<string, number> = {
      Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
    };
    return dayMap[dayStr] ?? 0;
  };

  useEffect(() => {
    const checkReviewStatus = async () => {
      if (!user) return;
      try {
        const now = new Date();
        const day = getDayOfWeekInTimezone(now, timezone);
        setCurrentDayOfWeek(day);

        let daysToSubtract;
        if (day === 0) {
          daysToSubtract = 6;
        } else if (day <= 2) {
          daysToSubtract = day + 6;
        } else {
          daysToSubtract = day - 1;
        }

        const weekMonday = new Date(
          now.getTime() - daysToSubtract * 24 * 60 * 60 * 1000
        );
        const weekStart = formatDateInTimezone(weekMonday, timezone);
        const review = await api.getWeeklyReview(weekStart);
        setIsReviewCompleted(Boolean(review?.is_completed));
        setIsReviewStatusLoaded(true);
      } catch (error) {
        console.error("Failed to fetch review status:", error);
        setIsReviewCompleted(true);
        setIsReviewStatusLoaded(true);
      }
    };

    checkReviewStatus();
    const interval = setInterval(checkReviewStatus, 60 * 60 * 1000);
    const onReviewUpdated = () => checkReviewStatus();
    window.addEventListener("weekly-review-updated", onReviewUpdated);

    return () => {
      clearInterval(interval);
      window.removeEventListener("weekly-review-updated", onReviewUpdated);
    };
  }, [user, timezone]);

  const getReviewHighlight = (): "none" | "warning" | "urgent" => {
    if (!isReviewStatusLoaded || isReviewCompleted) return "none";
    if ([0, 1, 2, 5, 6].includes(currentDayOfWeek)) return "urgent";
    return "none";
  };

  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      if (
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement
      ) {
        return;
      }
      const page = Object.keys(keyboardShortcuts).find(
        (key) => keyboardShortcuts[key] === event.key.toLowerCase()
      );
      if (page) onSelect(page);
    };

    window.addEventListener("keydown", handleKeyPress);
    return () => window.removeEventListener("keydown", handleKeyPress);
  }, [onSelect]);

  const signalGoal = user?.preferences?.signalPercentageGoal || 75;

  return (
    <div className="w-60 flex flex-col pr-4">
      {/* Navigation */}
      <nav className="space-y-0.5">
        {navItems.map((item) => (
          <SidebarItem
            key={item.label}
            Icon={item.icon}
            label={item.label}
            isSelected={selected === item.label}
            onSelect={onSelect}
            highlight={item.label === "Review" ? getReviewHighlight() : "none"}
          />
        ))}
      </nav>

      <div className="flex-grow" />

      {/* Current task */}
      {currentTask && (
        <div className="mb-2 rounded-2xl bg-indigo-500/10 dark:bg-indigo-500/10 border border-indigo-400/20 dark:border-indigo-400/15 px-4 py-3">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-indigo-400/70 dark:text-indigo-400/60 mb-1">
            Working on
          </div>
          <div className="text-sm font-medium text-indigo-200 dark:text-indigo-300 leading-snug break-words">
            {currentTask}
          </div>
        </div>
      )}

      {/* Timer */}
      {timerProps && (
        <div className="mb-2" onClick={() => onSelect("Compass")}>
          <SidebarTimer {...timerProps} />
        </div>
      )}

      {/* Streak + Signals card */}
      {(signalStreak > 0 || signalStreakDanger || totalSignals > 0) && (
        <div className="pb-1">
          <SidebarStreakCard
            streak={signalStreak}
            streakDanger={signalStreakDanger}
            signalScore={signalScore}
            signalGoal={signalGoal}
            completedSignals={completedSignals}
            totalSignals={totalSignals}
            onClick={() => window.dispatchEvent(new CustomEvent("openStreakScreen"))}
          />
        </div>
      )}
    </div>
  );
};

export default Sidebar;
