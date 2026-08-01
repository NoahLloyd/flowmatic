import React, { useEffect, useState } from "react";
import { useSignals, HeatmapDay } from "../../context/SignalsContext";
import { useAuth } from "../../context/AuthContext";
import { useTimezone } from "../../context/TimezoneContext";
import { getAppDayKey } from "../../utils/appDay";

// Focus-mode replacement for BlockedTasks. Drops the bulky hero card in
// favor of a tall, scannable history strip: a small streak chip at the
// top, then a row per day for the last ~3 weeks. Each row is a date label
// + thin completion bar + percentage. The vertical real estate finally
// has a job — showing the trend you're carrying.

interface Props {
  onClick?: () => void;
}

const FireIcon: React.FC<{ color: string; glowColor: string; size?: number }> = ({
  color,
  glowColor,
  size = 18,
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M12 1.5C12 1.5 5 8.5 5 14C5 18.1 8.1 21.5 12 21.5C15.9 21.5 19 18.1 19 14C19 8.5 12 1.5 12 1.5Z"
      fill={color}
    />
    <path
      d="M12 9C12 9 8.5 12.5 8.5 15.2C8.5 17.3 10.1 19 12 19C13.9 19 15.5 17.3 15.5 15.2C15.5 12.5 12 9 12 9Z"
      fill={glowColor}
    />
  </svg>
);

function flameTheme(goalMet: boolean, isDanger: boolean) {
  if (isDanger)
    return {
      flame: "#ef4444",
      glow: "#fca5a5",
      text: "text-red-500 dark:text-red-400",
      barClass: "bg-red-500",
      todayText: "text-red-500 dark:text-red-400",
    };
  if (goalMet)
    return {
      // Mirror the sidebar streak card exactly so the panel and the
      // sidebar speak with the same green.
      flame: "#22c55e",
      glow: "#86efac",
      text: "text-emerald-500 dark:text-emerald-400",
      barClass: "bg-emerald-500",
      todayText: "text-emerald-500 dark:text-emerald-400",
    };
  return {
    flame: "#f97316",
    glow: "#fde047",
    text: "text-orange-500 dark:text-orange-400",
    barClass: "bg-orange-500",
    todayText: "text-orange-500 dark:text-orange-400",
  };
}

const formatDayLabel = (iso: string): string => {
  const d = new Date(iso + "T00:00:00");
  const weekday = d.toLocaleDateString(undefined, { weekday: "short" });
  return weekday;
};

const CompassStreakPanel: React.FC<Props> = ({ onClick }) => {
  const { user } = useAuth();
  const { timezone } = useTimezone();
  const {
    signalStreak,
    signalStreakDanger,
    signalScore,
    fetchHeatmapData,
  } = useSignals();
  const signalGoal = (user?.preferences?.signalPercentageGoal as number) || 75;

  const [days, setDays] = useState<HeatmapDay[]>([]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        // Last 21 days, oldest → newest. The list will reverse it for
        // newest-on-top display.
        const today = getAppDayKey(new Date(), timezone);
        const end = today;
        const startDate = new Date(today + "T00:00:00");
        startDate.setDate(startDate.getDate() - 20);
        const start = new Intl.DateTimeFormat("en-CA").format(startDate);
        const data = await fetchHeatmapData(start, end);
        if (cancelled) return;
        // Backfill: pad to 21 entries even if API returns fewer.
        const byDate = new Map<string, HeatmapDay>();
        for (const d of data) byDate.set(d.date, d);
        const rows: HeatmapDay[] = [];
        for (let i = 20; i >= 0; i--) {
          const d = new Date(today + "T00:00:00");
          d.setDate(d.getDate() - i);
          const iso = new Intl.DateTimeFormat("en-CA").format(d);
          rows.push(
            byDate.get(iso) || { date: iso, score: 0, signals: [] as any }
          );
        }
        setDays(rows);
      } catch (e) {
        console.error("Failed to load streak history:", e);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [fetchHeatmapData, timezone, signalScore]);

  const goalMet = signalScore >= signalGoal;
  const t = flameTheme(goalMet, signalStreakDanger);

  // Newest at top so today is the first thing the eye sees.
  const ordered = [...days].reverse();
  const todayISO = ordered[0]?.date;

  return (
    <div
      onClick={onClick}
      className={`rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 h-full flex flex-col overflow-hidden transition-colors ${
        onClick ? "cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/40" : ""
      }`}
    >
      {/* "Now" row — flame + streak count sit in the label slot just
          like the weekday labels do for history rows below. One row,
          mirrors the history layout but with bolder text, themed
          colors, and a slightly thicker bar. */}
      {(() => {
        const todayPct = signalScore;
        return (
          <div className="px-4 py-3 flex items-center gap-3">
            <div className="flex items-center gap-1.5 w-12 flex-shrink-0">
              <FireIcon color={t.flame} glowColor={t.glow} size={16} />
              <span
                className={`text-base font-bold tabular-nums leading-none ${t.text}`}
              >
                {signalStreak}
              </span>
            </div>
            <div className="flex-1 h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${t.barClass}`}
                style={{ width: `${Math.min(todayPct, 100)}%` }}
              />
            </div>
            <span
              className={`text-base font-bold tabular-nums w-10 text-right flex-shrink-0 ${t.todayText}`}
            >
              {todayPct}%
            </span>
          </div>
        );
      })()}

      {/* Divider — full width, separates "now" from history */}
      <div className="h-px bg-gray-200 dark:bg-gray-800" />

      {/* History rows — past days only; today is rendered above. */}
      <div
        className="flex-1 min-h-0 overflow-y-auto py-2 [&::-webkit-scrollbar]:hidden"
        style={{ scrollbarWidth: "none" }}
      >
        {ordered
          .filter((day) => day.date !== todayISO)
          .map((day) => {
            const pct = Math.round(day.score);
            const hit = pct >= signalGoal;
            // Muted versions of the same hue so goal-hit / missed reads
            // at a glance without competing with today's vivid bar. The
            // history is supporting context, not the headline.
            const historyBar = hit
              ? "bg-emerald-500/30 dark:bg-emerald-500/25"
              : pct === 0
              ? "bg-gray-200/70 dark:bg-gray-700/60"
              : "bg-orange-400/25 dark:bg-orange-400/20";
            return (
              <div
                key={day.date}
                className="flex items-center gap-3 px-4 py-1.5"
              >
                <span className="text-[11px] tabular-nums w-12 flex-shrink-0 text-gray-400 dark:text-gray-500">
                  {formatDayLabel(day.date)}
                </span>
                <div className="flex-1 h-1 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${historyBar}`}
                    style={{ width: `${Math.min(pct, 100)}%` }}
                  />
                </div>
                <span className="text-[11px] tabular-nums w-10 text-right flex-shrink-0 text-gray-400 dark:text-gray-500">
                  {pct}%
                </span>
              </div>
            );
          })}
      </div>
    </div>
  );
};

export default CompassStreakPanel;
