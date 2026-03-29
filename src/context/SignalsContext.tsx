import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from "react";
import { api } from "../utils/api";
import { useAuth } from "./AuthContext";
import { useTimezone } from "./TimezoneContext";
import { AVAILABLE_SIGNALS as ImportedAvailableSignals, getAllSignals, SignalConfig } from "../pages/settings/components/SignalSettings";
import { MorningEntry } from "../types/Morning";
import { Session } from "../types/Session";

// Exported type for heatmap data
export interface HeatmapSignalDetail {
  key: string;
  label: string;
  value: number | boolean;
  score: number; // 0-100
  type: string;
}

export interface HeatmapDay {
  date: string;
  score: number;
  signals: HeatmapSignalDetail[];
}

// Helper function to check if a morning entry has journaling content
const JOURNALING_MIN_CHARS = 1000;

const hasJournalingContent = (entry: MorningEntry | undefined): boolean => {
  if (!entry) return false;

  let totalChars = 0;

  // Check for new activityContent format
  if (entry.activityContent) {
    const { writing, gratitude, affirmations } = entry.activityContent;
    if (writing) totalChars += writing.trim().length;
    if (gratitude) totalChars += gratitude.trim().length;
    if (affirmations) totalChars += affirmations.trim().length;
  }

  // Check for legacy content format
  if (entry.content) {
    totalChars += entry.content.trim().length;
  }

  return totalChars >= JOURNALING_MIN_CHARS;
};

// Declare global interface for TypeScript
declare global {
  interface Window {
    AVAILABLE_SIGNALS: typeof ImportedAvailableSignals;
  }
}

// Define the shape of our SignalsContext
interface SignalsContextType {
  signals: Record<string, number | boolean>;
  signalScore: number;
  totalSignals: number;
  completedSignals: number;
  signalStreak: number;
  signalStreakDanger: boolean;
  signalStreakPoints: number;
  signalStreakLongest: number;
  signalStreakMilestones: number[];
  updateSignal: (metric: string, value: number | boolean) => Promise<void>;
  refreshSignals: () => Promise<void>;
  fetchHeatmapData: (startDate: string, endDate: string) => Promise<HeatmapDay[]>;
}

// Milestone thresholds
const STREAK_MILESTONES = [7, 14, 30, 60, 100, 200, 365];

// Create the context with a default value
const SignalsContext = createContext<SignalsContextType>({
  signals: {},
  signalScore: 0,
  totalSignals: 0,
  completedSignals: 0,
  signalStreak: 0,
  signalStreakDanger: false,
  signalStreakPoints: 0,
  signalStreakLongest: 0,
  signalStreakMilestones: [],
  updateSignal: async () => {},
  refreshSignals: async () => {},
  fetchHeatmapData: async () => [] as HeatmapDay[],
});

// Compute a signal score for a single day's worth of signal data.
// Returns 0-100 representing the average completion across active signals.
// When historicalMode is true, only count signals that have data for that day
// (avoids penalizing historical days when active signals change over time).
// When signalPercentageGoal is provided, forces 100% if every individual signal
// meets the goal — matching the live daily score algorithm exactly.
const computeDayScore = (
  daySignals: Record<string, any>,
  activeSignals: string[],
  availableSignals: Record<string, SignalConfig>,
  signalGoals: Record<string, number>,
  historicalMode: boolean = false,
  signalPercentageGoal: number = 0,
): number => {
  let totalActive = 0;
  let totalScore = 0;
  let allMeetGoal = signalPercentageGoal > 0; // starts true, any miss flips it

  // In historical mode, only evaluate signals that have data for this day
  // and skip computed signals (focusHours, journaling) whose historical
  // values may be stale or incorrect — they're only reliably computed live.
  const signalsToEvaluate = historicalMode
    ? activeSignals.filter((key) => {
        const config = availableSignals[key];
        if (config?.isComputed) return false;
        const value = daySignals[key];
        return value !== undefined && value !== null;
      })
    : activeSignals;

  for (const key of signalsToEvaluate) {

    const config = availableSignals[key];
    if (!config) continue;

    totalActive++;
    const value = daySignals[key];

    // No data recorded for this signal = 0 score
    if (value === undefined || value === null) {
      if (signalPercentageGoal > 0) allMeetGoal = false;
      continue;
    }

    let score = 0;

    if (config.type === "binary") {
      score =
        value === true || value === "true" || value === 1 || value === "1"
          ? 100
          : 0;
    } else if (config.type === "scale") {
      if (typeof value === "number") {
        score = (value / 5) * 100;
      }
    } else if (config.type === "number" || config.type === "water") {
      if (config.hasGoal && key in signalGoals) {
        const goal = signalGoals[key];
        if (typeof value === "number") {
          if (key === "minutesToOffice") {
            score = scoreMinutesToOffice(value, goal);
          } else {
            // Higher is better
            score = value >= goal ? 100 : (value / goal) * 100;
          }
        }
      }
      // No goal = 0 score (can't evaluate)
    }

    if (signalPercentageGoal > 0 && score < signalPercentageGoal) {
      allMeetGoal = false;
    }

    totalScore += score;
  }

  if (totalActive === 0) return 0;

  // Force 100% when every signal individually meets the goal — matches the
  // live daily score calculation so historical points are consistent.
  if (allMeetGoal && totalActive > 0) return 100;

  return Math.round(totalScore / totalActive);
};

// Score minutesToOffice with an exponential decay curve.
// Best at goal (100), gentle decline to 2x goal (75), then exponential decay to 0 at 8x goal.
// Exported so SignalCard can use the same curve for coloring.
export const scoreMinutesToOffice = (minutes: number, goal: number): number => {
  if (minutes <= goal) return 100;
  const doubleGoal = goal * 2;
  if (minutes <= doubleGoal) {
    // Linear decline from 100 → 75 between goal and 2x goal
    return 100 - 25 * ((minutes - goal) / (doubleGoal - goal));
  }
  // Exponential decay from 75 → ~0, reaching floor at 8x goal
  const maxMinutes = goal * 8; // e.g. 240 when goal=30
  const decayRange = maxMinutes - doubleGoal; // e.g. 180
  // k chosen so that 75 * e^(-k * decayRange) ≈ 2 (essentially 0)
  const k = 3.6 / decayRange;
  const elapsed = minutes - doubleGoal;
  const score = 75 * Math.exp(-k * elapsed);
  return Math.max(0, Math.min(75, score));
};

// Resolve the goal value for a signal on a given date using signalGoalHistory.
// Falls back to current goals if no history covers that date.
const getGoalsForDate = (
  date: string,
  currentGoals: Record<string, number>,
  history: { date: string; goals: Record<string, number> }[] | undefined,
): Record<string, number> => {
  if (!history || history.length === 0) return currentGoals;
  let applicable = history[0].goals;
  for (const entry of history) {
    if (entry.date <= date) {
      applicable = entry.goals;
    } else {
      break;
    }
  }
  return applicable;
};

// Resolve which signals were active on a given date using the signalActiveHistory log.
// Falls back to the current active list if no history covers that date.
const getActiveSignalsForDate = (
  date: string,
  currentActive: string[],
  history: { date: string; signals: string[] }[] | undefined,
): string[] => {
  if (!history || history.length === 0) return currentActive;

  // History is sorted by date ascending. Find the latest entry on or before this date.
  let applicable = history[0].signals; // earliest snapshot as baseline
  for (const entry of history) {
    if (entry.date <= date) {
      applicable = entry.signals;
    } else {
      break;
    }
  }
  return applicable;
};

// Helper function to get the current signals configuration (including custom signals)
const getAvailableSignals = (user: any) => {
  const customSignals = user?.preferences?.customSignals as Record<string, SignalConfig> | undefined;
  return getAllSignals(customSignals);
};

// Provider component to wrap application
export const SignalsProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const { user } = useAuth();
  const { timezone, formatDate } = useTimezone();
  const [signals, setSignals] = useState<Record<string, number | boolean>>({});
  const [signalScore, setSignalScore] = useState(0);
  const [totalSignals, setTotalSignals] = useState(0);
  const [completedSignals, setCompletedSignals] = useState(0);
  const [signalStreak, setSignalStreak] = useState(() => {
    const cached = localStorage.getItem("signalStreak");
    return cached ? parseInt(cached, 10) : 0;
  });
  const [signalStreakDanger, setSignalStreakDanger] = useState(() => {
    return localStorage.getItem("signalStreakDanger") === "true";
  });
  const [signalStreakPoints, setSignalStreakPoints] = useState(() => {
    const cached = localStorage.getItem("signalStreakPoints");
    return cached ? parseInt(cached, 10) : 0;
  });
  const [signalStreakLongest, setSignalStreakLongest] = useState(() => {
    const cached = localStorage.getItem("signalStreakLongest");
    return cached ? parseInt(cached, 10) : 0;
  });
  const [signalStreakMilestones, setSignalStreakMilestones] = useState<number[]>(() => {
    const cached = localStorage.getItem("signalStreakMilestones");
    if (cached) {
      try { return JSON.parse(cached); } catch { return []; }
    }
    return [];
  });

  // Sync streak from user preferences on login (cross-device support)
  useEffect(() => {
    if (user?.preferences?.signalStreakCount !== undefined) {
      const prefCount = user.preferences.signalStreakCount;
      setSignalStreak(prefCount);
      localStorage.setItem("signalStreak", String(prefCount));
    }
    if (user?.preferences?.signalStreakDanger !== undefined) {
      setSignalStreakDanger(user.preferences.signalStreakDanger);
      localStorage.setItem("signalStreakDanger", String(user.preferences.signalStreakDanger));
    }
    if (user?.preferences?.signalStreakPoints !== undefined) {
      setSignalStreakPoints(user.preferences.signalStreakPoints);
      localStorage.setItem("signalStreakPoints", String(user.preferences.signalStreakPoints));
    }
    if (user?.preferences?.signalStreakLongest !== undefined) {
      setSignalStreakLongest(user.preferences.signalStreakLongest);
      localStorage.setItem("signalStreakLongest", String(user.preferences.signalStreakLongest));
    }
    if (user?.preferences?.signalStreakMilestones !== undefined) {
      setSignalStreakMilestones(user.preferences.signalStreakMilestones);
      localStorage.setItem("signalStreakMilestones", JSON.stringify(user.preferences.signalStreakMilestones));
    }
  }, [user?.id]);

  // Seed signalActiveHistory if it doesn't exist yet
  useEffect(() => {
    if (!user?.id) return;
    const activeSignals = user?.preferences?.activeSignals as string[] | undefined;
    const history = user?.preferences?.signalActiveHistory;
    if (activeSignals && activeSignals.length > 0 && (!history || history.length === 0)) {
      const today = new Date().toISOString().split("T")[0];
      api.updateUserPreferences(user.id, {
        signalActiveHistory: [{ date: today, signals: activeSignals }],
      }).catch((err: Error) =>
        console.error("Failed to seed signalActiveHistory:", err)
      );
    }
  }, [user?.id]);

  // One-time backfill: persist historical journaling & focusHours to the signals table
  useEffect(() => {
    if (!user?.id) return;
    const backfillKey = `computedSignalsBackfilled_${user.id}`;
    if (localStorage.getItem(backfillKey)) return;

    (async () => {
      try {
        console.log("[SignalsContext] Starting computed signals backfill...");

        // Fetch all morning entries
        const { entries } = await api.getAllEntries();
        let journalCount = 0;
        for (const entry of entries) {
          if (entry.date && hasJournalingContent(entry)) {
            await api.recordSignal(entry.date, "journaling", 1);
            journalCount++;
          } else if (entry.date) {
            await api.recordSignal(entry.date, "journaling", 0);
          }
        }

        // Fetch all sessions (last 2 years) and compute focusHours per day
        const endDate = new Date();
        const startDate = new Date();
        startDate.setFullYear(startDate.getFullYear() - 2);
        const sessions = await api.getSessionsByDateRange(
          startDate.toISOString(),
          endDate.toISOString()
        );

        // Group sessions by local date
        const sessionsByDate: Record<string, number> = {};
        for (const session of sessions) {
          const sessionDate = new Date(session.created_at || "");
          if (isNaN(sessionDate.getTime())) continue;
          const dateStr = sessionDate.toISOString().split("T")[0];
          sessionsByDate[dateStr] = (sessionsByDate[dateStr] || 0) + (session.minutes || 0) / 60;
        }

        let focusCount = 0;
        const dayNames = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
        for (const [dateStr, hours] of Object.entries(sessionsByDate)) {
          const d = new Date(dateStr + "T12:00:00");
          const dayName = dayNames[d.getDay()];
          const dailyGoal = (user?.preferences?.dailyHoursGoals && dayName in user.preferences.dailyHoursGoals)
            ? user.preferences.dailyHoursGoals[dayName]
            : 4;
          const met = hours >= dailyGoal;
          await api.recordSignal(dateStr, "focusHours", met ? 1 : 0);
          if (met) focusCount++;
        }

        console.log(`[SignalsContext] Backfill complete: ${journalCount} journaling days, ${focusCount} focusHours days`);
        localStorage.setItem(backfillKey, "true");

        // Force full streak recalculation now that computed signals are in the DB
        if (user?.id) {
          await api.updateUserPreferences(user.id, {
            signalStreakCount: -1,
            signalStreakDate: "",
            signalStreakLongest: 0,
          });
          // Clear local cache too
          localStorage.removeItem("signalStreak");
          localStorage.removeItem("signalStreakLongest");
          // Reload page to trigger fresh streak computation
          window.location.reload();
        }
      } catch (error) {
        console.error("[SignalsContext] Computed signals backfill failed:", error);
      }
    })();
  }, [user?.id]);

  // Function to get today's date in YYYY-MM-DD format in user's timezone
  const getTodayInUserTimezone = () => {
    try {
      // Use Intl.DateTimeFormat to get the date parts in the user's timezone
      const date = new Intl.DateTimeFormat("en-US", {
        timeZone: timezone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).formatToParts(new Date());

      // Extract and format as YYYY-MM-DD
      const month = date.find((part) => part.type === "month")?.value || "01";
      const day = date.find((part) => part.type === "day")?.value || "01";
      const year = date.find((part) => part.type === "year")?.value || "2023";

      return `${year}-${month}-${day}`;
    } catch (error) {
      console.error("Error formatting date with timezone:", error);
      // Fallback to UTC
      return new Date().toISOString().split("T")[0];
    }
  };

  // Function to get date n days ago in YYYY-MM-DD format in user's timezone
  const getDateDaysAgo = (daysAgo: number) => {
    try {
      // Get current date in user's timezone
      const now = new Date();

      // Create a date object for n days ago in UTC
      const pastDate = new Date(now);
      pastDate.setDate(pastDate.getDate() - daysAgo);

      // Format the date in user's timezone
      const date = new Intl.DateTimeFormat("en-US", {
        timeZone: timezone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).formatToParts(pastDate);

      // Extract and format as YYYY-MM-DD
      const month = date.find((part) => part.type === "month")?.value || "01";
      const day = date.find((part) => part.type === "day")?.value || "01";
      const year = date.find((part) => part.type === "year")?.value || "2023";

      return `${year}-${month}-${day}`;
    } catch (error) {
      console.error(
        `Error formatting date ${daysAgo} days ago with timezone:`,
        error
      );
      // Fallback to UTC
      const date = new Date();
      date.setDate(date.getDate() - daysAgo);
      return date.toISOString().split("T")[0];
    }
  };

  // Helper function to get the daily focus goal from user preferences
  const getDailyGoal = useCallback(
    (date: Date = new Date()) => {
      // Get the day of week in user's timezone
      const day = new Date(
        date.toLocaleString("en-US", { timeZone: timezone })
      ).getDay();

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
    },
    [user, timezone]
  );

  // Function to refresh signals and recalculate scores
  const refreshSignals = async () => {
    if (!user) return;

    try {
      // Get dates in user's timezone
      const today = getTodayInUserTimezone();
      const yesterdayStr = getDateDaysAgo(1);
      const dayBeforeYesterdayStr = getDateDaysAgo(2);

      // Fetch today's signals
      const todaySignals = await api.getDailySignals(today);

      // Fetch today's morning entry for journaling signal (only today, not all entries)
      let journalingValue = false;
      try {
        const todayEntryData = await api.getEntry(today);
        // getEntry returns { date, ...fields } or the entry object directly
        const todayEntry = todayEntryData as MorningEntry | null;
        journalingValue = hasJournalingContent(todayEntry);
      } catch (error) {
        console.error(
          "Failed to fetch morning entry for journaling signal:",
          error
        );
      }

      // Fetch sessions near today and compute focusHours signal
      // Use ±1 day UTC padding to account for timezone differences
      let focusHoursValue = false;
      let hoursToday = 0;
      try {
        const todayDate = new Date(today + "T12:00:00Z");
        const startUTC = new Date(todayDate);
        startUTC.setUTCDate(startUTC.getUTCDate() - 1);
        const endUTC = new Date(todayDate);
        endUTC.setUTCDate(endUTC.getUTCDate() + 1);
        const startISO = startUTC.toISOString();
        const endISO = endUTC.toISOString();

        const sessions = (await api.getSessionsByDateRange(startISO, endISO)) as Session[];

        // Filter sessions for today (using timezone-aware filtering)
        const todaySessions = sessions.filter((session) => {
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
            return false;
          }
        });

        // Calculate hours using same reducer logic as elsewhere
        hoursToday = todaySessions.reduce(
          (acc, session) => acc + session.minutes / 60,
          0
        );

        // Get the daily goal for today
        const dailyGoal = getDailyGoal();

        // Focus hours signal is complete if we've met or exceeded the goal
        focusHoursValue = hoursToday >= dailyGoal;

        console.log(
          `[SignalsContext] Focus Hours: ${hoursToday.toFixed(
            1
          )}h / ${dailyGoal}h goal = ${
            focusHoursValue ? "COMPLETE" : "incomplete"
          }`
        );
      } catch (error) {
        console.error("Failed to fetch sessions for focusHours signal:", error);
      }

      // Add computed signals (journaling and focusHours) to signals (overriding any manual values)
      const signalsWithComputed: Record<string, number | boolean> = {
        ...todaySignals,
        journaling: journalingValue,
        focusHours: focusHoursValue,
      };

      setSignals(signalsWithComputed);

      // Persist computed signals to the database so they appear in heatmap/historical scoring
      try {
        const storedJournaling = todaySignals["journaling"];
        if (storedJournaling === undefined || storedJournaling !== journalingValue) {
          await api.recordSignal(today, "journaling", journalingValue ? 1 : 0);
        }
        const storedFocusHours = todaySignals["focusHours"];
        if (storedFocusHours === undefined || storedFocusHours !== (focusHoursValue ? 1 : 0)) {
          await api.recordSignal(today, "focusHours", focusHoursValue ? 1 : 0);
        }
      } catch (error) {
        console.error("Failed to persist computed signals:", error);
      }

      // Get signal history for the past 3 days for shower
      let showerHistory: any[] = [];
      try {
        // Fetch all signal history for the past 3 days
        const historyData = await api.getAllSignalHistory(
          dayBeforeYesterdayStr,
          today
        );
        if (Array.isArray(historyData)) {
          // Filter for shower history only
          showerHistory = historyData.filter(
            (item) => item.metric === "shower"
          );
        }
      } catch (error) {
        console.error("Failed to fetch shower history:", error);
      }

      // Get active signals from user preferences
      const activeSignals = user?.preferences?.activeSignals || [];

      // Get signal goals from user preferences
      const signalGoals = user?.preferences?.signalGoals || {};

      // Get the signal percentage goal threshold (default 75%)
      const signalPercentageGoal = user?.preferences?.signalPercentageGoal || 75;

      // Track total active signals and their scores
      let totalActiveSignals = 0;
      let totalCompletedSignals = 0;
      let totalScore = 0;

      // Track if user has showered in the past 3 days
      let hasShoweredIn3Days = false;

      // Check if user has showered in the past 3 days
      // First check today's shower status
      const todayShowerValue = signalsWithComputed.shower;

      // Check all possible truthy values for shower
      // Cast to unknown first to handle potential string values from API
      const showerVal = todayShowerValue as unknown;
      if (
        showerVal === true ||
        showerVal === "true" ||
        showerVal === 1 ||
        showerVal === "1"
      ) {
        hasShoweredIn3Days = true;
      } else {
        // Check shower history for yesterday and day before
        // Look for any truthy value in the history
        hasShoweredIn3Days = showerHistory.some((item) => {
          const itemDate = item.date;
          const itemValue = item.value;

          // Check if date is in the last 3 days
          const isRecentDate =
            itemDate === today ||
            itemDate === yesterdayStr ||
            itemDate === dayBeforeYesterdayStr;

          // Check if value is truthy in any format
          const isTruthyValue =
            itemValue === true ||
            itemValue === "true" ||
            itemValue === 1 ||
            itemValue === "1";

          return isRecentDate && isTruthyValue;
        });
      }

      // For debugging
      const signalScores: Record<string, number> = {};
      const completionTracker: Record<string, number> = {}; // Track individual signal completion

      // Get the current signals configuration
      const availableSignals = getAvailableSignals(user);

      // Loop through all available signals
      Object.entries(availableSignals).forEach(([key, config]) => {
        // Only count signals that are active
        if (!activeSignals.includes(key)) return;

        // Skip shower as it's handled specially
        if (key === "shower") return;

        totalActiveSignals++;
        const value = signalsWithComputed[key];

        // Calculate completion score for this signal (0-100%)
        let completionScore = 0;
        let completionValue = 0; // How much this contributes to the completion count

        // Different calculation based on signal type
        if (config.type === "binary") {
          // Binary signals: 100% if true, 0% if false
          // Ensure we're checking for any truthy representation of true
          // Cast to unknown to handle potential string values from API
          const binaryVal = value as unknown;
          if (binaryVal === true || binaryVal === "true" || binaryVal === 1) {
            completionScore = 100;
            completionValue = 1;
            // Count as completed if 100%
            totalCompletedSignals++;
          } else {
            // Explicitly set to 0 for false values
            completionScore = 0;
            completionValue = 0;
          }
        } else if (config.type === "scale") {
          // Scale signals (1-5): Convert to percentage
          if (typeof value === "number") {
            completionScore = (value / 5) * 100;

            // Determine completion value for display
            if (completionScore >= signalPercentageGoal) {
              completionValue = 1;
              totalCompletedSignals++;
            } else if (completionScore >= signalPercentageGoal * 0.75) {
              completionValue = 0.75;
              // Do not increment totalCompletedSignals for partial completion
            } else if (completionScore >= signalPercentageGoal * 0.5) {
              completionValue = 0.5;
            } else if (completionScore >= signalPercentageGoal * 0.25) {
              completionValue = 0.25;
            } else {
              completionValue = 0;
            }
          }
        } else if (config.type === "number" || config.type === "water") {
          // Handle number signals with goals
          if (config.hasGoal && key in signalGoals) {
            const goal = signalGoals[key];

            if (typeof value === "number") {
              // For "Minutes to Office" - lower is better (exponential curve)
              if (key === "minutesToOffice") {
                completionScore = scoreMinutesToOffice(value, goal);
                if (value <= goal) {
                  completionValue = 1;
                  totalCompletedSignals++;
                } else {

                  // Determine completion value for display
                  if (completionScore >= signalPercentageGoal) {
                    completionValue = 1;
                    totalCompletedSignals++;
                  } else if (completionScore >= signalPercentageGoal * 0.75) {
                    completionValue = 0.75;
                  } else if (completionScore >= signalPercentageGoal * 0.5) {
                    completionValue = 0.5;
                  } else if (completionScore >= signalPercentageGoal * 0.25) {
                    completionValue = 0.25;
                  } else {
                    completionValue = 0;
                  }
                }
              }
              // For other number metrics - higher is better
              else {
                if (value >= goal) {
                  completionScore = 100;
                  completionValue = 1;
                  totalCompletedSignals++;
                } else {
                  // Partial credit: Calculate percentage of goal achieved
                  completionScore = (value / goal) * 100;

                  // Determine completion value for display
                  if (completionScore >= signalPercentageGoal) {
                    completionValue = 1;
                    totalCompletedSignals++;
                  } else if (completionScore >= signalPercentageGoal * 0.75) {
                    completionValue = 0.75;
                  } else if (completionScore >= signalPercentageGoal * 0.5) {
                    completionValue = 0.5;
                  } else if (completionScore >= signalPercentageGoal * 0.25) {
                    completionValue = 0.25;
                  } else {
                    completionValue = 0;
                  }
                }
              }
            }
          } else {
            // Number signals without goals - can't calculate without reference point
            completionScore = 0;
            completionValue = 0;
          }
        }

        // Store individual signal scores and completion values for debugging
        signalScores[key] = completionScore;
        completionTracker[key] = completionValue;

        // Add this signal's score to the total
        totalScore += completionScore;
      });

      // Special handling for shower signal
      // If shower is active, include it in total count
      if (activeSignals.includes("shower")) {
        totalActiveSignals++;

        if (hasShoweredIn3Days) {
          // If they have showered in past 3 days, count as 100%
          signalScores["shower"] = 100;
          completionTracker["shower"] = 1;
          totalScore += 100;
          totalCompletedSignals++;
        } else {
          // If they haven't showered in 3 days, count as 0%
          signalScores["shower"] = 0;
          completionTracker["shower"] = 0;
          // No penalty, just count as 0%
        }
      }

      // Double-check our totals by summing the completion tracker
      const sumOfCompletions = Object.values(completionTracker).reduce(
        (sum, value) => sum + (value >= 1 ? 1 : 0),
        0
      );

      // Count signals that are at or above the goal threshold as completed
      const displayCompletedSignals = Object.values(signalScores).filter(
        (score) => score >= signalPercentageGoal
      ).length;

      // Calculate average score (0-100)
      let averageScore;

      // Force 100% when all signals are completed
      if (
        displayCompletedSignals === totalActiveSignals &&
        totalActiveSignals > 0
      ) {
        averageScore = 100;
      } else {
        // Otherwise calculate average normally
        averageScore =
          totalActiveSignals > 0
            ? Math.round(totalScore / totalActiveSignals)
            : 0;
      }

      // Ensure the score is between 0 and 100
      averageScore = Math.max(0, Math.min(100, averageScore));

      setSignalScore(averageScore);
      setTotalSignals(totalActiveSignals);
      setCompletedSignals(displayCompletedSignals);

      // --- Signal streak (hybrid +1/-1 with hard reset) ---
      // Hit goal = +1, miss 1 day = -1, miss 2 days in a row = reset to 0.
      // `signalStreakCount` = confirmed score from finalized past days only.
      // `signalStreakDate` = last date fully processed.
      // `signalStreakDanger` = true if last processed day was a miss (on thin ice).
      // Display = confirmedCount + (todayMeetsGoal ? 1 : 0), computed live.
      try {
        const yesterday = getDateDaysAgo(1);
        const storedCount = user?.preferences?.signalStreakCount ?? -1;
        const storedDate = user?.preferences?.signalStreakDate ?? "";
        const storedPoints = user?.preferences?.signalStreakPoints ?? undefined;
        const todayMeetsGoal = averageScore >= signalPercentageGoal;

        // Migration: force a full backfill when the scoring algorithm changes.
        // v1 = initial points system, v2 = force-100% applied to historical scoring, v3 = exponential scoring + goal history.
        const STREAK_ALGO_VERSION = 3;
        const storedAlgoVersion = user?.preferences?.signalStreakAlgoVersion ?? 0;
        const needsMigration = storedPoints === undefined || storedAlgoVersion < STREAK_ALGO_VERSION;

        let confirmedCount = (storedCount === -1 || needsMigration) ? 0 : storedCount;
        let confirmedPoints = storedPoints ?? 0;
        let lastProcessed = storedDate;
        let needsSave = false;

        // Helper: generate YYYY-MM-DD dates between two dates (exclusive start, inclusive end)
        const getDatesBetween = (startDate: string, endDate: string): string[] => {
          const dates: string[] = [];
          const start = new Date(startDate + "T12:00:00Z");
          const end = new Date(endDate + "T12:00:00Z");
          const current = new Date(start);
          current.setUTCDate(current.getUTCDate() + 1);
          while (current <= end) {
            dates.push(current.toISOString().split("T")[0]);
            current.setUTCDate(current.getUTCDate() + 1);
          }
          return dates;
        };

        // Resolve historical active signals and goal history
        const signalActiveHistory = user?.preferences?.signalActiveHistory as { date: string; signals: string[] }[] | undefined;
        const signalGoalHistory = user?.preferences?.signalGoalHistory as { date: string; goals: Record<string, number> }[] | undefined;

        // Process a single day: returns new count and points
        const processDay = (
          daySignals: Record<string, any> | undefined,
          currentCount: number,
          currentPoints: number,
          dateStr?: string,
        ): { count: number; points: number } => {
          let met = false;
          let dayScore = 0;
          if (daySignals && Object.keys(daySignals).length > 0) {
            // Use the active signals list that was in effect on this date
            const dayActive = dateStr
              ? getActiveSignalsForDate(dateStr, activeSignals as string[], signalActiveHistory)
              : activeSignals as string[];
            // Use the goals that were in effect on this date
            const dayGoals = dateStr
              ? getGoalsForDate(dateStr, signalGoals as Record<string, number>, signalGoalHistory)
              : signalGoals as Record<string, number>;
            // Use historicalMode so we only score signals that have data for that day
            dayScore = computeDayScore(
              daySignals,
              dayActive,
              availableSignals,
              dayGoals,
              true,
              signalPercentageGoal,
            );
            met = dayScore >= signalPercentageGoal;
          }

          if (met) {
            const earned = Math.max(0, dayScore - signalPercentageGoal);
            return { count: currentCount + 1, points: currentPoints + earned };
          }
          // Miss — can we pay 100 points to save the streak?
          if (currentPoints >= 100) {
            return { count: currentCount, points: Math.max(0, currentPoints - 100) };
          }
          // Streak lost
          return { count: 0, points: 0 };
        };

        if (storedCount === -1 || !storedDate || needsMigration) {
          // First time — backfill from history
          const backfillStart = getDateDaysAgo(365);
          const historyData = await api.getAllSignalHistory(backfillStart, yesterday);
          const byDate: Record<string, Record<string, any>> = {};
          if (Array.isArray(historyData)) {
            historyData.forEach((item: any) => {
              if (!byDate[item.date]) byDate[item.date] = {};
              byDate[item.date][item.metric] = item.value;
            });
          }

          const datesWithData = Object.keys(byDate).sort();
          if (datesWithData.length > 0) {
            const earliestDate = datesWithData[0];
            const dayBefore = (() => {
              const d = new Date(earliestDate + "T12:00:00Z");
              d.setUTCDate(d.getUTCDate() - 1);
              return d.toISOString().split("T")[0];
            })();
            const allDates = getDatesBetween(dayBefore, yesterday);

            let walkCount = 0;
            let walkPoints = 0;
            let maxStreakSeen = 0;
            for (const dateStr of allDates) {
              const result = processDay(byDate[dateStr], walkCount, walkPoints, dateStr);
              walkCount = result.count;
              walkPoints = result.points;
              if (walkCount > maxStreakSeen) maxStreakSeen = walkCount;
            }

            confirmedCount = walkCount;
            confirmedPoints = walkPoints;
            // Update longest from the full historical walk
            const prevLongestFromPref = user?.preferences?.signalStreakLongest ?? 0;
            if (maxStreakSeen > prevLongestFromPref) {
              setSignalStreakLongest(maxStreakSeen);
              localStorage.setItem("signalStreakLongest", String(maxStreakSeen));
            }
          } else {
            confirmedCount = 0;
            confirmedPoints = 0;
          }

          lastProcessed = yesterday;
          needsSave = true;
        } else if (lastProcessed < yesterday) {
          // Catch up on unprocessed past days
          const historyData = await api.getAllSignalHistory(lastProcessed, yesterday);
          const byDate: Record<string, Record<string, any>> = {};
          if (Array.isArray(historyData)) {
            historyData.forEach((item: any) => {
              if (!byDate[item.date]) byDate[item.date] = {};
              byDate[item.date][item.metric] = item.value;
            });
          }

          const unprocessedDates = getDatesBetween(lastProcessed, yesterday);
          for (const dateStr of unprocessedDates) {
            const result = processDay(byDate[dateStr], confirmedCount, confirmedPoints, dateStr);
            confirmedCount = result.count;
            confirmedPoints = result.points;
          }

          lastProcessed = yesterday;
          needsSave = true;
        }

        // One-time recalculation of personal best if it seems too low
        // (covers the case where signalStreakLongest was added after streak was already running)
        const storedLongest = user?.preferences?.signalStreakLongest ?? 0;
        if (storedLongest < confirmedCount || (storedLongest === 0 && confirmedCount > 0)) {
          // Walk full history to find the true max
          try {
            const fullStart = getDateDaysAgo(730); // 2 years back
            const fullHistory = await api.getAllSignalHistory(fullStart, yesterday);
            const fullByDate: Record<string, Record<string, any>> = {};
            if (Array.isArray(fullHistory)) {
              fullHistory.forEach((item: any) => {
                if (!fullByDate[item.date]) fullByDate[item.date] = {};
                fullByDate[item.date][item.metric] = item.value;
              });
            }

            const fullDatesWithData = Object.keys(fullByDate).sort();
            if (fullDatesWithData.length > 0) {
              const earliest = fullDatesWithData[0];
              const dayBefore = (() => {
                const d = new Date(earliest + "T12:00:00Z");
                d.setUTCDate(d.getUTCDate() - 1);
                return d.toISOString().split("T")[0];
              })();
              const allDatesForMax = getDatesBetween(dayBefore, yesterday);

              let tempCount = 0;
              let tempPoints = 0;
              let historicalMax = 0;
              for (const dateStr of allDatesForMax) {
                const result = processDay(fullByDate[dateStr], tempCount, tempPoints, dateStr);
                tempCount = result.count;
                tempPoints = result.points;
                if (tempCount > historicalMax) historicalMax = tempCount;
              }

              if (historicalMax > storedLongest) {
                setSignalStreakLongest(historicalMax);
                localStorage.setItem("signalStreakLongest", String(historicalMax));
                // Will be persisted below via the longestChanged check
              }
            }
          } catch (err) {
            console.error("Failed to recalculate personal best:", err);
          }
        }

        // Display = confirmed past days + today's live contribution
        const displayCount = confirmedCount + (todayMeetsGoal ? 1 : 0);
        const todayPoints = todayMeetsGoal ? Math.max(0, averageScore - signalPercentageGoal) : 0;
        const displayPoints = confirmedPoints + todayPoints;

        // Danger = vulnerable to streak loss (not enough points to save and today not meeting goal)
        const displayDanger = displayPoints < 100 && !todayMeetsGoal;

        // Track personal best — use the recalculated value if it was updated above
        const recalcLongest = parseInt(localStorage.getItem("signalStreakLongest") || "0", 10);
        const prevLongest = Math.max(user?.preferences?.signalStreakLongest ?? 0, recalcLongest);
        const newLongest = Math.max(prevLongest, displayCount);

        // Track milestones
        const prevMilestones = user?.preferences?.signalStreakMilestones ?? [];
        const newMilestones = [...prevMilestones];
        for (const m of STREAK_MILESTONES) {
          if (displayCount >= m && !newMilestones.includes(m)) {
            newMilestones.push(m);
          }
        }

        setSignalStreak(displayCount);
        setSignalStreakDanger(displayDanger);
        setSignalStreakPoints(displayPoints);
        setSignalStreakLongest(newLongest);
        setSignalStreakMilestones(newMilestones);
        localStorage.setItem("signalStreak", String(displayCount));
        localStorage.setItem("signalStreakDanger", String(displayDanger));
        localStorage.setItem("signalStreakPoints", String(confirmedPoints));
        localStorage.setItem("signalStreakLongest", String(newLongest));
        localStorage.setItem("signalStreakMilestones", JSON.stringify(newMilestones));

        const longestChanged = newLongest !== prevLongest;
        const milestonesChanged = newMilestones.length !== prevMilestones.length;

        if ((needsSave || longestChanged || milestonesChanged) && user?.id) {
          api.updateUserPreferences(user.id, {
            signalStreakCount: confirmedCount,
            signalStreakDate: lastProcessed,
            signalStreakPoints: confirmedPoints,
            signalStreakAlgoVersion: STREAK_ALGO_VERSION,
            signalStreakDanger: false, // deprecated
            ...(longestChanged ? { signalStreakLongest: newLongest } : {}),
            ...(milestonesChanged ? { signalStreakMilestones: newMilestones } : {}),
          }).catch((err: Error) =>
            console.error("Failed to save streak to preferences:", err)
          );
        }
      } catch (streakError) {
        console.error("Failed to calculate signal streak:", streakError);
      }
    } catch (error) {
      console.error("Failed to fetch signals data:", error);
    }
  };

  // Fetch heatmap data: daily scores for a date range (YYYY-MM-DD strings)
  // Uses historical mode scoring: only evaluates signals that had data for each day,
  // so changing which signals are active won't retroactively penalize old days.
  const fetchHeatmapData = useCallback(async (startDate: string, endDate: string): Promise<HeatmapDay[]> => {
    if (!user) return [];

    try {
      const historyData = await api.getAllSignalHistory(startDate, endDate);
      const byDate: Record<string, Record<string, any>> = {};
      if (Array.isArray(historyData)) {
        historyData.forEach((item: any) => {
          if (!byDate[item.date]) byDate[item.date] = {};
          byDate[item.date][item.metric] = item.value;
        });
      }

      const currentActiveSignals = (user?.preferences?.activeSignals || []) as string[];
      const signalActiveHistory = user?.preferences?.signalActiveHistory as { date: string; signals: string[] }[] | undefined;
      const currentSignalGoals = (user?.preferences?.signalGoals || {}) as Record<string, number>;
      const signalGoalHistory = user?.preferences?.signalGoalHistory as { date: string; goals: Record<string, number> }[] | undefined;
      const availableSignals = getAvailableSignals(user);

      const results: HeatmapDay[] = [];
      const current = new Date(startDate + "T12:00:00Z");
      const end = new Date(endDate + "T12:00:00Z");

      while (current <= end) {
        const dateStr = current.toISOString().split("T")[0];
        const daySignals = byDate[dateStr];

        // Use the active signals list and goals that were in effect on this date
        const dayActiveSignals = getActiveSignalsForDate(dateStr, currentActiveSignals, signalActiveHistory);
        const signalGoals = getGoalsForDate(dateStr, currentSignalGoals, signalGoalHistory);

        let score = 0;
        const signalDetails: HeatmapSignalDetail[] = [];

        if (daySignals && Object.keys(daySignals).length > 0) {
          const percentageGoal = (user?.preferences?.signalPercentageGoal || 75) as number;
          score = computeDayScore(daySignals, dayActiveSignals, availableSignals, signalGoals, true, percentageGoal);

          // Build per-signal details for tooltip — show signals that were active on this date
          for (const key of Object.keys(daySignals)) {
            const config = availableSignals[key];
            if (!config) continue;

            const value = daySignals[key];
            let signalScore = 0;

            if (config.type === "binary") {
              signalScore = (value === true || value === "true" || value === 1 || value === "1") ? 100 : 0;
            } else if (config.type === "scale") {
              if (typeof value === "number") signalScore = (value / 5) * 100;
            } else if (config.type === "number" || config.type === "water") {
              if (config.hasGoal && key in signalGoals) {
                const goal = signalGoals[key];
                if (typeof value === "number") {
                  if (key === "minutesToOffice") {
                    signalScore = scoreMinutesToOffice(value, goal);
                  } else {
                    signalScore = value >= goal ? 100 : (value / goal) * 100;
                  }
                }
              }
            }

            signalDetails.push({
              key,
              label: config.label,
              value,
              score: Math.round(signalScore),
              type: config.type,
            });
          }
        }

        results.push({ date: dateStr, score, signals: signalDetails });
        current.setUTCDate(current.getUTCDate() + 1);
      }

      return results;
    } catch (error) {
      console.error("Failed to fetch heatmap data:", error);
      return [];
    }
  }, [user, timezone]);

  // Function to update a signal
  const updateSignal = async (metric: string, value: number | boolean) => {
    // Journaling signal is read-only - it's determined by the Morning page
    if (metric === "journaling") {
      console.log(
        "Journaling signal is read-only. It's automatically tracked from the Morning page."
      );
      return;
    }

    // Focus hours signal is read-only - it's determined by sessions
    if (metric === "focusHours") {
      console.log(
        "Focus Hours signal is read-only. It's automatically tracked from your focus sessions."
      );
      return;
    }

    try {
      const today = getTodayInUserTimezone();

      // Update the signal immediately in the local state first
      setSignals((prev) => ({
        ...prev,
        [metric]: value,
      }));

      // Call the API to update the signal
      await api.recordSignal(today, metric, value);

      // Recalculate scores
      await refreshSignals();

      // Dispatch event to notify other components
      const event = new CustomEvent("signalUpdated");
      window.dispatchEvent(event);
    } catch (error) {
      console.error("Failed to update signal:", error);
    }
  };

  // Initial fetch of signal data
  useEffect(() => {
    // Skip if no user is logged in
    if (!user) return;

    // Initial load - give a small delay to ensure window.AVAILABLE_SIGNALS is set
    setTimeout(() => {
      refreshSignals();
    }, 100);

    // Set up interval to refresh the data every 5 minutes
    const interval = setInterval(refreshSignals, 5 * 60 * 1000);

    // Set up an event listener for signal updates from elsewhere in the app
    const handleSignalUpdate = () => {
      console.log(
        "[SignalsContext] Signal update detected, refreshing signals data"
      );
      refreshSignals();
    };

    // Listen for session updates (new sessions, deleted sessions, etc.)
    const handleSessionUpdate = () => {
      console.log(
        "[SignalsContext] Session update detected, refreshing focusHours signal"
      );
      refreshSignals();
    };

    // Listen for morning entry updates (journaling)
    const handleMorningUpdate = () => {
      console.log(
        "[SignalsContext] Morning entry update detected, refreshing journaling signal"
      );
      refreshSignals();
    };

    // Listen for custom events that will be triggered when updates happen anywhere
    window.addEventListener("signalUpdated", handleSignalUpdate);
    window.addEventListener("sessionCreated", handleSessionUpdate);
    window.addEventListener("sessionDeleted", handleSessionUpdate);
    window.addEventListener("sessionUpdated", handleSessionUpdate);
    window.addEventListener("morningEntryUpdated", handleMorningUpdate);

    return () => {
      clearInterval(interval);
      window.removeEventListener("signalUpdated", handleSignalUpdate);
      window.removeEventListener("sessionCreated", handleSessionUpdate);
      window.removeEventListener("sessionDeleted", handleSessionUpdate);
      window.removeEventListener("sessionUpdated", handleSessionUpdate);
      window.removeEventListener("morningEntryUpdated", handleMorningUpdate);
    };
  }, [user]);

  // Re-fetch signals when timezone changes
  useEffect(() => {
    if (user) {
      refreshSignals();
    }
  }, [timezone, user]);

  // Provide the context to children
  return (
    <SignalsContext.Provider
      value={{
        signals,
        signalScore,
        totalSignals,
        completedSignals,
        signalStreak,
        signalStreakDanger,
        signalStreakPoints,
        signalStreakLongest,
        signalStreakMilestones,
        updateSignal,
        refreshSignals,
        fetchHeatmapData,
      }}
    >
      {children}
    </SignalsContext.Provider>
  );
};

// Custom hook to use the signals context
export const useSignals = () => useContext(SignalsContext);

export default SignalsContext;
