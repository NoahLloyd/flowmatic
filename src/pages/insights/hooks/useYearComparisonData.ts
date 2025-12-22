import { useState, useEffect, useCallback } from "react";
import { api } from "../../../utils/api";
import { Session } from "../../../types/Session";
import { useAuth } from "../../../context/AuthContext";

export interface YearData {
  year: number;
  totalHours: number;
  totalSessions: number;
  avgFocusScore: number;
  avgSessionLength: number;
  monthlyData: {
    month: number;
    monthName: string;
    hours: number;
    sessions: number;
    avgFocus: number;
  }[];
  activeDays: number;
  bestMonth: { month: string; hours: number } | null;
}

export interface YearComparisonData {
  years: YearData[];
  availableYears: number[];
  selectedYears: number[];
  isLoading: boolean;
}

export const useYearComparisonData = (selectedYears: number[]): YearComparisonData => {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [years, setYears] = useState<YearData[]>([]);
  const [availableYears, setAvailableYears] = useState<number[]>([]);

  const monthNames = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
  ];

  useEffect(() => {
    const fetchData = async () => {
      if (!user) return;

      setIsLoading(true);

      try {
        // Fetch all sessions
        const sessions: Session[] = await api.getUserSessions();

        // Determine available years from sessions
        const yearsSet = new Set<number>();
        sessions.forEach((session) => {
          if (session.created_at) {
            const year = new Date(session.created_at).getFullYear();
            yearsSet.add(year);
          }
        });

        const sortedYears = Array.from(yearsSet).sort((a, b) => b - a);
        setAvailableYears(sortedYears);

        // If no years selected, skip processing
        if (selectedYears.length === 0) {
          setYears([]);
          setIsLoading(false);
          return;
        }

        // Process data for each selected year
        const yearsData: YearData[] = selectedYears.map((year) => {
          // Filter sessions for this year
          const yearSessions = sessions.filter((session) => {
            if (!session.created_at) return false;
            return new Date(session.created_at).getFullYear() === year;
          });

          // Group by month
          const monthlyMap: Record<number, { hours: number; sessions: number; focusSum: number }> = {};
          const daysSet = new Set<string>();

          yearSessions.forEach((session) => {
            const date = new Date(session.created_at!);
            const month = date.getMonth();
            const dayKey = session.created_at!.split("T")[0];

            daysSet.add(dayKey);

            if (!monthlyMap[month]) {
              monthlyMap[month] = { hours: 0, sessions: 0, focusSum: 0 };
            }
            monthlyMap[month].hours += session.minutes / 60;
            monthlyMap[month].sessions += 1;
            monthlyMap[month].focusSum += session.focus;
          });

          // Build monthly data array (all 12 months)
          const monthlyData = Array.from({ length: 12 }, (_, i) => {
            const data = monthlyMap[i] || { hours: 0, sessions: 0, focusSum: 0 };
            return {
              month: i,
              monthName: monthNames[i],
              hours: Number(data.hours.toFixed(1)),
              sessions: data.sessions,
              avgFocus: data.sessions > 0 ? Number((data.focusSum / data.sessions).toFixed(1)) : 0,
            };
          });

          // Calculate totals
          const totalHours = yearSessions.reduce((sum, s) => sum + s.minutes / 60, 0);
          const totalSessions = yearSessions.length;
          const avgFocusScore = totalSessions > 0
            ? yearSessions.reduce((sum, s) => sum + s.focus, 0) / totalSessions
            : 0;
          const avgSessionLength = totalSessions > 0
            ? yearSessions.reduce((sum, s) => sum + s.minutes, 0) / totalSessions
            : 0;

          // Find best month
          let bestMonth: { month: string; hours: number } | null = null;
          monthlyData.forEach((m) => {
            if (!bestMonth || m.hours > bestMonth.hours) {
              bestMonth = { month: m.monthName, hours: m.hours };
            }
          });

          return {
            year,
            totalHours: Number(totalHours.toFixed(1)),
            totalSessions,
            avgFocusScore: Number(avgFocusScore.toFixed(1)),
            avgSessionLength: Number(avgSessionLength.toFixed(0)),
            monthlyData,
            activeDays: daysSet.size,
            bestMonth: bestMonth && bestMonth.hours > 0 ? bestMonth : null,
          };
        });

        setYears(yearsData);
      } catch (error) {
        console.error("Failed to fetch year comparison data:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [user, selectedYears]);

  return {
    years,
    availableYears,
    selectedYears,
    isLoading,
  };
};

