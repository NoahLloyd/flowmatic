import React from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie,
} from "recharts";
import { DailyData, FocusDistribution } from "../hooks/useInsightsData";
import { useTheme } from "../../../context/ThemeContext";
import { Clock, Target, Zap } from "lucide-react";

interface FocusOverviewProps {
  dailyData: DailyData[];
  focusDistribution: FocusDistribution[];
  summary: {
    totalHours: number;
    avgFocusScore: number;
    totalSessions: number;
    avgSessionLength: number;
    bestDay: { date: string; hours: number } | null;
  };
  timeRange: string;
}

const FocusOverview: React.FC<FocusOverviewProps> = ({
  dailyData,
  focusDistribution,
  summary,
  timeRange,
}) => {
  const { isDarkMode } = useTheme();

  // Format date for chart display
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr + "T12:00:00");
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  // Prepare chart data - show appropriate granularity based on time range
  const getChartData = () => {
    const totalDays = dailyData.length;
    
    // For short ranges (up to ~45 days), group by week
    if (totalDays <= 45 || timeRange === "30d") {
      const weeks: { name: string; hours: number; days: number }[] = [];
      let currentWeek = { hours: 0, days: 0, startDate: "" };

      dailyData.forEach((d, index) => {
        if (currentWeek.days === 0) currentWeek.startDate = d.date;
        
        currentWeek.hours += d.hours;
        currentWeek.days++;

        if (currentWeek.days === 7 || index === dailyData.length - 1) {
          weeks.push({
            name: formatDate(currentWeek.startDate),
            hours: Number(currentWeek.hours.toFixed(1)),
            days: currentWeek.days,
          });
          currentWeek = { hours: 0, days: 0, startDate: "" };
        }
      });

      return weeks;
    }

    // For longer ranges (90d, 1y, all, custom > 45 days), group by month
    const months: { name: string; hours: number }[] = [];
    const monthMap: Record<string, number> = {};

    dailyData.forEach((d) => {
      const date = new Date(d.date + "T12:00:00");
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      const monthLabel = date.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
      
      if (!monthMap[monthKey]) {
        monthMap[monthKey] = 0;
      }
      monthMap[monthKey] += d.hours;
    });

    Object.entries(monthMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .forEach(([key, hours]) => {
        const [year, month] = key.split("-");
        const date = new Date(parseInt(year), parseInt(month) - 1);
        months.push({
          name: date.toLocaleDateString("en-US", { month: "short", year: "2-digit" }),
          hours: Number(hours.toFixed(1)),
        });
      });

    return months;
  };

  const chartData = getChartData();

  // Colors for focus distribution
  const focusColors = isDarkMode
    ? ["#ef4444", "#f97316", "#eab308", "#22c55e", "#10b981"]
    : ["#fca5a5", "#fdba74", "#fde047", "#86efac", "#6ee7b7"];

  // Custom tooltip for bar chart
  const CustomBarTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 shadow-lg">
          <p className="text-sm font-medium text-gray-900 dark:text-white">
            {payload[0].payload.fullDate || payload[0].payload.name}
          </p>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {payload[0].value} hours
          </p>
        </div>
      );
    }
    return null;
  };

  // Format best day date
  const formatBestDay = (dateStr: string) => {
    const date = new Date(dateStr + "T12:00:00");
    return date.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  };

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="w-4 h-4 text-blue-500" />
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
              Total Hours
            </span>
          </div>
          <p className="text-2xl font-semibold text-gray-900 dark:text-white">
            {summary.totalHours.toFixed(1)}
          </p>
        </div>

        <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Target className="w-4 h-4 text-emerald-500" />
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
              Avg Focus
            </span>
          </div>
          <p className="text-2xl font-semibold text-gray-900 dark:text-white">
            {summary.avgFocusScore.toFixed(1)}
            <span className="text-sm text-gray-400 dark:text-gray-500">/5</span>
          </p>
        </div>

        <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Zap className="w-4 h-4 text-amber-500" />
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
              Sessions
            </span>
          </div>
          <p className="text-2xl font-semibold text-gray-900 dark:text-white">
            {summary.totalSessions}
          </p>
        </div>

        <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
              Best Day
            </span>
          </div>
          {summary.bestDay ? (
            <>
              <p className="text-lg font-semibold text-gray-900 dark:text-white">
                {summary.bestDay.hours.toFixed(1)}h
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {formatBestDay(summary.bestDay.date)}
              </p>
            </>
          ) : (
            <p className="text-sm text-gray-400">No data</p>
          )}
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Daily Hours Chart */}
        <div className="lg:col-span-2 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-5">
          <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-4">
            Focus Hours {dailyData.length <= 45 || timeRange === "30d" ? "(Weekly)" : "(Monthly)"}
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <XAxis
                  dataKey="name"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: isDarkMode ? "#9ca3af" : "#6b7280", fontSize: 12 }}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: isDarkMode ? "#9ca3af" : "#6b7280", fontSize: 12 }}
                  tickFormatter={(value) => `${value}h`}
                />
                <Tooltip content={<CustomBarTooltip />} cursor={{ fill: isDarkMode ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)" }} />
                <Bar dataKey="hours" radius={[4, 4, 0, 0]} maxBarSize={50}>
                  {chartData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={isDarkMode ? "#3b82f6" : "#60a5fa"}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Focus Distribution */}
        <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-5">
          <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-4">
            Focus Score Distribution
          </h3>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={focusDistribution.filter((d) => d.count > 0) as any[]}
                  cx="50%"
                  cy="50%"
                  innerRadius={45}
                  outerRadius={70}
                  paddingAngle={2}
                  dataKey="count"
                  nameKey="score"
                >
                  {focusDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={focusColors[entry.score - 1]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: number, name: string) => [
                    `${value} sessions`,
                    `Focus ${name}`,
                  ]}
                  contentStyle={{
                    backgroundColor: isDarkMode ? "#1f2937" : "#fff",
                    borderColor: isDarkMode ? "#374151" : "#e5e7eb",
                    borderRadius: "8px",
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          {/* Legend */}
          <div className="flex flex-wrap justify-center gap-3 mt-2">
            {focusDistribution.map((d) => (
              <div key={d.score} className="flex items-center gap-1.5">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: focusColors[d.score - 1] }}
                />
                <span className="text-xs text-gray-600 dark:text-gray-400">
                  {d.score}: {d.percentage.toFixed(0)}%
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default FocusOverview;

