import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from "react";
import { api } from "../utils/api";
import { supabase, getCurrentUserId } from "../utils/supabase";
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
            score = value <= goal ? 100 : 100 * Math.exp(-(value - goal) / 90);
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

  // ── Confirmed streak from past days (computed once on mount) ──
  // These are set by the one-time streak backfill and used to derive
  // the display streak = confirmedStreak + (today meets goal ? 1 : 0).
  const confirmedStreakRef = React.useRef<{
    count: number;
    points: number;
    longest: number;
    milestones: number[];
    computed: boolean;
  }>({ count: 0, points: 0, longest: 0, milestones: [], computed: false });

  // Recompute today's score from current signals state and update display.
  // This is cheap — no DB calls, just math on the current state.
  const recomputeTodayScore = useCallback((currentSignals: Record<string, number | boolean>) => {
    if (!user) return;
    const prefs = user.preferences || {};
    const activeSignals = (prefs.activeSignals || []) as string[];
    const signalGoals = (prefs.signalGoals || {}) as Record<string, number>;
    const signalPercentageGoal: number = prefs.signalPercentageGoal || 75;
    const availableSignals = getAvailableSignals(user);

    const todayScore = computeDayScore(currentSignals, activeSignals, availableSignals, signalGoals, false);

    // Count completed signals
    let completed = 0;
    for (const key of activeSignals) {
      const config = availableSignals[key];
      if (!config) continue;
      const score = currentSignals[key] !== undefined
        ? computeDayScore({ [key]: currentSignals[key] }, [key], availableSignals, signalGoals, false)
        : 0;
      if (score >= signalPercentageGoal) completed++;
    }

    const ref = confirmedStreakRef.current;
    const todayMeets = todayScore >= signalPercentageGoal;
    const displayCount = ref.count + (todayMeets ? 1 : 0);
    const displayPoints = ref.points + (todayMeets ? Math.max(0, todayScore - signalPercentageGoal) : 0);
    const displayDanger = displayPoints < 100 && !todayMeets;
    const displayLongest = Math.max(ref.longest, displayCount);

    const MILESTONES = [7, 14, 30, 60, 100, 200, 365];
    const newMilestones = [...ref.milestones];
    for (const m of MILESTONES) {
      if (displayCount >= m && !newMilestones.includes(m)) newMilestones.push(m);
    }

    setSignalScore(todayScore);
    setCompletedSignals(completed);
    setTotalSignals(activeSignals.length);
    setSignalStreak(displayCount);
    setSignalStreakDanger(displayDanger);
    setSignalStreakPoints(displayPoints);
    setSignalStreakLongest(displayLongest);
    setSignalStreakMilestones(newMilestones);

    // Cache
    localStorage.setItem("signalStreak", String(displayCount));
    localStorage.setItem("signalStreakDanger", String(displayDanger));
    localStorage.setItem("signalStreakPoints", String(displayPoints));
    localStorage.setItem("signalStreakLongest", String(displayLongest));
    localStorage.setItem("signalStreakMilestones", JSON.stringify(newMilestones));

    // Update tray
    if (window.electron?.send) {
      const trayText = displayCount > 0 ? ` ${displayCount} · ${todayScore}%` : ` ${todayScore}%`;
      window.electron.send("update-signal-tray", { text: trayText, goalMet: todayMeets });
    }
  }, [user]);

  // One-time client-side streak backfill from signal history.
  // Runs once on mount when the edge function is unavailable.
  const computeStreakOnce = async (today: string) => {
    if (!user || confirmedStreakRef.current.computed) return;
    confirmedStreakRef.current.computed = true;

    try {
      const prefs = user.preferences || {};
      const activeSignals = (prefs.activeSignals || []) as string[];
      const signalGoals = (prefs.signalGoals || {}) as Record<string, number>;
      const signalPercentageGoal: number = prefs.signalPercentageGoal || 75;
      const signalActiveHistory = prefs.signalActiveHistory as { date: string; signals: string[] }[] | undefined;
      const availableSignals = getAvailableSignals(user);

      const startDate = (() => {
        const d = new Date(today + "T12:00:00Z");
        d.setUTCDate(d.getUTCDate() - 365);
        return d.toISOString().split("T")[0];
      })();

      const yesterday = (() => {
        const d = new Date(new Date().getTime() - 86400000);
        try {
          const parts = new Intl.DateTimeFormat("en-US", {
            timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit",
          }).formatToParts(d);
          const m = parts.find(p => p.type === "month")?.value || "01";
          const dy = parts.find(p => p.type === "day")?.value || "01";
          const y = parts.find(p => p.type === "year")?.value || "2024";
          return `${y}-${m}-${dy}`;
        } catch { return d.toISOString().split("T")[0]; }
      })();

      // Paginate to fetch ALL signal data (Supabase default limit is 1000 rows)
      const PAGE_SIZE = 1000;
      const userId = await getCurrentUserId();
      let allHistory: any[] = [];
      let offset = 0;
      while (true) {
        const { data: page, error: fetchErr } = await supabase
          .from("signals")
          .select("date, metric, value")
          .eq("user_id", userId)
          .gte("date", startDate)
          .lte("date", yesterday)
          .order("date", { ascending: true })
          .range(offset, offset + PAGE_SIZE - 1);
        if (fetchErr) { console.error("[Signals] Fetch error:", fetchErr.message); break; }
        allHistory = allHistory.concat(page || []);
        if (!page || page.length < PAGE_SIZE) break;
        offset += PAGE_SIZE;
      }

      console.log("[Signals] Fetched", allHistory.length, "signal entries for streak backfill");

      const byDate: Record<string, Record<string, any>> = {};
      for (const item of allHistory) {
        if (!byDate[item.date]) byDate[item.date] = {};
        byDate[item.date][item.metric] = item.value;
      }
      applyShower3DayWindow(byDate);

      const datesWithData = Object.keys(byDate).sort();
      if (datesWithData.length === 0) {
        console.log("[Signals] No historical data for streak computation");
        return;
      }

      const earliest = datesWithData[0];
      const allDates: string[] = [];
      const cur = new Date(earliest + "T12:00:00Z");
      const end = new Date(yesterday + "T12:00:00Z");
      while (cur <= end) {
        allDates.push(cur.toISOString().split("T")[0]);
        cur.setUTCDate(cur.getUTCDate() + 1);
      }

      // One-time streak protection: clamp last 20 days to goal during migration
      const STREAK_PROTECTION_DAYS = 20;
      const protectionCutoff = (() => {
        const d = new Date(today + "T12:00:00Z");
        d.setUTCDate(d.getUTCDate() - STREAK_PROTECTION_DAYS);
        return d.toISOString().split("T")[0];
      })();

      let streak = 0;
      let points = 0;
      let maxStreak = 0;

      for (const dateStr of allDates) {
        const daySignals = byDate[dateStr];
        let dayScore = 0;
        if (daySignals && Object.keys(daySignals).length > 0) {
          const dayActive = getActiveSignalsForDate(dateStr, activeSignals, signalActiveHistory);
          dayScore = computeDayScore(daySignals, dayActive, availableSignals, signalGoals, true);
        }

        if (dateStr > protectionCutoff && dayScore < signalPercentageGoal) {
          dayScore = signalPercentageGoal;
        }

        if (dayScore >= signalPercentageGoal) {
          streak++;
          points += Math.max(0, dayScore - signalPercentageGoal);
        } else if (points >= 100) {
          points = Math.max(0, points - 100);
        } else {
          streak = 0;
          points = 0;
        }
        if (streak > maxStreak) maxStreak = streak;
      }

      console.log("[Signals] Streak backfill complete — confirmed past streak:", streak, "points:", Math.round(points));

      confirmedStreakRef.current = {
        count: streak,
        points,
        longest: Math.max(prefs.signalStreakLongest ?? 0, maxStreak),
        milestones: prefs.signalStreakMilestones ?? [],
        computed: true,
      };
    } catch (error) {
      console.error("[Signals] Streak backfill failed:", error);
    }
  };

  // Function to refresh signals by calling the edge function
  const refreshSignals = async () => {
    if (!user) return;

    try {
      const today = getTodayInUserTimezone();

      // Try the edge function first
      const { data: sessionData } = await supabase.auth.refreshSession();
      const accessToken = sessionData?.session?.access_token;
      let edgeSuccess = false;

      if (accessToken) {
        try {
          const supabaseUrl = process.env.SUPABASE_URL || "";
          const supabaseKey = process.env.SUPABASE_ANON_KEY || "";
          const response = await fetch(`${supabaseUrl}/functions/v1/compute-daily-score`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${accessToken}`,
              "apikey": supabaseKey,
            },
            body: JSON.stringify({ date: today, timezone }),
          });

          if (response.ok) {
            const data = await response.json();
            if (data?.signals) {
              console.log("[Signals] Edge function success — streak:", data.streak?.count, "score:", data.score);
              edgeSuccess = true;

              setSignals(data.signals);
              setSignalScore(data.score);
              setTotalSignals(data.totalSignals);
              setCompletedSignals(data.completedSignals);
              setSignalStreak(data.streak.count);
              setSignalStreakDanger(data.streak.danger);
              setSignalStreakPoints(data.streak.points);
              setSignalStreakLongest(data.streak.longest);
              setSignalStreakMilestones(data.streak.milestones);

              // Also update the confirmed streak ref so local updates work
              confirmedStreakRef.current = {
                count: data.streak.count - (data.score >= (user?.preferences?.signalPercentageGoal || 75) ? 1 : 0),
                points: data.streak.points,
                longest: data.streak.longest,
                milestones: data.streak.milestones,
                computed: true,
              };

              if (window.electron?.send) {
                const signalGoal = user?.preferences?.signalPercentageGoal || 75;
                const trayText = data.streak.count > 0 ? ` ${data.streak.count} · ${data.score}%` : ` ${data.score}%`;
                window.electron.send("update-signal-tray", { text: trayText, goalMet: data.score >= signalGoal });
              }

              localStorage.setItem("signalStreak", String(data.streak.count));
              localStorage.setItem("signalStreakDanger", String(data.streak.danger));
              localStorage.setItem("signalStreakPoints", String(data.streak.points));
              localStorage.setItem("signalStreakLongest", String(data.streak.longest));
              localStorage.setItem("signalStreakMilestones", JSON.stringify(data.streak.milestones));
            }
          }
        } catch (e) {
          // Edge function failed, fall through to client-side
        }
      }

      // Fallback: load signals from DB and compute score locally
      if (!edgeSuccess) {
        await loadSignalsFromDB();
        // Compute streak once on first failure, then just update today's score
        if (!confirmedStreakRef.current.computed) {
          await computeStreakOnce(today);
        }
        // Recompute today's score from current signals state
        setSignals((currentSignals) => {
          // Use setTimeout to avoid state update during render
          setTimeout(() => recomputeTodayScore(currentSignals), 0);
          return currentSignals;
        });
      }
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
      // Paginate to fetch ALL signal data (Supabase default limit is 1000 rows)
      const heatmapUserId = await getCurrentUserId();
      let historyData: any[] = [];
      let hmOffset = 0;
      const HM_PAGE = 1000;
      while (true) {
        const { data: page, error: fetchErr } = await supabase
          .from("signals")
          .select("date, metric, value")
          .eq("user_id", heatmapUserId)
          .gte("date", paddedStart)
          .lte("date", endDate)
          .order("date", { ascending: true })
          .range(hmOffset, hmOffset + HM_PAGE - 1);
        if (fetchErr) break;
        historyData = historyData.concat(page || []);
        if (!page || page.length < HM_PAGE) break;
        hmOffset += HM_PAGE;
      }

      const byDate: Record<string, Record<string, any>> = {};
      for (const item of historyData) {
        if (!byDate[item.date]) byDate[item.date] = {};
        byDate[item.date][item.metric] = item.value;
      }
      applyShower3DayWindow(byDate);

      const currentActiveSignals = (user?.preferences?.activeSignals || []) as string[];
      const signalActiveHistory = user?.preferences?.signalActiveHistory as { date: string; signals: string[] }[] | undefined;
      const signalGoals = (user?.preferences?.signalGoals || {}) as Record<string, number>;
      const signalPercentageGoal: number = (user?.preferences?.signalPercentageGoal as number) || 75;
      const availableSignals = getAvailableSignals(user);

      // Clamp below-goal days in the last 20 days to the goal threshold.
      // Historical _dailyScore values may have been computed by a different
      // algorithm; this ensures they display consistently with the streak.
      // Naturally expires as correct scores are recorded going forward.
      const protectionCutoff = (() => {
        const d = new Date();
        d.setUTCDate(d.getUTCDate() - 20);
        return d.toISOString().split("T")[0];
      })();

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

          // Apply streak protection: clamp below-goal days in the last 20 days
          if (dateStr > protectionCutoff && score < signalPercentageGoal && score > 0) {
            score = signalPercentageGoal;
          }

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
                    signalScore = value <= goal ? 100 : 100 * Math.exp(-(value - goal) / 90);
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

      // Update the signal immediately in the local state and recompute score
      const newSignals = { ...signals, [metric]: value };
      setSignals(newSignals);

      // Immediately recompute today's score from updated signals
      recomputeTodayScore(newSignals);

      // Call the API to update the signal
      await api.recordSignal(today, metric, value);

      // Try the edge function (will use client-side fallback if it fails)
      await refreshSignals();

      // Dispatch event to notify other components
      const event = new CustomEvent("signalUpdated");
      window.dispatchEvent(event);
    } catch (error) {
      console.error("Failed to update signal:", error);
    }
  };

  // Load today's raw signal values directly from the DB for instant display.
  // The edge function (refreshSignals) may take a moment or fail; this ensures
  // the UI shows persisted values immediately on mount.
  // Also loads streak data from user preferences as a fallback when the edge
  // function is unavailable.
  const loadSignalsFromDB = useCallback(async () => {
    if (!user) return;
    try {
      const today = getTodayInUserTimezone();
      const rows = await api.getSignalRange(today, today);
      if (Array.isArray(rows) && rows.length > 0) {
        const dbSignals: Record<string, number | boolean> = {};
        let dailyScore: number | undefined;
        for (const row of rows) {
          if (row.metric === "_dailyScore") {
            dailyScore = Number(row.value);
          } else if (row.metric && !row.metric.startsWith("_")) {
            dbSignals[row.metric] = row.value;
          }
        }
        // Only merge into existing state so we don't overwrite
        // optimistic updates that may have happened before this returns
        setSignals((prev) => {
          const hasExistingData = Object.keys(prev).some(
            (k) => prev[k] !== false && prev[k] !== 0
          );
          // If we already have meaningful data (e.g., from edge function), skip
          if (hasExistingData) return prev;
          return { ...prev, ...dbSignals };
        });
        // Use the persisted daily score if available
        if (dailyScore !== undefined) {
          setSignalScore((prev) => prev || dailyScore!);
        }
      }

      // Derive totalSignals from active signals config so the sidebar card
      // renders even when the edge function hasn't returned yet.
      const activeSignals = (user.preferences?.activeSignals || []) as string[];
      if (activeSignals.length > 0) {
        setTotalSignals((prev) => prev || activeSignals.length);
      }

      // Load streak from user preferences when edge function is unavailable
      const prefs = user.preferences;
      console.log("[Signals] Fallback load — streakCount in prefs:", prefs?.signalStreakCount, "activeSignals:", activeSignals.length);
      if (prefs) {
        if (prefs.signalStreakCount !== undefined) {
          setSignalStreak((prev) => prev || prefs.signalStreakCount);
          localStorage.setItem("signalStreak", String(prefs.signalStreakCount));
        }
        if (prefs.signalStreakDanger !== undefined) {
          setSignalStreakDanger(prefs.signalStreakDanger);
        }
        if (prefs.signalStreakPoints !== undefined) {
          setSignalStreakPoints((prev) => prev || prefs.signalStreakPoints);
        }
        if (prefs.signalStreakLongest !== undefined) {
          setSignalStreakLongest((prev) => prev || prefs.signalStreakLongest);
        }
        if (prefs.signalStreakMilestones !== undefined) {
          setSignalStreakMilestones((prev) => prev.length > 0 ? prev : prefs.signalStreakMilestones);
        }
      }
    } catch (error) {
      console.error("Failed to load signals from DB:", error);
    }
  }, [user, timezone]);

  // Initial fetch of signal data
  useEffect(() => {
    if (!user) return;

    // Load raw signal values from DB immediately (fast, no edge function)
    loadSignalsFromDB();

    // Then call the edge function for scoring/streak (may be slower)
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

  // Streak-at-risk notifications: alert the user during the evening if the
  // day's signal goal isn't met. Aggressive when truly in danger (no points
  // banked); gentler single nudge when they have a save-point cushion.
  useEffect(() => {
    if (signalStreak <= 0) return;

    const percentageGoal = (user?.preferences?.signalPercentageGoal as number) || 75;
    const todayMeets = signalScore >= percentageGoal;
    if (todayMeets) return;

    // No save banked → full danger. Save banked → cushioned, single late nudge.
    const aggressive = signalStreakDanger;
    const thresholds = aggressive
      ? [
          { hour: 21, key: "21", label: "3 hours" },
          { hour: 23, key: "23", label: "1 hour" },
          { hour: 23.75, key: "2345", label: "15 minutes" },
        ]
      : [{ hour: 21, key: "21-save", label: "3 hours" }];

    const todayKey = (() => {
      try {
        return new Intl.DateTimeFormat("en-CA", {
          timeZone: timezone,
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        }).format(new Date());
      } catch {
        return new Date().toISOString().split("T")[0];
      }
    })();

    const check = () => {
      const now = new Date();
      const localHour = now.getHours() + now.getMinutes() / 60;
      for (const t of thresholds) {
        if (localHour < t.hour) continue;
        const storageKey = `streakDangerNotified:${todayKey}:${t.key}`;
        if (localStorage.getItem(storageKey) === "true") continue;
        const title = aggressive ? "Streak in danger" : "Signal goal not yet met";
        const body = aggressive
          ? `Your ${signalStreak}-day streak is at risk — ${t.label} left to hit today's signal goal.`
          : `You've got a save banked, but try to hit today's signal goal — ${t.label} left.`;
        if (typeof Notification !== "undefined") {
          if (Notification.permission === "granted") {
            new Notification(title, { body });
          } else if (Notification.permission !== "denied") {
            Notification.requestPermission().then((permission) => {
              if (permission === "granted") {
                new Notification(title, { body });
              }
            });
          }
        }
        localStorage.setItem(storageKey, "true");
      }
    };

    check();
    const interval = setInterval(check, 60 * 1000);
    return () => clearInterval(interval);
  }, [signalStreakDanger, signalStreak, signalScore, user, timezone]);

  // Auto-flip the Anki signal when local Anki data shows the day's queue is
  // cleared. One-way only: we never flip back to false, so manual toggles and
  // prior completions are preserved even if the queue grows again later.
  useEffect(() => {
    if (!user) return;
    const ankiApi = window.electron?.anki;
    if (!ankiApi?.readStats) return;

    const availableSignals = getAvailableSignals(user);
    const activeSignals = (user.preferences?.activeSignals || []) as string[];
    const ankiKey = activeSignals.find((k) => {
      const cfg = availableSignals[k];
      return /anki/i.test(k) || (cfg?.label && /anki/i.test(cfg.label));
    });
    if (!ankiKey) return;

    let cancelled = false;
    const check = async () => {
      try {
        const stats = await ankiApi.readStats();
        if (cancelled || !stats?.ok) return;
        if (stats.reviewsToday > 0 && stats.dueRemaining === 0 && signals[ankiKey] !== true) {
          updateSignal(ankiKey, true);
        }
      } catch {
        /* noop */
      }
    };

    check();
    const onFocus = () => check();
    window.addEventListener("focus", onFocus);
    const interval = setInterval(check, 5 * 60 * 1000);
    return () => {
      cancelled = true;
      window.removeEventListener("focus", onFocus);
      clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, signals]);

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
