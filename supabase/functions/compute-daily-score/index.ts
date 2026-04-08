import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

// ── Types ──────────────────────────────────────────────────────

interface SignalConfig {
  key: string;
  label: string;
  type: "binary" | "number" | "water" | "scale";
  max_value?: number;
  has_goal: boolean;
  is_computed?: boolean;
  unit?: string;
  isCustom?: boolean;
}

// ── Constants ──────────────────────────────────────────────────

const STREAK_ALGO_VERSION = 5;
const STREAK_MILESTONES = [7, 14, 30, 60, 100, 200, 365];
const JOURNALING_MIN_CHARS = 1000;

// Number of recent days to protect during v5 migration backfill.
// Scores below the goal threshold are clamped to the threshold
// so the user's current streak is preserved.
const V5_STREAK_PROTECTION_DAYS = 20;

// ── Helpers ────────────────────────────────────────────────────

function isTruthy(v: unknown): boolean {
  return v === true || v === "true" || v === 1 || v === "1";
}

/** Compute score for a single signal. Returns 0-100. */
function scoreSignal(
  key: string,
  value: unknown,
  config: SignalConfig,
  signalGoals: Record<string, number>,
): number {
  if (value === undefined || value === null) return 0;

  if (config.type === "binary") {
    return isTruthy(value) ? 100 : 0;
  }

  if (config.type === "scale") {
    return typeof value === "number" ? (value / 5) * 100 : 0;
  }

  if (config.type === "number" || config.type === "water") {
    if (!config.has_goal || !(key in signalGoals)) return 0;
    const goal = signalGoals[key];
    if (typeof value !== "number") return 0;

    if (key === "minutesToOffice") {
      // Lower is better
      return value <= goal ? 100 : Math.max(0, 100 - ((value - goal) / goal) * 100);
    }
    // Higher is better
    return value >= goal ? 100 : (value / goal) * 100;
  }

  return 0;
}

/** Score a full day. Returns 0-100. */
function computeDayScore(
  daySignals: Record<string, unknown>,
  activeSignals: string[],
  configs: Record<string, SignalConfig>,
  signalGoals: Record<string, number>,
  historicalMode: boolean,
): number {
  // If a live score was persisted, use it directly.
  if (daySignals._dailyScore !== undefined && daySignals._dailyScore !== null) {
    return Math.round(Number(daySignals._dailyScore));
  }

  const signalsToEvaluate = historicalMode
    ? activeSignals.filter((k) => daySignals[k] !== undefined && daySignals[k] !== null)
    : activeSignals;

  let totalActive = 0;
  let totalScore = 0;

  for (const key of signalsToEvaluate) {
    const config = configs[key];
    if (!config) continue;
    totalActive++;
    totalScore += scoreSignal(key, daySignals[key], config, signalGoals);
  }

  if (totalActive === 0) return 0;
  return Math.round(totalScore / totalActive);
}

/** Apply shower 3-day window to a byDate map. */
function applyShower3DayWindow(byDate: Record<string, Record<string, unknown>>) {
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
}

/** Get active signals for a historical date using the signalActiveHistory log. */
function getActiveSignalsForDate(
  date: string,
  currentActive: string[],
  history: { date: string; signals: string[] }[] | undefined,
): string[] {
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
}

/** Generate YYYY-MM-DD dates between two dates (exclusive start, inclusive end). */
function getDatesBetween(startDate: string, endDate: string): string[] {
  const dates: string[] = [];
  const current = new Date(startDate + "T12:00:00Z");
  const end = new Date(endDate + "T12:00:00Z");
  current.setUTCDate(current.getUTCDate() + 1);
  while (current <= end) {
    dates.push(current.toISOString().split("T")[0]);
    current.setUTCDate(current.getUTCDate() + 1);
  }
  return dates;
}

/** Get YYYY-MM-DD for n days before a given date string. */
function daysBeforeDate(dateStr: string, n: number): string {
  const d = new Date(dateStr + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().split("T")[0];
}

/** Check if a writing entry has enough content for the journaling signal. */
function hasJournalingContent(activityContent: Record<string, unknown> | null): boolean {
  if (!activityContent) return false;
  let total = 0;
  const { writing, gratitude, affirmations } = activityContent as Record<string, string>;
  if (writing) total += writing.trim().length;
  if (gratitude) total += gratitude.trim().length;
  if (affirmations) total += affirmations.trim().length;
  return total >= JOURNALING_MIN_CHARS;
}

/** Get today's date in user's timezone as YYYY-MM-DD. */
function getDateInTimezone(timezone: string, date: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const month = parts.find((p) => p.type === "month")?.value || "01";
  const day = parts.find((p) => p.type === "day")?.value || "01";
  const year = parts.find((p) => p.type === "year")?.value || "2024";
  return `${year}-${month}-${day}`;
}

// ── Main handler ───────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing auth" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { date, timezone } = await req.json();
    if (!date || !timezone) {
      return new Response(JSON.stringify({ error: "date and timezone required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create a Supabase client with the user's JWT for RLS
    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    // Service-role client for writes that bypass RLS (persisting scores/streak)
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Get the authenticated user
    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Invalid auth" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = user.id;

    // ── 1. Load user preferences ───────────────────────────────
    const { data: profile } = await supabaseUser
      .from("profiles")
      .select("preferences")
      .eq("id", userId)
      .single();

    const prefs = profile?.preferences || {};
    const activeSignals: string[] = prefs.activeSignals || [];
    const signalGoals: Record<string, number> = prefs.signalGoals || {};
    const signalPercentageGoal: number = prefs.signalPercentageGoal || 75;
    const customSignals: Record<string, SignalConfig> = prefs.customSignals || {};
    const signalActiveHistory = prefs.signalActiveHistory as { date: string; signals: string[] }[] | undefined;
    const dailyHoursGoals: Record<string, number> = prefs.dailyHoursGoals || {};

    // ── 2. Load signal configs from DB, merge with custom ──────
    const { data: dbConfigs } = await supabaseUser.from("signal_configs").select("*");
    const configs: Record<string, SignalConfig> = {};
    if (dbConfigs) {
      for (const c of dbConfigs) {
        configs[c.key] = {
          key: c.key,
          label: c.label,
          type: c.type,
          max_value: c.max_value,
          has_goal: c.has_goal,
          is_computed: c.is_computed,
          unit: c.unit,
        };
      }
    }
    // Merge user custom signals
    for (const [key, cfg] of Object.entries(customSignals)) {
      configs[key] = { ...cfg, key, isCustom: true };
    }

    // ── 3. Load today's signals ────────────────────────────────
    const { data: signalRows } = await supabaseUser
      .from("signals")
      .select("metric, value")
      .eq("user_id", userId)
      .eq("date", date);

    const todaySignals: Record<string, unknown> = {};
    if (signalRows) {
      for (const s of signalRows) {
        todaySignals[s.metric] = s.value;
      }
    }

    // ── 4. Compute journaling signal ───────────────────────────
    const { data: writingEntry } = await supabaseUser
      .from("writings")
      .select("activity_content")
      .eq("user_id", userId)
      .eq("date", date)
      .maybeSingle();

    const journalingValue = hasJournalingContent(writingEntry?.activity_content || null);
    todaySignals.journaling = journalingValue;

    // Persist if changed
    const storedJournaling = signalRows?.find((s) => s.metric === "journaling")?.value;
    if (storedJournaling === undefined || storedJournaling !== (journalingValue ? 1 : 0)) {
      await supabaseAdmin.from("signals").upsert(
        { user_id: userId, date, metric: "journaling", value: journalingValue ? 1 : 0 },
        { onConflict: "user_id,date,metric" },
      );
    }

    // ── 5. Compute focusHours signal ───────────────────────────
    // Get the day-of-week name in the user's timezone to look up the daily goal
    const dateObj = new Date(date + "T12:00:00Z");
    const dayNames = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
    const dayInTz = new Date(dateObj.toLocaleString("en-US", { timeZone: timezone }));
    const dayName = dayNames[dayInTz.getDay()];
    const dailyGoal = dailyHoursGoals[dayName] ?? 4;

    // Fetch sessions for this date (±1 day UTC padding for timezone safety)
    const startUTC = new Date(dateObj);
    startUTC.setUTCDate(startUTC.getUTCDate() - 1);
    const endUTC = new Date(dateObj);
    endUTC.setUTCDate(endUTC.getUTCDate() + 1);

    const { data: sessions } = await supabaseUser
      .from("sessions")
      .select("minutes, created_at")
      .eq("user_id", userId)
      .gte("created_at", startUTC.toISOString())
      .lte("created_at", endUTC.toISOString());

    // Filter sessions to only those whose created_at falls on the target date in user's timezone
    let hoursToday = 0;
    if (sessions) {
      for (const s of sessions) {
        const sessionDate = getDateInTimezone(timezone, new Date(s.created_at));
        if (sessionDate === date) {
          hoursToday += (s.minutes || 0) / 60;
        }
      }
    }
    const focusHoursValue = hoursToday >= dailyGoal;
    todaySignals.focusHours = focusHoursValue;

    // Persist if changed
    const storedFocusHours = signalRows?.find((s) => s.metric === "focusHours")?.value;
    if (storedFocusHours === undefined || storedFocusHours !== (focusHoursValue ? 1 : 0)) {
      await supabaseAdmin.from("signals").upsert(
        { user_id: userId, date, metric: "focusHours", value: focusHoursValue ? 1 : 0 },
        { onConflict: "user_id,date,metric" },
      );
    }

    // ── 6. Apply shower 3-day window ───────────────────────────
    if (activeSignals.includes("shower") && !isTruthy(todaySignals.shower)) {
      const twoDaysAgo = daysBeforeDate(date, 2);
      const { data: showerHistory } = await supabaseUser
        .from("signals")
        .select("date, value")
        .eq("user_id", userId)
        .eq("metric", "shower")
        .gte("date", twoDaysAgo)
        .lt("date", date);

      if (showerHistory?.some((s) => isTruthy(s.value))) {
        todaySignals.shower = 1;
      }
    }

    // ── 7. Score each active signal ────────────────────────────
    let totalActive = 0;
    let totalScore = 0;
    let completedSignals = 0;
    const signalScores: Record<string, number> = {};

    for (const key of activeSignals) {
      const config = configs[key];
      if (!config) continue;

      totalActive++;
      const score = scoreSignal(key, todaySignals[key], config, signalGoals);
      signalScores[key] = score;
      totalScore += score;

      if (score >= signalPercentageGoal) {
        completedSignals++;
      }
    }

    // ── 8. Compute average score (NO force-100%) ───────────────
    const averageScore = totalActive > 0 ? Math.round(totalScore / totalActive) : 0;
    const finalScore = Math.max(0, Math.min(100, averageScore));

    // Persist _dailyScore
    await supabaseAdmin.from("signals").upsert(
      { user_id: userId, date, metric: "_dailyScore", value: finalScore },
      { onConflict: "user_id,date,metric" },
    );

    // ── 9. Streak logic ────────────────────────────────────────
    const storedCount = prefs.signalStreakCount ?? -1;
    const storedDate = prefs.signalStreakDate ?? "";
    const storedPoints = prefs.signalStreakPoints ?? undefined;
    const storedAlgoVersion = prefs.signalStreakAlgoVersion ?? 0;
    const todayMeetsGoal = finalScore >= signalPercentageGoal;

    const needsMigration = storedPoints === undefined || storedAlgoVersion < STREAK_ALGO_VERSION;

    let confirmedCount = (storedCount === -1 || needsMigration) ? 0 : storedCount;
    let confirmedPoints = storedPoints ?? 0;
    let lastProcessed = storedDate;
    let needsSave = false;
    let maxStreakSeen = prefs.signalStreakLongest ?? 0;

    // Get yesterday in user's timezone
    const nowDate = new Date();
    const yesterday = getDateInTimezone(timezone, new Date(nowDate.getTime() - 86400000));

    /** Process a single day for streak. */
    const processDay = (
      daySignals: Record<string, unknown> | undefined,
      currentCount: number,
      currentPoints: number,
      dateStr: string,
      clampFloor?: number,
    ): { count: number; points: number } => {
      let dayScore = 0;
      if (daySignals && Object.keys(daySignals).length > 0) {
        const dayActive = getActiveSignalsForDate(dateStr, activeSignals, signalActiveHistory);
        dayScore = computeDayScore(daySignals, dayActive, configs, signalGoals, true);
      }
      // Apply clamping if specified (v5 migration streak protection)
      if (clampFloor !== undefined && dayScore < clampFloor) {
        dayScore = clampFloor;
      }

      const met = dayScore >= signalPercentageGoal;

      if (met) {
        const earned = Math.max(0, dayScore - signalPercentageGoal);
        return { count: currentCount + 1, points: currentPoints + earned };
      }
      // Miss — spend 100 points to save?
      if (currentPoints >= 100) {
        return { count: currentCount, points: Math.max(0, currentPoints - 100) };
      }
      // Streak lost
      return { count: 0, points: 0 };
    };

    if (storedCount === -1 || !storedDate || needsMigration) {
      // Full backfill from history
      const backfillStart = daysBeforeDate(date, 365);
      const { data: historyData } = await supabaseUser
        .from("signals")
        .select("date, metric, value")
        .eq("user_id", userId)
        .gte("date", backfillStart)
        .lte("date", yesterday);

      const byDate: Record<string, Record<string, unknown>> = {};
      if (historyData) {
        for (const item of historyData) {
          if (!byDate[item.date]) byDate[item.date] = {};
          byDate[item.date][item.metric] = item.value;
        }
      }
      applyShower3DayWindow(byDate);

      const datesWithData = Object.keys(byDate).sort();
      if (datesWithData.length > 0) {
        const earliest = datesWithData[0];
        const dayBefore = daysBeforeDate(earliest, 1);
        const allDates = getDatesBetween(dayBefore, yesterday);

        // For v5 migration: determine the protection cutoff date
        // Days within the last V5_STREAK_PROTECTION_DAYS get clamped to goal threshold
        const isV5Migration = storedAlgoVersion < STREAK_ALGO_VERSION;
        const protectionCutoff = isV5Migration
          ? daysBeforeDate(date, V5_STREAK_PROTECTION_DAYS)
          : "";

        let walkCount = 0;
        let walkPoints = 0;
        for (const dateStr of allDates) {
          // Apply streak protection: clamp scores for recent days during v5 migration
          const clampFloor = (isV5Migration && dateStr > protectionCutoff)
            ? signalPercentageGoal
            : undefined;
          const result = processDay(byDate[dateStr], walkCount, walkPoints, dateStr, clampFloor);
          walkCount = result.count;
          walkPoints = result.points;
          if (walkCount > maxStreakSeen) maxStreakSeen = walkCount;
        }

        confirmedCount = walkCount;
        confirmedPoints = walkPoints;
      } else {
        confirmedCount = 0;
        confirmedPoints = 0;
      }

      lastProcessed = yesterday;
      needsSave = true;
    } else if (lastProcessed < yesterday) {
      // Catch up on unprocessed past days
      const showerPaddedStart = daysBeforeDate(lastProcessed, 2);
      const { data: historyData } = await supabaseUser
        .from("signals")
        .select("date, metric, value")
        .eq("user_id", userId)
        .gte("date", showerPaddedStart)
        .lte("date", yesterday);

      const byDate: Record<string, Record<string, unknown>> = {};
      if (historyData) {
        for (const item of historyData) {
          if (!byDate[item.date]) byDate[item.date] = {};
          byDate[item.date][item.metric] = item.value;
        }
      }
      applyShower3DayWindow(byDate);

      const unprocessedDates = getDatesBetween(lastProcessed, yesterday);
      for (const dateStr of unprocessedDates) {
        const result = processDay(byDate[dateStr], confirmedCount, confirmedPoints, dateStr);
        confirmedCount = result.count;
        confirmedPoints = result.points;
        if (confirmedCount > maxStreakSeen) maxStreakSeen = confirmedCount;
      }

      lastProcessed = yesterday;
      needsSave = true;
    }

    // Display = confirmed past days + today's live contribution
    const displayCount = confirmedCount + (todayMeetsGoal ? 1 : 0);
    const todayPoints = todayMeetsGoal ? Math.max(0, finalScore - signalPercentageGoal) : 0;
    const displayPoints = confirmedPoints + todayPoints;
    const displayDanger = displayPoints < 100 && !todayMeetsGoal;

    const prevLongest = prefs.signalStreakLongest ?? 0;
    const newLongest = Math.max(prevLongest, maxStreakSeen, displayCount);

    const prevMilestones: number[] = prefs.signalStreakMilestones ?? [];
    const newMilestones = [...prevMilestones];
    for (const m of STREAK_MILESTONES) {
      if (displayCount >= m && !newMilestones.includes(m)) {
        newMilestones.push(m);
      }
    }

    // ── 10. Persist streak to preferences ──────────────────────
    const longestChanged = newLongest !== prevLongest;
    const milestonesChanged = newMilestones.length !== prevMilestones.length;

    if (needsSave || longestChanged || milestonesChanged) {
      const streakUpdate: Record<string, unknown> = {
        signalStreakCount: confirmedCount,
        signalStreakDate: lastProcessed,
        signalStreakPoints: confirmedPoints,
        signalStreakAlgoVersion: STREAK_ALGO_VERSION,
      };
      if (longestChanged) streakUpdate.signalStreakLongest = newLongest;
      if (milestonesChanged) streakUpdate.signalStreakMilestones = newMilestones;

      // Merge into existing preferences
      const { data: currentProfile } = await supabaseAdmin
        .from("profiles")
        .select("preferences")
        .eq("id", userId)
        .single();

      const existingPrefs = currentProfile?.preferences || {};
      await supabaseAdmin
        .from("profiles")
        .update({ preferences: { ...existingPrefs, ...streakUpdate } })
        .eq("id", userId);
    }

    // ── 11. Return response ────────────────────────────────────
    // Build signals map for client (exclude internal _dailyScore)
    const signalsForClient: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(todaySignals)) {
      if (!k.startsWith("_")) signalsForClient[k] = v;
    }

    const response = {
      score: finalScore,
      totalSignals: totalActive,
      completedSignals,
      signals: signalsForClient,
      streak: {
        count: displayCount,
        danger: displayDanger,
        points: displayPoints,
        longest: newLongest,
        milestones: newMilestones,
      },
    };

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("compute-daily-score error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
