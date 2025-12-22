import { useState, useEffect, useCallback } from "react";
import { api } from "../../../utils/api";
import { Session } from "../../../types/Session";
import { useAuth } from "../../../context/AuthContext";
import { useTimezone } from "../../../context/TimezoneContext";
import { AVAILABLE_SIGNALS } from "../../settings/components/SignalSettings";

export type TimeRange = "30d" | "90d" | "1y" | "all" | "custom";

export interface CustomDateRange {
  startDate: string;
  endDate: string;
}

export interface DailyData {
  date: string;
  hours: number;
  avgFocus: number;
  sessionCount: number;
  signals: Record<string, number | boolean>;
}

export interface FocusDistribution {
  score: number;
  count: number;
  percentage: number;
}

export interface CorrelationInsight {
  id: string;
  title: string;
  description: string;
  withCondition: { label: string; value: number };
  withoutCondition: { label: string; value: number };
  difference: number;
  isPositive: boolean;
  sampleSize: { with: number; without: number };
}

export interface HabitStats {
  key: string;
  label: string;
  completionRate: number;
  currentStreak: number;
  bestStreak: number;
  totalCompleted: number;
  totalDays: number;
}

export interface InsightsData {
  dailyData: DailyData[];
  focusDistribution: FocusDistribution[];
  correlations: CorrelationInsight[];
  habitStats: HabitStats[];
  summary: {
    totalHours: number;
    avgFocusScore: number;
    avgSignalCompletion: number;
    totalSessions: number;
    avgSessionLength: number;
    bestDay: { date: string; hours: number } | null;
  };
  bestDaysInsight: string;
  isLoading: boolean;
}

export const useInsightsData = (
  timeRange: TimeRange,
  customDateRange?: CustomDateRange
): InsightsData => {
  const { user } = useAuth();
  const { timezone } = useTimezone();
  const [isLoading, setIsLoading] = useState(true);
  const [dailyData, setDailyData] = useState<DailyData[]>([]);
  const [focusDistribution, setFocusDistribution] = useState<FocusDistribution[]>([]);
  const [correlations, setCorrelations] = useState<CorrelationInsight[]>([]);
  const [habitStats, setHabitStats] = useState<HabitStats[]>([]);
  const [summary, setSummary] = useState({
    totalHours: 0,
    avgFocusScore: 0,
    avgSignalCompletion: 0,
    totalSessions: 0,
    avgSessionLength: 0,
    bestDay: null as { date: string; hours: number } | null,
  });
  const [bestDaysInsight, setBestDaysInsight] = useState("");

  // Get date range based on selected time range
  const getDateRange = useCallback(() => {
    const formatDate = (date: Date) => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    };

    // Handle custom date range
    if (timeRange === "custom" && customDateRange) {
      const start = new Date(customDateRange.startDate);
      const end = new Date(customDateRange.endDate);
      const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      return {
        startDate: customDateRange.startDate,
        endDate: customDateRange.endDate,
        days,
      };
    }

    const endDate = new Date();
    const startDate = new Date();
    
    let days: number;
    if (timeRange === "30d") {
      days = 30;
      startDate.setDate(startDate.getDate() - days + 1);
    } else if (timeRange === "90d") {
      days = 90;
      startDate.setDate(startDate.getDate() - days + 1);
    } else if (timeRange === "1y") {
      days = 365;
      startDate.setFullYear(startDate.getFullYear() - 1);
    } else {
      // "all" - go back 5 years as a reasonable max
      days = 1825;
      startDate.setFullYear(startDate.getFullYear() - 5);
    }

    return {
      startDate: formatDate(startDate),
      endDate: formatDate(endDate),
      days,
    };
  }, [timeRange, customDateRange]);

  // Format date for display
  const formatDateForDisplay = (dateStr: string) => {
    const date = new Date(dateStr + "T12:00:00");
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  // Calculate correlations between signals and focus
  const calculateCorrelations = useCallback(
    (dailyDataWithSignals: DailyData[]): CorrelationInsight[] => {
      const insights: CorrelationInsight[] = [];
      const activeSignals = user?.preferences?.activeSignals || [];
      const signalGoals = user?.preferences?.signalGoals || {};

      // Only process days with focus data
      const daysWithFocus = dailyDataWithSignals.filter((d) => d.sessionCount > 0);

      if (daysWithFocus.length < 3) return insights;

      // Sleep correlation
      if (activeSignals.includes("sleep")) {
        const sleepGoal = signalGoals.sleep || 7;
        const goodSleepDays = daysWithFocus.filter(
          (d) => typeof d.signals.sleep === "number" && d.signals.sleep >= sleepGoal
        );
        const poorSleepDays = daysWithFocus.filter(
          (d) => typeof d.signals.sleep === "number" && d.signals.sleep < sleepGoal
        );

        if (goodSleepDays.length > 0 && poorSleepDays.length > 0) {
          const avgGoodSleep = goodSleepDays.reduce((sum, d) => sum + d.hours, 0) / goodSleepDays.length;
          const avgPoorSleep = poorSleepDays.reduce((sum, d) => sum + d.hours, 0) / poorSleepDays.length;
          const diff = ((avgGoodSleep - avgPoorSleep) / avgPoorSleep) * 100;

          insights.push({
            id: "sleep",
            title: "Sleep Impact",
            description: diff > 0
              ? `You log ${Math.abs(diff).toFixed(0)}% more focus hours on days with ${sleepGoal}+ hours of sleep`
              : `Sleep doesn't seem to significantly affect your focus hours`,
            withCondition: { label: `${sleepGoal}+ hrs sleep`, value: avgGoodSleep },
            withoutCondition: { label: `< ${sleepGoal} hrs sleep`, value: avgPoorSleep },
            difference: diff,
            isPositive: diff > 5,
            sampleSize: { with: goodSleepDays.length, without: poorSleepDays.length },
          });
        }
      }

      // Exercise correlation
      if (activeSignals.includes("exercise")) {
        const exerciseDays = daysWithFocus.filter((d) => d.signals.exercise === true);
        const noExerciseDays = daysWithFocus.filter((d) => d.signals.exercise === false || d.signals.exercise === undefined);

        if (exerciseDays.length > 0 && noExerciseDays.length > 0) {
          const avgExercise = exerciseDays.reduce((sum, d) => sum + d.hours, 0) / exerciseDays.length;
          const avgNoExercise = noExerciseDays.reduce((sum, d) => sum + d.hours, 0) / noExerciseDays.length;
          const diff = ((avgExercise - avgNoExercise) / Math.max(avgNoExercise, 0.1)) * 100;

          insights.push({
            id: "exercise",
            title: "Exercise Effect",
            description: diff > 0
              ? `Exercise days show ${Math.abs(diff).toFixed(0)}% more focus time`
              : `Exercise doesn't significantly impact your focus hours`,
            withCondition: { label: "Exercise days", value: avgExercise },
            withoutCondition: { label: "Rest days", value: avgNoExercise },
            difference: diff,
            isPositive: diff > 5,
            sampleSize: { with: exerciseDays.length, without: noExerciseDays.length },
          });
        }
      }

      // Morning routine (breakfast) correlation
      if (activeSignals.includes("breakfast")) {
        const breakfastDays = daysWithFocus.filter((d) => d.signals.breakfast === true);
        const noBreakfastDays = daysWithFocus.filter((d) => d.signals.breakfast === false || d.signals.breakfast === undefined);

        if (breakfastDays.length > 0 && noBreakfastDays.length > 0) {
          const avgBreakfast = breakfastDays.reduce((sum, d) => sum + d.hours, 0) / breakfastDays.length;
          const avgNoBreakfast = noBreakfastDays.reduce((sum, d) => sum + d.hours, 0) / noBreakfastDays.length;
          const diff = ((avgBreakfast - avgNoBreakfast) / Math.max(avgNoBreakfast, 0.1)) * 100;

          insights.push({
            id: "breakfast",
            title: "Morning Routine",
            description: diff > 0
              ? `Days with breakfast show ${Math.abs(diff).toFixed(0)}% more productivity`
              : `Breakfast doesn't significantly affect your focus hours`,
            withCondition: { label: "With breakfast", value: avgBreakfast },
            withoutCondition: { label: "No breakfast", value: avgNoBreakfast },
            difference: diff,
            isPositive: diff > 5,
            sampleSize: { with: breakfastDays.length, without: noBreakfastDays.length },
          });
        }
      }

      // Energy correlation
      if (activeSignals.includes("energy")) {
        const highEnergyDays = daysWithFocus.filter(
          (d) => typeof d.signals.energy === "number" && d.signals.energy >= 4
        );
        const lowEnergyDays = daysWithFocus.filter(
          (d) => typeof d.signals.energy === "number" && d.signals.energy < 4
        );

        if (highEnergyDays.length > 0 && lowEnergyDays.length > 0) {
          const avgHighEnergy = highEnergyDays.reduce((sum, d) => sum + d.hours, 0) / highEnergyDays.length;
          const avgLowEnergy = lowEnergyDays.reduce((sum, d) => sum + d.hours, 0) / lowEnergyDays.length;
          const diff = ((avgHighEnergy - avgLowEnergy) / Math.max(avgLowEnergy, 0.1)) * 100;

          insights.push({
            id: "energy",
            title: "Energy Levels",
            description: diff > 0
              ? `High energy days yield ${Math.abs(diff).toFixed(0)}% more focus hours`
              : `Energy levels don't significantly predict focus time`,
            withCondition: { label: "High energy (4-5)", value: avgHighEnergy },
            withoutCondition: { label: "Low energy (1-3)", value: avgLowEnergy },
            difference: diff,
            isPositive: diff > 5,
            sampleSize: { with: highEnergyDays.length, without: lowEnergyDays.length },
          });
        }
      }

      // Overall signal completion correlation
      const highSignalDays = daysWithFocus.filter((d) => {
        const signalCount = Object.values(d.signals).filter((v) => v === true || (typeof v === "number" && v > 0)).length;
        return signalCount >= activeSignals.length * 0.7;
      });
      const lowSignalDays = daysWithFocus.filter((d) => {
        const signalCount = Object.values(d.signals).filter((v) => v === true || (typeof v === "number" && v > 0)).length;
        return signalCount < activeSignals.length * 0.7;
      });

      if (highSignalDays.length > 0 && lowSignalDays.length > 0) {
        const avgHighSignal = highSignalDays.reduce((sum, d) => sum + d.hours, 0) / highSignalDays.length;
        const avgLowSignal = lowSignalDays.reduce((sum, d) => sum + d.hours, 0) / lowSignalDays.length;
        const diff = ((avgHighSignal - avgLowSignal) / Math.max(avgLowSignal, 0.1)) * 100;

        insights.push({
          id: "signals",
          title: "Consistency Wins",
          description: diff > 0
            ? `Days with 70%+ signals completed show ${Math.abs(diff).toFixed(0)}% better focus`
            : `Signal completion rate doesn't strongly correlate with focus`,
          withCondition: { label: "70%+ signals", value: avgHighSignal },
          withoutCondition: { label: "< 70% signals", value: avgLowSignal },
          difference: diff,
          isPositive: diff > 5,
          sampleSize: { with: highSignalDays.length, without: lowSignalDays.length },
        });
      }

      return insights;
    },
    [user]
  );

  // Calculate habit statistics
  const calculateHabitStats = useCallback(
    (dailyDataWithSignals: DailyData[]): HabitStats[] => {
      const activeSignals = user?.preferences?.activeSignals || [];
      const stats: HabitStats[] = [];

      activeSignals.forEach((signalKey: string) => {
        const signalConfig = AVAILABLE_SIGNALS[signalKey as keyof typeof AVAILABLE_SIGNALS];
        if (!signalConfig) return;

        let completedDays = 0;
        let currentStreak = 0;
        let bestStreak = 0;
        let tempStreak = 0;

        // Sort by date ascending for streak calculation
        const sortedData = [...dailyDataWithSignals].sort(
          (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
        );

        sortedData.forEach((day, index) => {
          const value = day.signals[signalKey];
          let isCompleted = false;

          if (signalConfig.type === "binary") {
            isCompleted = value === true;
          } else if (signalConfig.type === "scale") {
            isCompleted = typeof value === "number" && value >= 4;
          } else if (signalConfig.type === "number" || signalConfig.type === "water") {
            const goal = user?.preferences?.signalGoals?.[signalKey];
            if (goal && typeof value === "number") {
              isCompleted = signalKey === "minutesToOffice" ? value <= goal : value >= goal;
            }
          }

          if (isCompleted) {
            completedDays++;
            tempStreak++;
            bestStreak = Math.max(bestStreak, tempStreak);
          } else {
            tempStreak = 0;
          }

          // Update current streak (only if it's recent)
          if (index === sortedData.length - 1 || index === sortedData.length - 2) {
            if (isCompleted) {
              currentStreak = tempStreak;
            }
          }
        });

        stats.push({
          key: signalKey,
          label: signalConfig.label,
          completionRate: dailyDataWithSignals.length > 0
            ? (completedDays / dailyDataWithSignals.length) * 100
            : 0,
          currentStreak,
          bestStreak,
          totalCompleted: completedDays,
          totalDays: dailyDataWithSignals.length,
        });
      });

      return stats.sort((a, b) => b.completionRate - a.completionRate);
    },
    [user]
  );

  // Generate "best days" insight
  const generateBestDaysInsight = useCallback(
    (dailyDataWithSignals: DailyData[]): string => {
      const daysWithFocus = dailyDataWithSignals.filter((d) => d.hours > 0);
      if (daysWithFocus.length < 5) return "Log more sessions to see patterns in your best days.";

      // Find top 20% days by hours
      const sortedByHours = [...daysWithFocus].sort((a, b) => b.hours - a.hours);
      const topDays = sortedByHours.slice(0, Math.max(1, Math.floor(daysWithFocus.length * 0.2)));

      const patterns: string[] = [];
      const activeSignals = user?.preferences?.activeSignals || [];
      const signalGoals = user?.preferences?.signalGoals || {};

      // Check sleep pattern
      if (activeSignals.includes("sleep")) {
        const avgSleep = topDays.reduce((sum, d) => {
          const sleep = typeof d.signals.sleep === "number" ? d.signals.sleep : 0;
          return sum + sleep;
        }, 0) / topDays.length;
        if (avgSleep >= 7) {
          patterns.push(`${avgSleep.toFixed(1)}+ hours of sleep`);
        }
      }

      // Check exercise pattern
      if (activeSignals.includes("exercise")) {
        const exerciseRate = topDays.filter((d) => d.signals.exercise === true).length / topDays.length;
        if (exerciseRate >= 0.6) {
          patterns.push("exercise completed");
        }
      }

      // Check breakfast pattern
      if (activeSignals.includes("breakfast")) {
        const breakfastRate = topDays.filter((d) => d.signals.breakfast === true).length / topDays.length;
        if (breakfastRate >= 0.6) {
          patterns.push("breakfast eaten");
        }
      }

      // Check energy pattern
      if (activeSignals.includes("energy")) {
        const avgEnergy = topDays.reduce((sum, d) => {
          const energy = typeof d.signals.energy === "number" ? d.signals.energy : 0;
          return sum + energy;
        }, 0) / topDays.length;
        if (avgEnergy >= 4) {
          patterns.push("high energy levels");
        }
      }

      if (patterns.length === 0) {
        return "Keep tracking to discover what drives your best days.";
      }

      return `Your most productive days typically include: ${patterns.join(", ")}.`;
    },
    [user]
  );

  // Main data fetching effect
  useEffect(() => {
    const fetchData = async () => {
      if (!user) return;

      setIsLoading(true);

      try {
        const { startDate, endDate, days } = getDateRange();

        // Fetch sessions
        const sessions: Session[] = await api.getUserSessions();

        // Fetch signal history
        let signalHistory: any[] = [];
        try {
          const historyResponse = await api.getAllSignalHistory(startDate, endDate);
          // Handle both array and object responses
          if (Array.isArray(historyResponse)) {
            signalHistory = historyResponse;
          } else if (historyResponse && typeof historyResponse === 'object') {
            // If it's an object with signal keys, flatten it
            signalHistory = Object.entries(historyResponse).flatMap(([key, values]) => {
              if (Array.isArray(values)) {
                return values.map((v: any) => ({ ...v, metric: key }));
              }
              return [];
            });
          }
        } catch (error) {
          console.error("Failed to fetch signal history:", error);
        }

        // Create a map of dates to signals
        const signalsByDate: Record<string, Record<string, number | boolean>> = {};
        if (Array.isArray(signalHistory)) {
          signalHistory.forEach((item) => {
            if (!signalsByDate[item.date]) {
              signalsByDate[item.date] = {};
            }
            signalsByDate[item.date][item.metric] = item.value;
          });
        }

        // Filter sessions within date range
        const filteredSessions = sessions.filter((session) => {
          if (!session.created_at) return false;
          const sessionDate = session.created_at.split("T")[0];
          return sessionDate >= startDate && sessionDate <= endDate;
        });

        // Group sessions by date
        const sessionsByDate: Record<string, Session[]> = {};
        filteredSessions.forEach((session) => {
          const date = session.created_at?.split("T")[0] || "";
          if (!sessionsByDate[date]) {
            sessionsByDate[date] = [];
          }
          sessionsByDate[date].push(session);
        });

        // Build daily data array
        const daily: DailyData[] = [];
        const currentDate = new Date(startDate);
        const end = new Date(endDate);

        while (currentDate <= end) {
          const dateStr = currentDate.toISOString().split("T")[0];
          const daySessions = sessionsByDate[dateStr] || [];
          const daySignals = signalsByDate[dateStr] || {};

          const hours = daySessions.reduce((sum, s) => sum + s.minutes / 60, 0);
          const avgFocus = daySessions.length > 0
            ? daySessions.reduce((sum, s) => sum + s.focus, 0) / daySessions.length
            : 0;

          daily.push({
            date: dateStr,
            hours,
            avgFocus,
            sessionCount: daySessions.length,
            signals: daySignals,
          });

          currentDate.setDate(currentDate.getDate() + 1);
        }

        setDailyData(daily);

        // Calculate focus distribution
        const focusCounts: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
        filteredSessions.forEach((session) => {
          const score = Math.round(session.focus);
          if (score >= 1 && score <= 5) {
            focusCounts[score]++;
          }
        });

        const totalSessionsCount = filteredSessions.length;
        const distribution: FocusDistribution[] = [1, 2, 3, 4, 5].map((score) => ({
          score,
          count: focusCounts[score],
          percentage: totalSessionsCount > 0 ? (focusCounts[score] / totalSessionsCount) * 100 : 0,
        }));
        setFocusDistribution(distribution);

        // Calculate correlations
        const correlationInsights = calculateCorrelations(daily);
        setCorrelations(correlationInsights);

        // Calculate habit stats
        const habits = calculateHabitStats(daily);
        setHabitStats(habits);

        // Calculate summary
        const totalHours = daily.reduce((sum, d) => sum + d.hours, 0);
        const daysWithSessions = daily.filter((d) => d.sessionCount > 0);
        const avgFocusScore = daysWithSessions.length > 0
          ? daysWithSessions.reduce((sum, d) => sum + d.avgFocus, 0) / daysWithSessions.length
          : 0;

        const activeSignals = user?.preferences?.activeSignals || [];
        const signalCompletions = daily.map((d) => {
          const completed = Object.values(d.signals).filter((v) => v === true || (typeof v === "number" && v > 0)).length;
          return activeSignals.length > 0 ? (completed / activeSignals.length) * 100 : 0;
        });
        const avgSignalCompletion = signalCompletions.length > 0
          ? signalCompletions.reduce((sum, c) => sum + c, 0) / signalCompletions.length
          : 0;

        const avgSessionLength = totalSessionsCount > 0
          ? filteredSessions.reduce((sum, s) => sum + s.minutes, 0) / totalSessionsCount
          : 0;

        const bestDay = daily.reduce(
          (best, d) => (d.hours > (best?.hours || 0) ? { date: d.date, hours: d.hours } : best),
          null as { date: string; hours: number } | null
        );

        setSummary({
          totalHours,
          avgFocusScore,
          avgSignalCompletion,
          totalSessions: totalSessionsCount,
          avgSessionLength,
          bestDay,
        });

        // Generate best days insight
        const insight = generateBestDaysInsight(daily);
        setBestDaysInsight(insight);
      } catch (error) {
        console.error("Failed to fetch insights data:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [timeRange, customDateRange, user, getDateRange, calculateCorrelations, calculateHabitStats, generateBestDaysInsight]);

  return {
    dailyData,
    focusDistribution,
    correlations,
    habitStats,
    summary,
    bestDaysInsight,
    isLoading,
  };
};

