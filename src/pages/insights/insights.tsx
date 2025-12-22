import React, { useState } from "react";
import {
  BarChart3,
  Clock,
  Target,
  Loader2,
  Calendar,
  TrendingUp,
  ArrowLeftRight,
} from "lucide-react";
import {
  useInsightsData,
  TimeRange,
  CustomDateRange,
} from "./hooks/useInsightsData";
import TimeRangeSelector from "./components/TimeRangeSelector";
import FocusOverview from "./components/FocusOverview";
import CorrelationCard from "./components/CorrelationCard";
import HabitConsistency from "./components/HabitConsistency";
import YearComparison from "./components/YearComparison";

type ViewMode = "insights" | "comparison";

const Insights: React.FC = () => {
  const [viewMode, setViewMode] = useState<ViewMode>("insights");
  const [timeRange, setTimeRange] = useState<TimeRange>("30d");
  const [customDateRange, setCustomDateRange] = useState<
    CustomDateRange | undefined
  >();

  const {
    dailyData,
    focusDistribution,
    correlations,
    habitStats,
    summary,
    bestDaysInsight,
    isLoading,
  } = useInsightsData(timeRange, customDateRange);

  if (isLoading && viewMode === "insights") {
    return (
      <div className="max-w-5xl mx-auto flex flex-col items-center justify-center min-h-[400px]">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400 mb-3" />
        <p className="text-sm text-gray-500 dark:text-gray-400">Loading...</p>
      </div>
    );
  }

  const hasEnoughData = summary.totalSessions >= 3;

  // Calculate days with sessions
  const daysWithActivity = dailyData.filter((d) => d.sessionCount > 0).length;
  const totalDays = dailyData.length;
  const activityRate =
    totalDays > 0 ? ((daysWithActivity / totalDays) * 100).toFixed(0) : 0;

  // Format custom date range for display
  const getDateRangeLabel = () => {
    if (timeRange === "custom" && customDateRange) {
      const start = new Date(customDateRange.startDate + "T12:00:00");
      const end = new Date(customDateRange.endDate + "T12:00:00");
      const startStr = start.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });
      const endStr = end.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
      return `${startStr} - ${endStr}`;
    }
    return null;
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <h1 className="text-lg font-medium text-gray-900 dark:text-white">
            Insights
          </h1>

          {/* View Mode Toggle */}
          <div className="inline-flex rounded-lg bg-gray-100 dark:bg-gray-800 p-1">
            <button
              onClick={() => setViewMode("insights")}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md transition-all ${
                viewMode === "insights"
                  ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm"
                  : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
              }`}
            >
              <BarChart3 className="w-4 h-4" />
              <span className="hidden sm:inline">Overview</span>
            </button>
            <button
              onClick={() => setViewMode("comparison")}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md transition-all ${
                viewMode === "comparison"
                  ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm"
                  : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
              }`}
            >
              <ArrowLeftRight className="w-4 h-4" />
              <span className="hidden sm:inline">Compare Years</span>
            </button>
          </div>
        </div>

        {viewMode === "insights" && (
          <TimeRangeSelector
            selected={timeRange}
            onChange={setTimeRange}
            customDateRange={customDateRange}
            onCustomDateChange={setCustomDateRange}
          />
        )}
      </div>

      {/* Custom Date Range Indicator */}
      {viewMode === "insights" && timeRange === "custom" && customDateRange && (
        <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-100 dark:border-blue-800">
          <Calendar className="w-4 h-4 text-blue-500" />
          <span className="text-sm text-blue-700 dark:text-blue-300">
            Showing data for:{" "}
            <span className="font-medium">{getDateRangeLabel()}</span>
          </span>
        </div>
      )}

      {/* Year Comparison View */}
      {viewMode === "comparison" ? (
        <YearComparison onClose={() => setViewMode("insights")} />
      ) : (
        <>
          {!hasEnoughData ? (
            <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-8 text-center">
              <BarChart3 className="w-8 h-8 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
              <h2 className="text-sm font-medium text-gray-900 dark:text-white mb-1">
                Not enough data
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Log at least 3 focus sessions to see insights.
              </p>
            </div>
          ) : (
            <>
              {/* Summary Stats Row */}
              <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <Clock className="w-4 h-4 text-gray-400" />
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      Total Hours
                    </span>
                  </div>
                  <p className="text-xl font-semibold text-gray-900 dark:text-white">
                    {summary.totalHours.toFixed(1)}
                  </p>
                </div>

                <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <Target className="w-4 h-4 text-gray-400" />
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      Avg Focus
                    </span>
                  </div>
                  <p className="text-xl font-semibold text-gray-900 dark:text-white">
                    {summary.avgFocusScore.toFixed(1)}
                    <span className="text-sm text-gray-400">/5</span>
                  </p>
                </div>

                <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <BarChart3 className="w-4 h-4 text-gray-400" />
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      Sessions
                    </span>
                  </div>
                  <p className="text-xl font-semibold text-gray-900 dark:text-white">
                    {summary.totalSessions}
                  </p>
                </div>

                <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <Calendar className="w-4 h-4 text-gray-400" />
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      Active Days
                    </span>
                  </div>
                  <p className="text-xl font-semibold text-gray-900 dark:text-white">
                    {daysWithActivity}
                    <span className="text-sm text-gray-400">/{totalDays}</span>
                  </p>
                </div>
              </section>

              {/* Focus Sessions Section */}
              <section>
                <h2 className="text-sm font-medium text-gray-900 dark:text-white mb-3">
                  Focus Sessions
                </h2>
                <FocusOverview
                  dailyData={dailyData}
                  focusDistribution={focusDistribution}
                  summary={summary}
                  timeRange={timeRange}
                />
              </section>

              {/* Habit Impact Section */}
              {correlations.length > 0 && (
                <section>
                  <h2 className="text-sm font-medium text-gray-900 dark:text-white mb-3">
                    Habit Impact
                  </h2>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                    Average focus hours when habits are completed vs not
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {correlations.map((insight) => (
                      <CorrelationCard key={insight.id} insight={insight} />
                    ))}
                  </div>
                </section>
              )}

              {/* Best Days Pattern */}
              {bestDaysInsight && (
                <section className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingUp className="w-4 h-4 text-gray-400" />
                    <h2 className="text-sm font-medium text-gray-900 dark:text-white">
                      Pattern
                    </h2>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {bestDaysInsight}
                  </p>
                </section>
              )}

              {/* Habit Tracking Section */}
              <section>
                <h2 className="text-sm font-medium text-gray-900 dark:text-white mb-3">
                  Habit Tracking
                </h2>
                <HabitConsistency habitStats={habitStats} />
              </section>
            </>
          )}
        </>
      )}
    </div>
  );
};

export default Insights;
