import React, { useState, useEffect } from "react";
import { useAuth } from "../../../context/AuthContext";
import { DailyHoursGoal, YearlyGoal } from "../../../types/User";
import { Calendar, Clock } from "lucide-react";

const DAYS_OF_WEEK = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
] as const;

type DayOfWeek = (typeof DAYS_OF_WEEK)[number];

const DEFAULT_DAILY_HOURS = {
  monday: 4,
  tuesday: 4,
  wednesday: 4,
  thursday: 4,
  friday: 4,
  saturday: 4,
  sunday: 4,
};

const WorkingHoursSettings: React.FC = () => {
  const { user } = useAuth();

  // Initialize with default values or values from user preferences
  const [dailyHours, setDailyHours] = useState<DailyHoursGoal>(
    user?.preferences?.dailyHoursGoals || DEFAULT_DAILY_HOURS
  );

  const [yearlyGoal, setYearlyGoal] = useState<YearlyGoal>(
    user?.preferences?.yearlyHoursGoal || {
      hoursPerYear: 1400,
      startDate: new Date().toISOString().slice(0, 10), // Default to today
    }
  );

  const [suggestedYearlyHours, setSuggestedYearlyHours] = useState<number>(0);
  const [isSuggestVisible, setIsSuggestVisible] = useState<boolean>(false);

  // Update state when user data changes
  useEffect(() => {
    if (user?.preferences?.dailyHoursGoals) {
      setDailyHours(user.preferences.dailyHoursGoals);
    }
    if (user?.preferences?.yearlyHoursGoal) {
      setYearlyGoal(user.preferences.yearlyHoursGoal);
    }
  }, [user]);

  // Calculate weekly hours whenever daily hours change
  useEffect(() => {
    // Calculate suggested yearly hours based on weekly hours
    const weeklyHours = Object.values(dailyHours).reduce(
      (sum, hours) => sum + hours,
      0
    );

    // Multiply by 52 weeks and round down to nearest 100
    const suggestionRaw = weeklyHours * 52;
    const suggestionRounded = Math.floor(suggestionRaw / 100) * 100;

    setSuggestedYearlyHours(suggestionRounded);
  }, [dailyHours]);

  const handleDailyHoursChange = (day: DayOfWeek, value: number) => {
    setDailyHours((prev) => ({
      ...prev,
      [day]: value,
    }));
  };

  const handleSetWeekendsToZero = () => {
    setDailyHours((prev) => ({
      ...prev,
      saturday: 0,
      sunday: 0,
    }));
  };

  const formatDayName = (day: string): string => {
    return day.charAt(0).toUpperCase() + day.slice(1);
  };

  const calculateWeeklyHours = (): number => {
    return Object.values(dailyHours).reduce((sum, hours) => sum + hours, 0);
  };

  const handleYearlyHoursChange = (value: number) => {
    setYearlyGoal((prev) => ({
      ...prev,
      hoursPerYear: value,
    }));
  };

  const handleStartDateChange = (monthDay: string) => {
    // Store as a full date string for backward compat, using current year
    const year = new Date().getFullYear();
    const fullDate = `${year}-${monthDay}`;
    setYearlyGoal((prev) => ({
      ...prev,
      startDate: fullDate,
    }));
  };

  // Extract month and day from the stored startDate (YYYY-MM-DD)
  const getMonthFromStartDate = (): number => {
    const parts = yearlyGoal.startDate?.split("-");
    return parts && parts.length >= 2 ? parseInt(parts[1], 10) : 1;
  };

  const getDayFromStartDate = (): number => {
    const parts = yearlyGoal.startDate?.split("-");
    return parts && parts.length >= 3 ? parseInt(parts[2], 10) : 1;
  };

  const handleSaveSuggestion = () => {
    handleYearlyHoursChange(suggestedYearlyHours);
    setIsSuggestVisible(false);
  };

  // Store current values in a custom property that the parent component can access
  React.useEffect(() => {
    // @ts-ignore - This is a hack to expose state to parent component
    window.__workingHoursSettings = {
      dailyHoursGoals: dailyHours,
      yearlyHoursGoal: yearlyGoal,
    };
  }, [dailyHours, yearlyGoal]);

  return (
    <div className="space-y-6">
      {/* Daily Hours Settings */}
      <div>
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-sm font-medium text-gray-900 dark:text-white">
            Daily Focus Hours
          </h3>
          <button
            onClick={handleSetWeekendsToZero}
            className="text-xs px-2 py-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            Set weekends to 0
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {DAYS_OF_WEEK.map((day) => (
            <div
              key={day}
              className="flex flex-col p-3 border border-gray-200 dark:border-gray-800 rounded-md"
            >
              <label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">
                {formatDayName(day)}
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="0"
                  max="24"
                  step="0.5"
                  value={dailyHours[day]}
                  onChange={(e) =>
                    handleDailyHoursChange(day, Number(e.target.value))
                  }
                  className="w-full p-2 border border-gray-200 dark:border-gray-800 rounded-md bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 text-sm focus:outline-none focus:ring-1 focus:ring-gray-400 dark:focus:ring-gray-500 focus:border-gray-400 dark:focus:border-gray-500 pr-12"
                />
                <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 dark:text-gray-400 text-sm">
                  hours
                </span>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-2 p-3 bg-gray-50 dark:bg-gray-900/40 rounded-md border border-gray-200 dark:border-gray-800">
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Weekly Total:
            </span>
            <span className="text-sm font-mono font-bold text-gray-900 dark:text-white">
              {calculateWeeklyHours()} hours
            </span>
          </div>
        </div>
      </div>

      {/* Yearly Goal Settings */}
      <div>
        <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-4">
          Yearly Focus Goal
        </h3>

        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">
              Yearly Hours Target
            </label>
            <div className="relative">
              <input
                type="number"
                min="0"
                step="100"
                value={yearlyGoal.hoursPerYear}
                onChange={(e) =>
                  handleYearlyHoursChange(Number(e.target.value))
                }
                onFocus={() => setIsSuggestVisible(true)}
                className="w-full p-2 border border-gray-200 dark:border-gray-800 rounded-md bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 text-sm focus:outline-none focus:ring-1 focus:ring-gray-400 dark:focus:ring-gray-500 focus:border-gray-400 dark:focus:border-gray-500 pr-16"
              />
              <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 dark:text-gray-400 text-sm">
                hours/year
              </span>
            </div>

            {/* Suggestion Dialog */}
            {isSuggestVisible && (
              <div className="mt-2 p-3 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-md text-xs text-indigo-700 dark:text-indigo-300">
                <p>
                  Based on your weekly hours, we suggest:{" "}
                  <span className="font-bold">
                    {suggestedYearlyHours} hours
                  </span>
                </p>
                <button
                  onClick={handleSaveSuggestion}
                  className="mt-2 px-2 py-1 bg-indigo-100 dark:bg-indigo-800 border border-indigo-300 dark:border-indigo-700 rounded-md text-indigo-700 dark:text-indigo-300 hover:bg-indigo-200 dark:hover:bg-indigo-700 transition-colors"
                >
                  Use this suggestion
                </button>
              </div>
            )}
          </div>

          <div className="flex-1">
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">
              Year Start Date
            </label>
            <div className="flex gap-2">
              <select
                value={getMonthFromStartDate()}
                onChange={(e) => {
                  const month = String(e.target.value).padStart(2, "0");
                  const day = String(getDayFromStartDate()).padStart(2, "0");
                  handleStartDateChange(`${month}-${day}`);
                }}
                className="flex-1 p-2 border border-gray-200 dark:border-gray-800 rounded-md bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 text-sm focus:outline-none focus:ring-1 focus:ring-gray-400 dark:focus:ring-gray-500 focus:border-gray-400 dark:focus:border-gray-500"
              >
                {[
                  "January", "February", "March", "April", "May", "June",
                  "July", "August", "September", "October", "November", "December",
                ].map((name, i) => (
                  <option key={i + 1} value={i + 1}>
                    {name}
                  </option>
                ))}
              </select>
              <select
                value={getDayFromStartDate()}
                onChange={(e) => {
                  const month = String(getMonthFromStartDate()).padStart(2, "0");
                  const day = String(e.target.value).padStart(2, "0");
                  handleStartDateChange(`${month}-${day}`);
                }}
                className="w-20 p-2 border border-gray-200 dark:border-gray-800 rounded-md bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 text-sm focus:outline-none focus:ring-1 focus:ring-gray-400 dark:focus:ring-gray-500 focus:border-gray-400 dark:focus:border-gray-500"
              >
                {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WorkingHoursSettings;
