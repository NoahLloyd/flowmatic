import React, { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { useSignals } from "../../context/SignalsContext";
import { HeatmapDay, HeatmapSignalDetail } from "../../context/SignalsContext";
import { useAuth } from "../../context/AuthContext";
import { getAllSignals, SignalConfig } from "../../pages/settings/components/SignalSettings";
import {
  Flame,
  Trophy,
  ArrowLeft,
  Target,
  TrendingUp,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

const MILESTONES = [7, 14, 30, 60, 100, 200, 365];

const MILESTONE_LABELS: Record<number, string> = {
  7: "1 Week",
  14: "2 Weeks",
  30: "1 Month",
  60: "2 Months",
  100: "100 Days",
  200: "200 Days",
  365: "1 Year",
};

const MONTH_LABELS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

// Format as YYYY-MM-DD using local date parts (not UTC via toISOString)
const formatLocalDate = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

interface StreakScreenProps {
  onClose: () => void;
}

const StreakScreen: React.FC<StreakScreenProps> = ({ onClose }) => {
  const {
    signalStreak,
    signalStreakDanger,
    signalStreakLongest,
    signalStreakMilestones,
    signalScore,
    signals,
    fetchHeatmapData,
  } = useSignals();
  const { user } = useAuth();

  const [rawHeatmapData, setRawHeatmapData] = useState<HeatmapDay[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedYear, setSelectedYear] = useState(() =>
    new Date().getFullYear()
  );
  const [tooltip, setTooltip] = useState<{
    day: HeatmapDay;
    x: number;
    y: number;
  } | null>(null);
  const heatmapRef = useRef<HTMLDivElement>(null);

  const signalPercentageGoal =
    user?.preferences?.signalPercentageGoal || 75;
  const currentYear = new Date().getFullYear();
  const todayStr = formatLocalDate(new Date());

  // Build today's live signal details from context state
  const todayEntry = useMemo((): HeatmapDay => {
    const activeSignals = (user?.preferences?.activeSignals || []) as string[];
    const signalGoals = (user?.preferences?.signalGoals || {}) as Record<string, number>;
    const availableSignals = getAllSignals(
      user?.preferences?.customSignals as Record<string, SignalConfig> | undefined
    );

    const details: HeatmapSignalDetail[] = [];
    for (const key of activeSignals) {
      const config = availableSignals[key];
      if (!config) continue;

      const value = signals[key];
      if (value === undefined || value === null) continue;

      let score = 0;
      if (config.type === "binary") {
        const binaryVal = value as unknown;
        score = (binaryVal === true || binaryVal === "true" || binaryVal === 1 || binaryVal === "1") ? 100 : 0;
      } else if (config.type === "scale") {
        if (typeof value === "number") score = (value / 5) * 100;
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

      details.push({
        key,
        label: config.label,
        value,
        score: Math.round(score),
        type: config.type,
      });
    }

    return { date: todayStr, score: signalScore, signals: details };
  }, [signals, signalScore, user, todayStr]);

  // Merge raw fetched data with today's live entry
  const heatmapData = useMemo(() => {
    if (selectedYear !== currentYear) return rawHeatmapData;

    const merged = [...rawHeatmapData];
    const todayIdx = merged.findIndex((d) => d.date === todayStr);
    if (todayIdx >= 0) {
      merged[todayIdx] = todayEntry;
    } else if (merged.length > 0) {
      merged.push(todayEntry);
    }
    return merged;
  }, [rawHeatmapData, todayEntry, selectedYear, currentYear, todayStr]);

  // Load heatmap data for the selected year (no dependency on live signals)
  const loadYear = useCallback(
    async (year: number) => {
      setIsLoading(true);
      const startDate = `${year}-01-01`;
      const endDate =
        year === currentYear
          ? todayStr
          : `${year}-12-31`;

      const data = await fetchHeatmapData(startDate, endDate);
      setRawHeatmapData(data);
      setIsLoading(false);
    },
    [fetchHeatmapData, currentYear, todayStr]
  );

  useEffect(() => {
    loadYear(selectedYear);
  }, [selectedYear, loadYear]);

  // Close on Escape
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  // Next milestone
  const nextMilestone = useMemo(() => {
    return MILESTONES.find((m) => m > signalStreak);
  }, [signalStreak]);

  const daysToNextMilestone = nextMilestone
    ? nextMilestone - signalStreak
    : null;

  // Build heatmap grid: 53 columns (weeks) x 7 rows (Mon-Sun)
  const { weeks, monthPositions } = useMemo(() => {
    if (heatmapData.length === 0) return { weeks: [], monthPositions: [] };

    // Index by date
    const dayMap: Record<string, HeatmapDay> = {};
    for (const entry of heatmapData) {
      dayMap[entry.date] = entry;
    }

    // Determine start/end of the year range
    const yearStart = new Date(selectedYear, 0, 1);
    const yearEnd =
      selectedYear === currentYear ? new Date() : new Date(selectedYear, 11, 31);

    // Find the Monday on or before Jan 1
    const startDay = yearStart.getDay(); // 0=Sun
    const mondayOffset = startDay === 0 ? -6 : 1 - startDay;
    const gridStart = new Date(yearStart);
    gridStart.setDate(gridStart.getDate() + mondayOffset);

    const weeksArr: ({ date: string; score: number; signals: HeatmapSignalDetail[]; inRange: boolean; dayOfWeek: number } | null)[][] = [];
    const monthPos: { month: number; weekIdx: number }[] = [];

    let current = new Date(gridStart);
    let weekIdx = 0;
    let lastMonth = -1;

    while (current <= yearEnd || current.getDay() !== 1) {
      // Start a new week on Monday
      if (current.getDay() === 1 || weeksArr.length === 0) {
        weeksArr.push([]);
        weekIdx = weeksArr.length - 1;
      }

      const dateStr = formatLocalDate(current);
      const dayOfWeek = (current.getDay() + 6) % 7; // 0=Mon, 6=Sun
      const isToday = dateStr === todayStr;
      const inRange = isToday || (current >= yearStart && current <= yearEnd);

      // Track month boundaries
      const month = current.getMonth();
      if (month !== lastMonth && inRange) {
        monthPos.push({ month, weekIdx });
        lastMonth = month;
      }

      const dayData = dayMap[dateStr];
      weeksArr[weekIdx][dayOfWeek] = {
        date: dateStr,
        score: dayData?.score ?? 0,
        signals: dayData?.signals ?? [],
        inRange,
        dayOfWeek,
      };

      current.setDate(current.getDate() + 1);

      // Stop after we've gone past the year end and completed the week
      if (current > yearEnd && current.getDay() === 1) break;
    }

    return { weeks: weeksArr, monthPositions: monthPos };
  }, [heatmapData, selectedYear, currentYear]);

  // Score trend (last 30 entries)
  const trendData = useMemo(() => {
    return heatmapData.slice(-30);
  }, [heatmapData]);

  // Sparkline path
  const sparklinePath = useMemo(() => {
    if (trendData.length < 2) return "";

    const width = 320;
    const height = 56;
    const px = 2;
    const py = 6;
    const iw = width - px * 2;
    const ih = height - py * 2;

    const pts = trendData.map((d, i) => ({
      x: px + (i / (trendData.length - 1)) * iw,
      y: py + ih - (d.score / 100) * ih,
    }));

    return pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
  }, [trendData]);

  // Fill path (area under the line)
  const sparklineFill = useMemo(() => {
    if (trendData.length < 2) return "";
    const width = 320;
    const height = 56;
    const px = 2;
    const py = 6;
    const iw = width - px * 2;
    const ih = height - py * 2;

    const pts = trendData.map((d, i) => ({
      x: px + (i / (trendData.length - 1)) * iw,
      y: py + ih - (d.score / 100) * ih,
    }));

    let path = pts
      .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`)
      .join(" ");
    path += ` L ${pts[pts.length - 1].x} ${height} L ${pts[0].x} ${height} Z`;
    return path;
  }, [trendData]);

  const trendAverage = useMemo(() => {
    if (trendData.length === 0) return 0;
    return Math.round(
      trendData.reduce((a, d) => a + d.score, 0) / trendData.length
    );
  }, [trendData]);

  const getHeatmapColor = (score: number, inRange: boolean): string => {
    if (!inRange) return "bg-transparent";
    if (score === 0) return "bg-gray-100 dark:bg-gray-800/60";
    if (score < 30) return "bg-emerald-200 dark:bg-emerald-800/50";
    if (score < 50) return "bg-emerald-300 dark:bg-emerald-700/60";
    if (score < signalPercentageGoal)
      return "bg-emerald-400 dark:bg-emerald-600/70";
    return "bg-emerald-500 dark:bg-emerald-500";
  };

  return (
    <div className="p-0 gap-0 flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={onClose}
          className="p-1.5 -ml-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-gray-500 dark:text-gray-400" />
        </button>
        <h1 className="text-lg font-semibold text-gray-900 dark:text-white">
          Signal Streak
        </h1>
      </div>

      {/* Top section: hero + stats */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 mb-6">
        {/* Hero streak */}
        <div className="lg:col-span-2 rounded-xl border border-gray-200 dark:border-gray-800 p-6 flex items-center gap-6">
          <div className="flex-shrink-0">
            <div
              className={`w-16 h-16 rounded-2xl flex items-center justify-center ${
                signalStreakDanger
                  ? "bg-red-50 dark:bg-red-950/30"
                  : signalStreak > 0
                  ? "bg-emerald-50 dark:bg-emerald-950/30"
                  : "bg-gray-50 dark:bg-gray-800"
              }`}
            >
              <Flame
                className={`w-8 h-8 ${
                  signalStreakDanger
                    ? "text-red-500"
                    : signalStreak > 0
                    ? "text-emerald-500"
                    : "text-gray-400"
                }`}
              />
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline gap-2">
              <span
                className={`text-4xl font-bold tabular-nums leading-none ${
                  signalStreakDanger
                    ? "text-red-600 dark:text-red-400"
                    : "text-gray-900 dark:text-white"
                }`}
              >
                {signalStreak}
              </span>
              <span className="text-sm text-gray-500 dark:text-gray-400">
                day{signalStreak !== 1 ? "s" : ""}
              </span>
            </div>
            {signalStreakDanger ? (
              <p className="text-xs text-red-500 dark:text-red-400 mt-1.5">
                Missed yesterday — lock in today to keep your streak
              </p>
            ) : nextMilestone ? (
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1.5 flex items-center gap-1">
                <Target className="w-3 h-3" />
                {daysToNextMilestone} more to{" "}
                {MILESTONE_LABELS[nextMilestone] || `${nextMilestone} days`}
              </p>
            ) : null}
          </div>
        </div>

        {/* Personal best */}
        <div className="rounded-xl border border-gray-200 dark:border-gray-800 p-6 flex flex-col justify-center">
          <div className="flex items-center gap-2 mb-1">
            <Trophy className="w-4 h-4 text-amber-500" />
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
              Personal Best
            </span>
          </div>
          <span className="text-3xl font-bold text-gray-900 dark:text-white tabular-nums">
            {signalStreakLongest}
            <span className="text-sm font-normal text-gray-400 ml-1">
              days
            </span>
          </span>
        </div>

        {/* 30-day average */}
        <div className="rounded-xl border border-gray-200 dark:border-gray-800 p-6 flex flex-col justify-center">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="w-4 h-4 text-blue-500" />
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
              30-Day Avg
            </span>
          </div>
          <span className="text-3xl font-bold text-gray-900 dark:text-white tabular-nums">
            {trendAverage}
            <span className="text-sm font-normal text-gray-400 ml-0.5">
              %
            </span>
          </span>
        </div>
      </div>

      {/* Heatmap */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-800 p-5 mb-6">
        {/* Year nav */}
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={() => setSelectedYear((y) => y - 1)}
            className="p-1 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <ChevronLeft className="w-4 h-4 text-gray-500 dark:text-gray-400" />
          </button>
          <span className="text-sm font-semibold text-gray-900 dark:text-white tabular-nums">
            {selectedYear}
          </span>
          <button
            onClick={() => setSelectedYear((y) => Math.min(y + 1, currentYear))}
            disabled={selectedYear >= currentYear}
            className="p-1 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ChevronRight className="w-4 h-4 text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        {isLoading ? (
          <div className="h-[120px] flex items-center justify-center">
            <div className="text-sm text-gray-400">Loading...</div>
          </div>
        ) : (
          <div className="space-y-2 relative" ref={heatmapRef}>
            {/* Month labels */}
            <div className="flex ml-7">
              {monthPositions.map(({ month, weekIdx }, i) => {
                const nextPos =
                  i + 1 < monthPositions.length
                    ? monthPositions[i + 1].weekIdx
                    : weeks.length;
                const span = nextPos - weekIdx;
                return (
                  <div
                    key={`${month}-${weekIdx}`}
                    className="text-[10px] text-gray-400 dark:text-gray-500"
                    style={{
                      width: `${span * 15}px`,
                      minWidth: `${span * 15}px`,
                    }}
                  >
                    {MONTH_LABELS[month]}
                  </div>
                );
              })}
            </div>

            {/* Grid */}
            <div className="flex gap-0">
              {/* Day labels */}
              <div className="flex flex-col gap-[3px] mr-1.5 flex-shrink-0">
                {["Mon", "", "Wed", "", "Fri", "", "Sun"].map((label, i) => (
                  <div
                    key={i}
                    className="h-[11px] flex items-center text-[10px] text-gray-400 dark:text-gray-500 leading-none"
                    style={{ width: "22px" }}
                  >
                    {label}
                  </div>
                ))}
              </div>

              {/* Weeks */}
              <div className="flex gap-[3px] overflow-x-auto">
                {weeks.map((week, wIdx) => (
                  <div key={wIdx} className="flex flex-col gap-[3px]">
                    {Array.from({ length: 7 }).map((_, dayIdx) => {
                      const cell = week[dayIdx];
                      if (!cell) {
                        return (
                          <div
                            key={dayIdx}
                            className="w-[11px] h-[11px]"
                          />
                        );
                      }
                      return (
                        <div
                          key={cell.date}
                          className={`w-[11px] h-[11px] rounded-[2px] cursor-pointer hover:ring-1 hover:ring-gray-400 dark:hover:ring-gray-500 ${getHeatmapColor(
                            cell.score,
                            cell.inRange
                          )}`}
                          onMouseEnter={(e) => {
                            if (!cell.inRange) return;
                            const rect = (e.target as HTMLElement).getBoundingClientRect();
                            const containerRect = heatmapRef.current?.getBoundingClientRect();
                            if (!containerRect) return;
                            setTooltip({
                              day: { date: cell.date, score: cell.score, signals: cell.signals },
                              x: rect.left - containerRect.left + rect.width / 2,
                              y: rect.top - containerRect.top - 8,
                            });
                          }}
                          onMouseLeave={() => setTooltip(null)}
                        />
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>

            {/* Tooltip */}
            {tooltip && (
              <div
                className="absolute z-50 pointer-events-none"
                style={{
                  left: `${tooltip.x}px`,
                  top: `${tooltip.y}px`,
                  transform: "translate(-50%, -100%)",
                }}
              >
                <div className="bg-gray-900 dark:bg-gray-800 text-white rounded-lg shadow-lg px-3 py-2 text-xs min-w-[160px] max-w-[220px] border border-gray-700">
                  <div className="flex justify-between items-center mb-1.5">
                    <span className="text-gray-300 font-medium">
                      {new Date(tooltip.day.date + "T12:00:00Z").toLocaleDateString("en-US", {
                        weekday: "short",
                        month: "short",
                        day: "numeric",
                      })}
                    </span>
                    <span
                      className={`font-bold tabular-nums ${
                        tooltip.day.score >= signalPercentageGoal
                          ? "text-emerald-400"
                          : tooltip.day.score > 0
                          ? "text-yellow-400"
                          : "text-gray-500"
                      }`}
                    >
                      {tooltip.day.score}%
                    </span>
                  </div>
                  {tooltip.day.signals.length > 0 ? (
                    <div className="space-y-0.5">
                      {tooltip.day.signals.map((s) => (
                        <div key={s.key} className="flex items-center justify-between gap-2">
                          <span className="text-gray-400 truncate">{s.label}</span>
                          <span className="flex-shrink-0">
                            {s.type === "binary" ? (
                              <span className={s.score >= 100 ? "text-emerald-400" : "text-gray-500"}>
                                {s.score >= 100 ? "✓" : "✗"}
                              </span>
                            ) : (
                              <span className={s.score >= signalPercentageGoal ? "text-emerald-400" : "text-gray-400"}>
                                {typeof s.value === "number" ? s.value : String(s.value)}
                              </span>
                            )}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-gray-500">No signals recorded</div>
                  )}
                </div>
              </div>
            )}

            {/* Legend */}
            <div className="flex items-center justify-end gap-1.5 pt-1">
              <span className="text-[10px] text-gray-400 dark:text-gray-500 mr-0.5">
                Less
              </span>
              <div className="w-[11px] h-[11px] rounded-[2px] bg-gray-100 dark:bg-gray-800/60" />
              <div className="w-[11px] h-[11px] rounded-[2px] bg-emerald-200 dark:bg-emerald-800/50" />
              <div className="w-[11px] h-[11px] rounded-[2px] bg-emerald-300 dark:bg-emerald-700/60" />
              <div className="w-[11px] h-[11px] rounded-[2px] bg-emerald-400 dark:bg-emerald-600/70" />
              <div className="w-[11px] h-[11px] rounded-[2px] bg-emerald-500 dark:bg-emerald-500" />
              <span className="text-[10px] text-gray-400 dark:text-gray-500 ml-0.5">
                More
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Bottom row: Trend + Milestones */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Trend sparkline */}
        <div className="rounded-xl border border-gray-200 dark:border-gray-800 p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-gray-900 dark:text-white">
              30-Day Trend
            </span>
            <span className="text-xs text-gray-400 tabular-nums">
              avg {trendAverage}%
            </span>
          </div>
          {isLoading ? (
            <div className="h-14 flex items-center justify-center text-sm text-gray-400">
              Loading...
            </div>
          ) : (
            <svg
              viewBox="0 0 320 56"
              className="w-full h-14"
              preserveAspectRatio="none"
            >
              {/* Goal threshold line */}
              <line
                x1="2"
                y1={6 + 44 - (signalPercentageGoal / 100) * 44}
                x2="318"
                y2={6 + 44 - (signalPercentageGoal / 100) * 44}
                stroke="currentColor"
                className="text-gray-200 dark:text-gray-700"
                strokeWidth="0.5"
                strokeDasharray="4 3"
              />
              {/* Area fill */}
              {sparklineFill && (
                <path
                  d={sparklineFill}
                  className="text-emerald-500/10 dark:text-emerald-500/10"
                  fill="currentColor"
                />
              )}
              {/* Line */}
              {sparklinePath && (
                <path
                  d={sparklinePath}
                  fill="none"
                  stroke="currentColor"
                  className="text-emerald-500"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}
            </svg>
          )}
          <div className="flex justify-between text-[10px] text-gray-400 dark:text-gray-500 mt-1">
            <span>30 days ago</span>
            <span>Today</span>
          </div>
        </div>

        {/* Milestones */}
        <div className="rounded-xl border border-gray-200 dark:border-gray-800 p-5">
          <span className="text-sm font-medium text-gray-900 dark:text-white block mb-3">
            Milestones
          </span>
          <div className="flex flex-wrap gap-2">
            {MILESTONES.map((milestone) => {
              const earned = signalStreakMilestones.includes(milestone);
              const isNext = milestone === nextMilestone;

              return (
                <div
                  key={milestone}
                  className={`rounded-lg px-3 py-2 text-center transition-all flex-1 min-w-[70px] ${
                    earned
                      ? "bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800"
                      : isNext
                      ? "bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 ring-1 ring-emerald-500/30"
                      : "bg-gray-50 dark:bg-gray-800/30 border border-gray-100 dark:border-gray-800 opacity-40"
                  }`}
                >
                  <div
                    className={`text-base font-bold tabular-nums leading-tight ${
                      earned
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-gray-400 dark:text-gray-500"
                    }`}
                  >
                    {milestone}
                  </div>
                  <div
                    className={`text-[9px] leading-tight mt-0.5 ${
                      earned
                        ? "text-emerald-500/80 dark:text-emerald-400/70"
                        : "text-gray-400 dark:text-gray-500"
                    }`}
                  >
                    {MILESTONE_LABELS[milestone]}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default StreakScreen;
