import React, { useState, useEffect } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
  LineChart,
  Line,
} from "recharts";
import { Loader2, TrendingUp, TrendingDown, Minus, Calendar, Clock, Target, Zap } from "lucide-react";
import { useYearComparisonData, YearData } from "../hooks/useYearComparisonData";
import { useTheme } from "../../../context/ThemeContext";

interface YearComparisonProps {
  onClose: () => void;
}

const YEAR_COLORS = [
  { main: "#3b82f6", light: "#93c5fd" }, // Blue
  { main: "#8b5cf6", light: "#c4b5fd" }, // Purple
  { main: "#10b981", light: "#6ee7b7" }, // Emerald
  { main: "#f59e0b", light: "#fcd34d" }, // Amber
  { main: "#ef4444", light: "#fca5a5" }, // Red
];

const YearComparison: React.FC<YearComparisonProps> = ({ onClose }) => {
  const { isDarkMode } = useTheme();
  const currentYear = new Date().getFullYear();
  const [selectedYears, setSelectedYears] = useState<number[]>([currentYear, currentYear - 1]);
  
  const { years, availableYears, isLoading } = useYearComparisonData(selectedYears);

  const toggleYear = (year: number) => {
    if (selectedYears.includes(year)) {
      if (selectedYears.length > 1) {
        setSelectedYears(selectedYears.filter((y) => y !== year));
      }
    } else if (selectedYears.length < 4) {
      setSelectedYears([...selectedYears, year].sort((a, b) => b - a));
    }
  };

  // Prepare monthly comparison data
  const getMonthlyComparisonData = () => {
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    
    return months.map((monthName, index) => {
      const dataPoint: Record<string, any> = { month: monthName };
      
      years.forEach((yearData) => {
        const monthData = yearData.monthlyData.find((m) => m.month === index);
        dataPoint[`hours_${yearData.year}`] = monthData?.hours || 0;
        dataPoint[`sessions_${yearData.year}`] = monthData?.sessions || 0;
      });
      
      return dataPoint;
    });
  };

  // Calculate year-over-year change
  const getYoYChange = (current: number, previous: number): { value: number; direction: "up" | "down" | "same" } => {
    if (previous === 0) return { value: 0, direction: "same" };
    const change = ((current - previous) / previous) * 100;
    return {
      value: Math.abs(change),
      direction: change > 0 ? "up" : change < 0 ? "down" : "same",
    };
  };

  const monthlyData = getMonthlyComparisonData();

  // Custom tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-4 py-3 shadow-lg">
          <p className="text-sm font-medium text-gray-900 dark:text-white mb-2">{label}</p>
          {payload.map((entry: any, index: number) => {
            const year = entry.dataKey.split("_")[1];
            return (
              <p key={index} className="text-sm" style={{ color: entry.color }}>
                {year}: {entry.value}h
              </p>
            );
          })}
        </div>
      );
    }
    return null;
  };

  if (isLoading) {
    return (
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-8">
        <div className="flex flex-col items-center justify-center min-h-[300px]">
          <Loader2 className="w-6 h-6 animate-spin text-gray-400 mb-3" />
          <p className="text-sm text-gray-500 dark:text-gray-400">Loading comparison data...</p>
        </div>
      </div>
    );
  }

  if (availableYears.length < 2) {
    return (
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-8">
        <div className="flex flex-col items-center justify-center min-h-[200px]">
          <Calendar className="w-10 h-10 text-gray-300 dark:text-gray-600 mb-3" />
          <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-1">
            Not enough data for comparison
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 text-center max-w-sm">
            You need at least 2 years of data to compare. Keep tracking your sessions!
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Year Selection */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">
              Year-over-Year Comparison
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Compare your focus patterns across different years
            </p>
          </div>
          
          <div className="flex flex-wrap gap-2">
            {availableYears.map((year) => {
              const isSelected = selectedYears.includes(year);
              const colorIndex = selectedYears.indexOf(year);
              const color = isSelected && colorIndex >= 0 ? YEAR_COLORS[colorIndex % YEAR_COLORS.length] : null;
              
              return (
                <button
                  key={year}
                  onClick={() => toggleYear(year)}
                  className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-all ${
                    isSelected
                      ? "text-white shadow-sm"
                      : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"
                  }`}
                  style={isSelected ? { backgroundColor: color?.main } : undefined}
                >
                  {year}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {years.map((yearData, index) => {
          const color = YEAR_COLORS[index % YEAR_COLORS.length];
          const prevYear = years.find((y) => y.year === yearData.year - 1);
          
          return (
            <div
              key={yearData.year}
              className="bg-white dark:bg-gray-900 rounded-xl border-2 p-5 relative overflow-hidden"
              style={{ borderColor: color.main }}
            >
              <div
                className="absolute top-0 right-0 w-24 h-24 opacity-5 rounded-full -mr-8 -mt-8"
                style={{ backgroundColor: color.main }}
              />
              
              <div className="flex items-center justify-between mb-4">
                <span
                  className="text-lg font-bold"
                  style={{ color: color.main }}
                >
                  {yearData.year}
                </span>
                {prevYear && (
                  <span className="flex items-center gap-1 text-xs">
                    {(() => {
                      const change = getYoYChange(yearData.totalHours, prevYear.totalHours);
                      if (change.direction === "up") {
                        return (
                          <span className="flex items-center text-emerald-600 dark:text-emerald-400">
                            <TrendingUp className="w-3 h-3" />
                            +{change.value.toFixed(0)}%
                          </span>
                        );
                      } else if (change.direction === "down") {
                        return (
                          <span className="flex items-center text-red-500">
                            <TrendingDown className="w-3 h-3" />
                            -{change.value.toFixed(0)}%
                          </span>
                        );
                      }
                      return <Minus className="w-3 h-3 text-gray-400" />;
                    })()}
                  </span>
                )}
              </div>
              
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-gray-400" />
                  <div>
                    <p className="text-xl font-semibold text-gray-900 dark:text-white">
                      {yearData.totalHours}h
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Total Hours</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-gray-400" />
                  <div>
                    <p className="text-lg font-medium text-gray-900 dark:text-white">
                      {yearData.totalSessions}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Sessions</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <Target className="w-4 h-4 text-gray-400" />
                  <div>
                    <p className="text-lg font-medium text-gray-900 dark:text-white">
                      {yearData.avgFocusScore}<span className="text-sm text-gray-400">/5</span>
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Avg Focus</p>
                  </div>
                </div>
                
                {yearData.bestMonth && (
                  <div className="pt-2 border-t border-gray-100 dark:border-gray-800">
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Best: <span className="font-medium text-gray-700 dark:text-gray-300">{yearData.bestMonth.month}</span> ({yearData.bestMonth.hours}h)
                    </p>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Monthly Comparison Chart */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-5">
        <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-4">
          Monthly Focus Hours
        </h3>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={monthlyData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
              <XAxis
                dataKey="month"
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
              <Tooltip content={<CustomTooltip />} />
              <Legend
                wrapperStyle={{ paddingTop: "20px" }}
                formatter={(value) => {
                  const year = value.split("_")[1];
                  return <span className="text-sm text-gray-600 dark:text-gray-400">{year}</span>;
                }}
              />
              {selectedYears.map((year, index) => (
                <Bar
                  key={year}
                  dataKey={`hours_${year}`}
                  name={`hours_${year}`}
                  fill={YEAR_COLORS[index % YEAR_COLORS.length].main}
                  radius={[4, 4, 0, 0]}
                  maxBarSize={40}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Monthly Trend Line Chart */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-5">
        <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-4">
          Focus Hours Trend
        </h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={monthlyData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
              <XAxis
                dataKey="month"
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
              <Tooltip content={<CustomTooltip />} />
              <Legend
                wrapperStyle={{ paddingTop: "20px" }}
                formatter={(value) => {
                  const year = value.split("_")[1];
                  return <span className="text-sm text-gray-600 dark:text-gray-400">{year}</span>;
                }}
              />
              {selectedYears.map((year, index) => (
                <Line
                  key={year}
                  type="monotone"
                  dataKey={`hours_${year}`}
                  name={`hours_${year}`}
                  stroke={YEAR_COLORS[index % YEAR_COLORS.length].main}
                  strokeWidth={2.5}
                  dot={{ fill: YEAR_COLORS[index % YEAR_COLORS.length].main, strokeWidth: 0, r: 4 }}
                  activeDot={{ r: 6 }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Detailed Year Stats Table */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-800">
          <h3 className="text-sm font-medium text-gray-900 dark:text-white">
            Detailed Comparison
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-800/50">
              <tr>
                <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Metric
                </th>
                {years.map((y, index) => (
                  <th
                    key={y.year}
                    className="px-5 py-3 text-right text-xs font-medium uppercase tracking-wider"
                    style={{ color: YEAR_COLORS[index % YEAR_COLORS.length].main }}
                  >
                    {y.year}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              <tr>
                <td className="px-5 py-3 text-sm text-gray-600 dark:text-gray-400">Total Hours</td>
                {years.map((y) => (
                  <td key={y.year} className="px-5 py-3 text-sm text-right font-medium text-gray-900 dark:text-white">
                    {y.totalHours}h
                  </td>
                ))}
              </tr>
              <tr>
                <td className="px-5 py-3 text-sm text-gray-600 dark:text-gray-400">Total Sessions</td>
                {years.map((y) => (
                  <td key={y.year} className="px-5 py-3 text-sm text-right font-medium text-gray-900 dark:text-white">
                    {y.totalSessions}
                  </td>
                ))}
              </tr>
              <tr>
                <td className="px-5 py-3 text-sm text-gray-600 dark:text-gray-400">Avg Focus Score</td>
                {years.map((y) => (
                  <td key={y.year} className="px-5 py-3 text-sm text-right font-medium text-gray-900 dark:text-white">
                    {y.avgFocusScore}/5
                  </td>
                ))}
              </tr>
              <tr>
                <td className="px-5 py-3 text-sm text-gray-600 dark:text-gray-400">Avg Session Length</td>
                {years.map((y) => (
                  <td key={y.year} className="px-5 py-3 text-sm text-right font-medium text-gray-900 dark:text-white">
                    {y.avgSessionLength}m
                  </td>
                ))}
              </tr>
              <tr>
                <td className="px-5 py-3 text-sm text-gray-600 dark:text-gray-400">Active Days</td>
                {years.map((y) => (
                  <td key={y.year} className="px-5 py-3 text-sm text-right font-medium text-gray-900 dark:text-white">
                    {y.activeDays}
                  </td>
                ))}
              </tr>
              <tr>
                <td className="px-5 py-3 text-sm text-gray-600 dark:text-gray-400">Best Month</td>
                {years.map((y) => (
                  <td key={y.year} className="px-5 py-3 text-sm text-right font-medium text-gray-900 dark:text-white">
                    {y.bestMonth ? `${y.bestMonth.month} (${y.bestMonth.hours}h)` : "-"}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default YearComparison;

