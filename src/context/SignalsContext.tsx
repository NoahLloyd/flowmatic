import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from "react";
import { api } from "../utils/api";
import { supabase } from "../utils/supabase";
import { useAuth } from "./AuthContext";
import { useTimezone } from "./TimezoneContext";
import { AVAILABLE_SIGNALS as ImportedAvailableSignals, getAllSignals, SignalConfig } from "../pages/settings/components/SignalSettings";

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

// ── Helpers for heatmap (client-side historical scoring) ───────

function isTruthy(v: unknown): boolean {
  return v === true || v === "true" || v === 1 || v === "1";
}

/** Compute a signal score for a single day's worth of signal data.
 *  Used by fetchHeatmapData for days without a persisted _dailyScore. */
const computeDayScore = (
  daySignals: Record<string, any>,
  activeSignals: string[],
  availableSignals: Record<string, SignalConfig>,
  signalGoals: Record<string, number>,
  historicalMode: boolean = false,
): number => {
  // If a live score was persisted, use it directly.
  if (daySignals._dailyScore !== undefined && daySignals._dailyScore !== null) {
    return Math.round(Number(daySignals._dailyScore));
  }

  const signalsToEvaluate = historicalMode
    ? activeSignals.filter((key) => daySignals[key] !== undefined && daySignals[key] !== null)
    : activeSignals;

  let totalActive = 0;
  let totalScore = 0;

  for (const key of signalsToEvaluate) {
    const config = availableSignals[key];
    if (!config) continue;

    totalActive++;
    const value = daySignals[key];

    if (value === undefined || value === null) continue;

    let score = 0;

    if (config.type === "binary") {
      score = isTruthy(value) ? 100 : 0;
    } else if (config.type === "scale") {
      if (typeof value === "number") {
        score = (value / 5) * 100;
      }
    } else if (config.type === "number" || config.type === "water") {
      if (config.hasGoal && key in signalGoals) {
        const goal = signalGoals[key];
        if (typeof value === "number") {
          if (key === "minutesToOffice") {
            score = value <= goal ? 100 : Math.max(0, 100 - ((value - goal) / goal) * 100);
          } else {
            score = value >= goal ? 100 : (value / goal) * 100;
          }
        }
      }
    }

    totalScore += score;
  }

  if (totalActive === 0) return 0;
  return Math.round(totalScore / totalActive);
};

/** Resolve which signals were active on a given date using the signalActiveHistory log. */
const getActiveSignalsForDate = (
  date: string,
  currentActive: string[],
  history: { date: string; signals: string[] }[] | undefined,
): string[] => {
  if (!history || history.length === 0) return currentActive;
  let applicable = history[0].signals;
  for (const entry of history) {
    if (entry.date <= date) {
      applicable = entry.signals;
    } else {
      break;
    }
  }
  return applicable;
};

/** Get the current signals configuration (including custom signals). */
const getAvailableSignals = (user: any) => {
  const customSignals = user?.preferences?.customSignals as Record<string, SignalConfig> | undefined;
  return getAllSignals(customSignals);
};

/** Apply shower 3-day window to a byDate map. */
const applyShower3DayWindow = (byDate: Record<string, Record<string, any>>) => {
  const dates = Object.keys(byDate).sort();
  for (const dateStr of dates) {
    if (isTruthy(byDate[dateStr]?.shower)) continue;
    const d = new Date(dateStr + "T12:00:00Z");
    for (let i = 1; i <= 2; i++) {
      const prev = new Date(d);
      prev.setUTCDate(prev.getUTCDate() - i);
      const prevStr = prev.toISOString().split("T")[0];
      if (isTruthy(byDate[prevStr]?.shower)) {
        if (!byDate[dateStr]) byDate[dateStr] = {};
        byDate[dateStr].shower = 1;
        break;
      }
    }
  }
};

// ── Provider component ────────────────────────────────────────

export const SignalsProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const { user } = useAuth();
  const { timezone } = useTimezone();
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

  // Function to get today's date in YYYY-MM-DD format in user's timezone
  const getTodayInUserTimezone = () => {
    try {
      const date = new Intl.DateTimeFormat("en-US", {
        timeZone: timezone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).formatToParts(new Date());

      const month = date.find((part) => part.type === "month")?.value || "01";
      const day = date.find((part) => part.type === "day")?.value || "01";
      const year = date.find((part) => part.type === "year")?.value || "2023";

      return `${year}-${month}-${day}`;
    } catch (error) {
      console.error("Error formatting date with timezone:", error);
      return new Date().toISOString().split("T")[0];
    }
  };

  // Function to refresh signals by calling the edge function
  const refreshSignals = async () => {
    if (!user) return;

    try {
      const today = getTodayInUserTimezone();

      const { data, error } = await supabase.functions.invoke("compute-daily-score", {
        body: { date: today, timezone },
      });

      if (error) {
        console.error("Failed to compute daily score:", error);
        return;
      }

      setSignals(data.signals);
      setSignalScore(data.score);
      setTotalSignals(data.totalSignals);
      setCompletedSignals(data.completedSignals);

      setSignalStreak(data.streak.count);
      setSignalStreakDanger(data.streak.danger);
      setSignalStreakPoints(data.streak.points);
      setSignalStreakLongest(data.streak.longest);
      setSignalStreakMilestones(data.streak.milestones);

      // Update the signal tray in the menu bar
      if (window.electron?.send) {
        const signalGoal = user?.preferences?.signalPercentageGoal || 75;
        const trayText = data.streak.count > 0 ? ` ${data.streak.count} · ${data.score}%` : ` ${data.score}%`;
        window.electron.send("update-signal-tray", { text: trayText, goalMet: data.score >= signalGoal });
      }

      // Cache in localStorage for instant display on next load
      localStorage.setItem("signalStreak", String(data.streak.count));
      localStorage.setItem("signalStreakDanger", String(data.streak.danger));
      localStorage.setItem("signalStreakPoints", String(data.streak.points));
      localStorage.setItem("signalStreakLongest", String(data.streak.longest));
      localStorage.setItem("signalStreakMilestones", JSON.stringify(data.streak.milestones));
    } catch (error) {
      console.error("Failed to fetch signals data:", error);
    }
  };

  // Fetch heatmap data: daily scores for a date range (YYYY-MM-DD strings)
  // Uses historical mode scoring: only evaluates signals that had data for each day,
  // so changing which signals are active won't retroactively penalize old days.
  // This stays client-side since most days have a persisted _dailyScore.
  const fetchHeatmapData = useCallback(async (startDate: string, endDate: string): Promise<HeatmapDay[]> => {
    if (!user) return [];

    try {
      // Fetch 2 extra days before startDate so shower 3-day window works for the first days
      const paddedStart = (() => {
        const d = new Date(startDate + "T12:00:00Z");
        d.setUTCDate(d.getUTCDate() - 2);
        return d.toISOString().split("T")[0];
      })();
      const historyData = await api.getAllSignalHistory(paddedStart, endDate);
      const byDate: Record<string, Record<string, any>> = {};
      if (Array.isArray(historyData)) {
        historyData.forEach((item: any) => {
          if (!byDate[item.date]) byDate[item.date] = {};
          byDate[item.date][item.metric] = item.value;
        });
      }
      applyShower3DayWindow(byDate);

      const currentActiveSignals = (user?.preferences?.activeSignals || []) as string[];
      const signalActiveHistory = user?.preferences?.signalActiveHistory as { date: string; signals: string[] }[] | undefined;
      const signalGoals = (user?.preferences?.signalGoals || {}) as Record<string, number>;
      const availableSignals = getAvailableSignals(user);

      const results: HeatmapDay[] = [];
      const current = new Date(startDate + "T12:00:00Z");
      const end = new Date(endDate + "T12:00:00Z");

      while (current <= end) {
        const dateStr = current.toISOString().split("T")[0];
        const daySignals = byDate[dateStr];

        const dayActiveSignals = getActiveSignalsForDate(dateStr, currentActiveSignals, signalActiveHistory);

        let score = 0;
        const signalDetails: HeatmapSignalDetail[] = [];

        if (daySignals && Object.keys(daySignals).length > 0) {
          score = computeDayScore(daySignals, dayActiveSignals, availableSignals, signalGoals, true);

          // Build per-signal details for tooltip
          for (const key of Object.keys(daySignals)) {
            const config = availableSignals[key];
            if (!config) continue;

            const value = daySignals[key];
            let signalScore = 0;

            if (config.type === "binary") {
              signalScore = isTruthy(value) ? 100 : 0;
            } else if (config.type === "scale") {
              if (typeof value === "number") signalScore = (value / 5) * 100;
            } else if (config.type === "number" || config.type === "water") {
              if (config.hasGoal && key in signalGoals) {
                const goal = signalGoals[key];
                if (typeof value === "number") {
                  if (key === "minutesToOffice") {
                    signalScore = value <= goal ? 100 : Math.max(0, 100 - ((value - goal) / goal) * 100);
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

      // Recalculate scores via edge function
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
    if (!user) return;

    setTimeout(() => {
      refreshSignals();
    }, 100);

    // Refresh every 5 minutes
    const interval = setInterval(refreshSignals, 5 * 60 * 1000);

    const handleSignalUpdate = () => refreshSignals();
    const handleSessionUpdate = () => refreshSignals();
    const handleMorningUpdate = () => refreshSignals();

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
