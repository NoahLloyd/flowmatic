import React, { useState, useRef, useEffect } from "react";
import { Calendar, ChevronDown, X } from "lucide-react";
import { TimeRange, CustomDateRange } from "../hooks/useInsightsData";

interface TimeRangeSelectorProps {
  selected: TimeRange;
  onChange: (range: TimeRange) => void;
  customDateRange?: CustomDateRange;
  onCustomDateChange?: (range: CustomDateRange) => void;
}

const TimeRangeSelector: React.FC<TimeRangeSelectorProps> = ({
  selected,
  onChange,
  customDateRange,
  onCustomDateChange,
}) => {
  const [showCustomPicker, setShowCustomPicker] = useState(false);
  const [tempStartDate, setTempStartDate] = useState(customDateRange?.startDate || "");
  const [tempEndDate, setTempEndDate] = useState(customDateRange?.endDate || "");
  const pickerRef = useRef<HTMLDivElement>(null);

  const presetOptions: { value: TimeRange; label: string }[] = [
    { value: "30d", label: "30 Days" },
    { value: "90d", label: "90 Days" },
    { value: "1y", label: "1 Year" },
    { value: "all", label: "All Time" },
  ];

  // Close picker when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) {
        setShowCustomPicker(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Initialize temp dates when custom range changes
  useEffect(() => {
    if (customDateRange) {
      setTempStartDate(customDateRange.startDate);
      setTempEndDate(customDateRange.endDate);
    }
  }, [customDateRange]);

  const handleCustomSelect = () => {
    setShowCustomPicker(true);
    // Set default dates if not set
    if (!tempStartDate || !tempEndDate) {
      const today = new Date();
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(today.getDate() - 30);
      setTempStartDate(thirtyDaysAgo.toISOString().split("T")[0]);
      setTempEndDate(today.toISOString().split("T")[0]);
    }
  };

  const handleApplyCustomRange = () => {
    if (tempStartDate && tempEndDate && onCustomDateChange) {
      onCustomDateChange({ startDate: tempStartDate, endDate: tempEndDate });
      onChange("custom");
      setShowCustomPicker(false);
    }
  };

  const formatDisplayDate = (dateStr: string) => {
    const date = new Date(dateStr + "T12:00:00");
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };

  const getCustomLabel = () => {
    if (customDateRange?.startDate && customDateRange?.endDate) {
      return `${formatDisplayDate(customDateRange.startDate)} - ${formatDisplayDate(customDateRange.endDate)}`;
    }
    return "Custom";
  };

  return (
    <div className="relative flex items-center gap-2">
      {/* Preset Options */}
      <div className="inline-flex rounded-lg bg-gray-100 dark:bg-gray-800 p-1">
        {presetOptions.map((option) => (
          <button
            key={option.value}
            onClick={() => {
              onChange(option.value);
              setShowCustomPicker(false);
            }}
            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${
              selected === option.value
                ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm"
                : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      {/* Custom Date Picker */}
      <div className="relative" ref={pickerRef}>
        <button
          onClick={handleCustomSelect}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg transition-all border ${
            selected === "custom"
              ? "bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800"
              : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
          }`}
        >
          <Calendar className="w-4 h-4" />
          <span className="hidden sm:inline">
            {selected === "custom" ? getCustomLabel() : "Custom"}
          </span>
          <ChevronDown className="w-3 h-3" />
        </button>

        {/* Custom Date Picker Dropdown */}
        {showCustomPicker && (
          <div className="absolute right-0 top-full mt-2 p-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-xl z-50 min-w-[320px]">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                Custom Date Range
              </h3>
              <button
                onClick={() => setShowCustomPicker(false)}
                className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">
                  Start Date
                </label>
                <input
                  type="date"
                  value={tempStartDate}
                  onChange={(e) => setTempStartDate(e.target.value)}
                  max={tempEndDate || undefined}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">
                  End Date
                </label>
                <input
                  type="date"
                  value={tempEndDate}
                  onChange={(e) => setTempEndDate(e.target.value)}
                  min={tempStartDate || undefined}
                  max={new Date().toISOString().split("T")[0]}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {/* Quick Presets */}
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">
                  Quick Select
                </label>
                <div className="flex flex-wrap gap-2">
                  {[
                    { label: "This Month", days: 0, isThisMonth: true },
                    { label: "Last Month", days: 0, isLastMonth: true },
                    { label: "This Quarter", days: 0, isThisQuarter: true },
                    { label: "Last 6 Months", days: 180 },
                  ].map((preset) => (
                    <button
                      key={preset.label}
                      onClick={() => {
                        const today = new Date();
                        let start: Date, end: Date;

                        if (preset.isThisMonth) {
                          start = new Date(today.getFullYear(), today.getMonth(), 1);
                          end = today;
                        } else if (preset.isLastMonth) {
                          start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
                          end = new Date(today.getFullYear(), today.getMonth(), 0);
                        } else if (preset.isThisQuarter) {
                          const quarterStart = Math.floor(today.getMonth() / 3) * 3;
                          start = new Date(today.getFullYear(), quarterStart, 1);
                          end = today;
                        } else {
                          start = new Date();
                          start.setDate(today.getDate() - preset.days);
                          end = today;
                        }

                        setTempStartDate(start.toISOString().split("T")[0]);
                        setTempEndDate(end.toISOString().split("T")[0]);
                      }}
                      className="px-2.5 py-1 text-xs font-medium rounded-md bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={handleApplyCustomRange}
                disabled={!tempStartDate || !tempEndDate}
                className="w-full py-2.5 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Apply Range
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TimeRangeSelector;
