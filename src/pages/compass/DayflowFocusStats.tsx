import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { api } from "../../utils/api";
import { getAppDayDate, getAppDayKey } from "../../utils/appDay";

// DayflowFocusStats renders three progress cards — daily, weekly, yearly — in
// the Dayflow Compass variant. Each card shows progress toward the same goals
// the classic view uses, but the actual hours come from Dayflow.
//
// Per day we count whichever is larger: the focus hours Dayflow observed, or the
// hours you logged as Flowmatic sessions. That way a day where you tracked more
// with the timer than Dayflow saw still counts the higher number.
//
// Dayflow's numbers are persisted into `user.preferences.dayflowDailyFocus`
// (a { "YYYY-MM-DD": hours } map) so week/year totals survive restarts and keep
// accumulating even as Dayflow prunes its own history. Each sync re-reads every
// day Dayflow still has and merges with a max, so a day that was saved early
// (before Dayflow finished analysing it) gets corrected upward later and never
// regresses. Tracked-session hours live in Supabase already, so they're overlaid
// live at display time rather than persisted here.

type FocusMap = Record<string, number>;

// Local (not UTC) YYYY-MM-DD, matching how Dayflow keys its `day` column and how
// we bucket session `created_at` timestamps.
function dayKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

const DAY_NAMES = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
];

const fmtHours = (h: number) => h.toFixed(1).replace(/\.0$/, "");

function getYearStart(prefs: any): Date {
  return prefs?.yearlyHoursGoal?.startDate
    ? new Date(prefs.yearlyHoursGoal.startDate)
    : new Date(getAppDayDate().getFullYear(), 0, 1);
}

const DayflowFocusStats: React.FC = () => {
  const { user, updateUserPreferences } = useAuth();

  const [dayflowMap, setDayflowMap] = useState<FocusMap>(
    () => (user?.preferences?.dayflowDailyFocus as FocusMap) || {},
  );
  const [trackedByDay, setTrackedByDay] = useState<FocusMap>({});

  // Refs keep the latest preferences + updater available to the stable
  // sync callbacks without re-binding the mount/focus listeners each render.
  const prefsRef = useRef<any>(user?.preferences || {});
  useEffect(() => {
    prefsRef.current = user?.preferences || {};
  }, [user?.preferences]);

  const updateRef = useRef(updateUserPreferences);
  useEffect(() => {
    updateRef.current = updateUserPreferences;
  }, [updateUserPreferences]);

  const lastTrackedDayRef = useRef<string>("");

  // Read Dayflow's local DB (cheap), merge every returned day into the stored
  // map with a max, and persist if anything changed.
  const syncDayflow = useCallback(async () => {
    const bridge = window.electron?.dayflow;
    if (!bridge?.getFocus) return;
    try {
      const res = await bridge.getFocus();
      // Compare against the literal (not `!res.ok`) so the discriminated union
      // narrows — this project compiles without strictNullChecks, where
      // truthiness-negation narrowing doesn't apply.
      if (res.ok === false) {
        console.error("[dayflow] read failed:", res.error);
        return;
      }
      const stored = (prefsRef.current?.dayflowDailyFocus as FocusMap) || {};
      const merged: FocusMap = { ...stored };
      for (const row of res.days) {
        if (row && typeof row.day === "string") {
          const val = Number((row.focusHours || 0).toFixed(3));
          merged[row.day] = Math.max(merged[row.day] || 0, val);
        }
      }
      setDayflowMap(merged);
      if (JSON.stringify(merged) !== JSON.stringify(stored)) {
        try {
          await updateRef.current({ dayflowDailyFocus: merged });
        } catch (e) {
          console.error("[dayflow] failed to persist focus map", e);
        }
      }
    } catch (e) {
      console.error("[dayflow] sync error", e);
    }
  }, []);

  // Pull this year's Flowmatic sessions and bucket them into per-day hours, for
  // the max() overlay against Dayflow's numbers.
  const fetchTracked = useCallback(async () => {
    try {
      const yearStart = getYearStart(prefsRef.current);
      const sessions = await api.getSessionsByDateRange(
        yearStart.toISOString(),
        new Date().toISOString(),
      );
      const byDay: FocusMap = {};
      for (const s of sessions) {
        if (!s.created_at) continue;
        const k = getAppDayKey(new Date(s.created_at));
        byDay[k] = (byDay[k] || 0) + (s.minutes || 0) / 60;
      }
      setTrackedByDay(byDay);
      lastTrackedDayRef.current = getAppDayKey();
    } catch (e) {
      console.error("[dayflow] tracked-session fetch failed", e);
    }
  }, []);

  useEffect(() => {
    syncDayflow();
    fetchTracked();

    // Dayflow is local + cheap, so re-read it whenever we regain focus (it may
    // have analysed more while away). Tracked sessions only change on session
    // events or a day rollover, so we avoid re-querying the year on every focus.
    const onFocus = () => {
      syncDayflow();
      if (lastTrackedDayRef.current !== getAppDayKey()) fetchTracked();
    };
    const onSession = () => fetchTracked();

    window.addEventListener("focus", onFocus);
    window.addEventListener("sessionCreated", onSession);
    window.addEventListener("sessionUpdated", onSession);
    window.addEventListener("sessionDeleted", onSession);
    return () => {
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("sessionCreated", onSession);
      window.removeEventListener("sessionUpdated", onSession);
      window.removeEventListener("sessionDeleted", onSession);
    };
  }, [syncDayflow, fetchTracked]);

  const stats = useMemo(() => {
    const prefs = user?.preferences || {};
    const dailyGoals: Record<string, number> = prefs.dailyHoursGoals || {};

    const weeklyTarget = [
      "monday",
      "tuesday",
      "wednesday",
      "thursday",
      "friday",
      "saturday",
      "sunday",
    ].reduce((sum, name) => sum + (dailyGoals[name] ?? 4), 0);
    const yearlyTarget = prefs.yearlyHoursGoal?.hoursPerYear ?? 1400;
    const yearStart = getYearStart(prefs);

    // Whichever source saw more focus for a given day wins.
    const effective = (k: string) =>
      Math.max(dayflowMap[k] || 0, trackedByDay[k] || 0);

    const now = new Date();
    const appDay = getAppDayDate(now);
    const todayKey = getAppDayKey(now);
    const calendarTodayKey = dayKey(now);
    // Before 3 AM, Dayflow's midnight-based current bucket is still part of
    // Flowmatic's previous app day. Session-based focus is already re-bucketed.
    const dayflowToday = calendarTodayKey === todayKey
      ? dayflowMap[todayKey] || 0
      : (dayflowMap[todayKey] || 0) + (dayflowMap[calendarTodayKey] || 0);
    const today = Math.max(dayflowToday, trackedByDay[todayKey] || 0);

    // Expected progress through today's goal, ramping 9am → 4pm (mirrors the
    // classic FriendsProgressStats pace model).
    let expectedDailyProgress = 100;
    const start = new Date(appDay);
    start.setHours(9, 0, 0, 0);
    const end = new Date(appDay);
    end.setHours(16, 0, 0, 0);
    if (now < start) {
      expectedDailyProgress = 0;
    } else if (now < end) {
      const minutesSinceStart = (now.getTime() - start.getTime()) / 60000;
      expectedDailyProgress = Math.min(
        100,
        Math.round((minutesSinceStart / (7 * 60)) * 100),
      );
    }

    const todayTarget = dailyGoals[DAY_NAMES[appDay.getDay()]] ?? 4;
    const expectedDailyHours = (todayTarget * expectedDailyProgress) / 100;
    const todayOffset = today - expectedDailyHours;
    const todayProgress =
      todayTarget > 0 ? Math.round((today / todayTarget) * 100) : 0;

    // This week (Monday-based), summing the effective hours per day.
    const weekStart = new Date(appDay);
    weekStart.setHours(0, 0, 0, 0);
    const dow = weekStart.getDay();
    const daysFromMonday = dow === 0 ? 6 : dow - 1;
    weekStart.setDate(weekStart.getDate() - daysFromMonday);

    let week = 0;
    for (let i = 0; i <= daysFromMonday; i++) {
      const d = new Date(weekStart);
      d.setDate(weekStart.getDate() + i);
      const key = dayKey(d);
      week += key === todayKey ? today : effective(key);
    }

    const passedNames = [
      "monday",
      "tuesday",
      "wednesday",
      "thursday",
      "friday",
      "saturday",
      "sunday",
    ].slice(0, daysFromMonday);
    const expectedWeeklyHours =
      passedNames.reduce((sum, name) => sum + (dailyGoals[name] ?? 4), 0) +
      expectedDailyHours;
    const weeklyOffset = week - expectedWeeklyHours;
    const weeklyProgress =
      weeklyTarget > 0 ? Math.round((week / weeklyTarget) * 100) : 0;
    const weeklyExpectedProgress =
      weeklyTarget > 0
        ? Math.min(100, Math.round((expectedWeeklyHours / weeklyTarget) * 100))
        : 0;

    // This year: sum effective hours across every day we know about on/after the
    // year-start key (string compare works because keys are zero-padded).
    const yearStartKey = dayKey(yearStart);
    const allKeys = new Set([
      ...Object.keys(dayflowMap),
      ...Object.keys(trackedByDay),
    ]);
    allKeys.add(todayKey);
    let year = 0;
    for (const k of allKeys) {
      if (k >= yearStartKey && k <= todayKey) {
        year += k === todayKey ? today : effective(k);
      }
    }

    const dayOfYear = Math.max(
      0,
      Math.floor((appDay.getTime() - yearStart.getTime()) / 86400000),
    );
    const daysInYear = 365 + (appDay.getFullYear() % 4 === 0 ? 1 : 0);
    const expectedYearlyProgress =
      ((dayOfYear + expectedDailyProgress / 100) / daysInYear) * yearlyTarget;
    const yearlyOffset = year - expectedYearlyProgress;
    const yearlyProgress =
      yearlyTarget > 0 ? Math.round((year / yearlyTarget) * 100) : 0;
    const yearlyExpectedProgress =
      yearlyTarget > 0
        ? Math.min(
            100,
            Math.round((expectedYearlyProgress / yearlyTarget) * 100),
          )
        : 0;

    return {
      today,
      todayTarget,
      todayProgress,
      todayExpectedProgress: expectedDailyProgress,
      todayOffset,
      week,
      weeklyTarget,
      weeklyProgress,
      weeklyExpectedProgress,
      weeklyOffset,
      year,
      yearlyTarget,
      yearlyProgress,
      yearlyExpectedProgress,
      yearlyOffset,
    };
  }, [dayflowMap, trackedByDay, user?.preferences]);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      <ProgressCard
        label="hours today"
        value={fmtHours(stats.today)}
        target={stats.todayTarget}
        progress={stats.todayProgress}
        expected={stats.todayExpectedProgress}
        offset={stats.todayOffset}
      />
      <ProgressCard
        label="hours week"
        value={fmtHours(stats.week)}
        target={stats.weeklyTarget}
        progress={stats.weeklyProgress}
        expected={stats.weeklyExpectedProgress}
        offset={stats.weeklyOffset}
      />
      <ProgressCard
        label="hours year"
        value={Math.round(stats.year).toString()}
        target={stats.yearlyTarget}
        progress={stats.yearlyProgress}
        expected={stats.yearlyExpectedProgress}
        offset={stats.yearlyOffset}
      />
    </div>
  );
};

// A single progress card: a faint expected-progress fill, a colored
// actual-progress fill, and an expected-pace tick, with the number / target /
// offset overlaid.
const ProgressCard: React.FC<{
  label: string;
  value: string;
  target: number;
  progress: number;
  expected: number;
  offset: number;
}> = ({ label, value, target, progress, expected, offset }) => {
  const ahead = offset >= 0;
  return (
    <div className="relative overflow-hidden rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
      <div
        className="absolute inset-0 bg-gray-100 dark:bg-gray-800 opacity-30"
        style={{ width: `${expected}%` }}
      />
      <div
        className={`absolute inset-0 ${
          ahead
            ? "bg-green-100 dark:bg-green-900/30"
            : "bg-red-100 dark:bg-red-900/30"
        }`}
        style={{ width: `${Math.min(100, progress)}%` }}
      />
      <div
        className="absolute top-0 bottom-0 w-px bg-gray-400 dark:bg-gray-500"
        style={{ left: `${expected}%` }}
      />
      <div className="relative p-4">
        <div className="flex items-baseline gap-1">
          <span className="text-2xl font-bold text-gray-900 dark:text-white tabular-nums">
            {value}
          </span>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            / {target}
          </span>
          <span
            className={`text-xs font-medium ${
              ahead
                ? "text-green-600 dark:text-green-400"
                : "text-red-600 dark:text-red-400"
            }`}
          >
            ({ahead ? "+" : ""}
            {Math.round(offset)}h)
          </span>
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{label}</p>
      </div>
    </div>
  );
};

export default DayflowFocusStats;
