import React from "react";
import { HabitStats } from "../hooks/useInsightsData";
import { Flame, Trophy, TrendingUp } from "lucide-react";

interface HabitConsistencyProps {
  habitStats: HabitStats[];
}

const HabitConsistency: React.FC<HabitConsistencyProps> = ({ habitStats }) => {
  if (habitStats.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-6">
        <p className="text-sm text-gray-500 dark:text-gray-400 text-center">
          No habit data available. Start tracking signals to see consistency stats.
        </p>
      </div>
    );
  }

  // Get color based on completion rate
  const getCompletionColor = (rate: number) => {
    if (rate >= 80) return "bg-emerald-500 dark:bg-emerald-400";
    if (rate >= 60) return "bg-blue-500 dark:bg-blue-400";
    if (rate >= 40) return "bg-amber-500 dark:bg-amber-400";
    return "bg-gray-400 dark:bg-gray-500";
  };

  const getTextColor = (rate: number) => {
    if (rate >= 80) return "text-emerald-600 dark:text-emerald-400";
    if (rate >= 60) return "text-blue-600 dark:text-blue-400";
    if (rate >= 40) return "text-amber-600 dark:text-amber-400";
    return "text-gray-500 dark:text-gray-400";
  };

  // Find top streaks
  const topCurrentStreak = habitStats.reduce((max, h) =>
    h.currentStreak > max.currentStreak ? h : max
  );
  const topBestStreak = habitStats.reduce((max, h) =>
    h.bestStreak > max.bestStreak ? h : max
  );

  return (
    <div className="space-y-6">
      {/* Streak Highlights */}
      {(topCurrentStreak.currentStreak > 0 || topBestStreak.bestStreak > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {topCurrentStreak.currentStreak > 0 && (
            <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-4">
              <div className="flex items-center gap-2 mb-2">
                <Flame className="w-5 h-5 text-orange-500" />
                <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Current Streak</span>
              </div>
              <p className="text-2xl font-semibold text-gray-900 dark:text-white">{topCurrentStreak.currentStreak} days</p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{topCurrentStreak.label}</p>
            </div>
          )}

          {topBestStreak.bestStreak > 0 && (
            <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-4">
              <div className="flex items-center gap-2 mb-2">
                <Trophy className="w-5 h-5 text-amber-500" />
                <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Best Streak</span>
              </div>
              <p className="text-2xl font-semibold text-gray-900 dark:text-white">{topBestStreak.bestStreak} days</p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{topBestStreak.label}</p>
            </div>
          )}
        </div>
      )}

      {/* Completion Rates */}
      <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-5">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="w-4 h-4 text-gray-500 dark:text-gray-400" />
          <h3 className="text-sm font-medium text-gray-900 dark:text-white">
            Habit Completion Rates
          </h3>
        </div>

        <div className="space-y-4">
          {habitStats.map((habit) => (
            <div key={habit.key}>
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    {habit.label}
                  </span>
                  {habit.currentStreak > 0 && (
                    <span className="inline-flex items-center gap-1 text-xs text-orange-600 dark:text-orange-400">
                      <Flame className="w-3 h-3" />
                      {habit.currentStreak}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-sm font-medium ${getTextColor(habit.completionRate)}`}>
                    {habit.completionRate.toFixed(0)}%
                  </span>
                  <span className="text-xs text-gray-400 dark:text-gray-500">
                    ({habit.totalCompleted}/{habit.totalDays})
                  </span>
                </div>
              </div>
              <div className="h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${getCompletionColor(
                    habit.completionRate
                  )}`}
                  style={{ width: `${habit.completionRate}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-4 text-center">
          <p className="text-2xl font-semibold text-gray-900 dark:text-white">
            {habitStats.filter((h) => h.completionRate >= 80).length}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Habits at 80%+
          </p>
        </div>
        <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-4 text-center">
          <p className="text-2xl font-semibold text-gray-900 dark:text-white">
            {(
              habitStats.reduce((sum, h) => sum + h.completionRate, 0) / habitStats.length
            ).toFixed(0)}%
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Avg Completion
          </p>
        </div>
        <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-4 text-center">
          <p className="text-2xl font-semibold text-gray-900 dark:text-white">
            {habitStats.reduce((sum, h) => sum + h.totalCompleted, 0)}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Total Completions
          </p>
        </div>
      </div>
    </div>
  );
};

export default HabitConsistency;

