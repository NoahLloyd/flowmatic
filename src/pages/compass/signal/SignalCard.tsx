import React, { useState, KeyboardEvent, useEffect } from "react";
import { Signal, SignalStatus } from "../../../types/Signal";
import { useSignals } from "../../../context/SignalsContext";

interface SignalCardProps {
  metric: string;
  label: string;
  format: string;
  value: any;
  unit?: string;
  type: Signal["type"];
  status: SignalStatus;
  timestamp: string | Date;
  history: any[];
  isHistoryLoading: boolean;
  goalValue?: number;
  onChange?: (value: number | boolean) => void;
  isModalOpen?: boolean;
}

const SignalCard = ({
  metric,
  label,
  format,
  value,
  unit,
  type,
  status,
  timestamp,
  history,
  isHistoryLoading,
  goalValue,
  onChange = () => {},
  isModalOpen = false,
}: SignalCardProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [tempValue, setTempValue] = useState(value);
  const { updateSignal } = useSignals();

  // Get a formatted string representing how long ago the timestamp was
  const getTimeAgo = (timestamp: string | Date): string => {
    const now = new Date();
    const date = new Date(timestamp);
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (seconds < 60) return "just now";

    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes} min ago`;

    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} hr ago`;

    const days = Math.floor(hours / 24);
    return `${days} day${days > 1 ? "s" : ""} ago`;
  };

  // Log history data when it changes
  useEffect(() => {
    console.log(`[${label}] Received history data:`, history);
  }, [history, label]);

  useEffect(() => {
    // Update temp value when the actual value changes
    setTempValue(value);
  }, [value]);

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleValueChange(Number(tempValue));
      setIsEditing(false);
    }
  };

  const handleValueChange = (newValue: number | boolean) => {
    if (isModalOpen) return;
    onChange(newValue);
    updateSignal(metric, newValue);
  };

  // Format the value for display
  let formattedValue: string | number | boolean = value;
  if (type === "binary") {
    formattedValue = value ? "Yes" : "No";
  } else if (typeof value === "number") {
    if (format === "decimal") {
      formattedValue = value.toFixed(1);
    } else {
      formattedValue = Math.round(value);
    }
  }

  // Get background class based on status
  const containerClasses = status === "active" ? "" : "opacity-75";
  const bgClass = "bg-white dark:bg-gray-900";

  const getTimeColor = (minutes: number) => {
    // Check if we have a goal value for comparison
    if (goalValue && label === "Minutes to Office") {
      if (minutes <= goalValue * 0.5) {
        // Very fast - purple/green
        return "bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-200";
      } else if (minutes <= goalValue) {
        // Good - green
        return "bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-200";
      } else if (minutes <= goalValue * 1.25) {
        // Acceptable - yellow
        return "bg-yellow-100 dark:bg-yellow-900 text-yellow-700 dark:text-yellow-200";
      } else if (minutes <= goalValue * 1.5) {
        // Borderline - orange
        return "bg-orange-100 dark:bg-orange-900 text-orange-700 dark:text-orange-200";
      } else if (minutes <= goalValue * 2) {
        // Bad - light red
        return "bg-red-100 dark:bg-red-800 text-red-700 dark:text-red-200";
      } else {
        // Very bad - dark red
        return "bg-red-200 dark:bg-red-900 text-red-800 dark:text-red-100";
      }
    }

    // Default colors if no goal is set
    if (minutes <= 15)
      return "bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-200"; // Purple for excellent
    if (minutes <= 30)
      return "bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-200"; // Green for good
    if (minutes <= 45)
      return "bg-yellow-100 dark:bg-yellow-900 text-yellow-700 dark:text-yellow-200"; // Yellow for acceptable
    if (minutes <= 60)
      return "bg-orange-100 dark:bg-orange-900 text-orange-700 dark:text-orange-200"; // Orange for borderline
    if (minutes <= 90)
      return "bg-red-100 dark:bg-red-800 text-red-700 dark:text-red-200"; // Light red for bad

    // Very bad - dark red for anything above 90 mins
    return "bg-red-200 dark:bg-red-900 text-red-800 dark:text-red-100";
  };

  // Determine color based on goal and value
  const getColorBasedOnGoal = (value: number | boolean, type: string) => {
    if (typeof goalValue === "undefined") return "";

    if (typeof value === "boolean") {
      return value
        ? "bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-200"
        : "bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-200";
    }

    if (type === "water") {
      return value >= goalValue
        ? "bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-200"
        : value >= goalValue * 0.7
        ? "bg-yellow-100 dark:bg-yellow-900 text-yellow-700 dark:text-yellow-200"
        : "bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-200";
    }

    if (type === "number" && label === "Minutes to Office") {
      return value <= goalValue
        ? "bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-200"
        : value <= goalValue * 1.5
        ? "bg-yellow-100 dark:bg-yellow-900 text-yellow-700 dark:text-yellow-200"
        : "bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-200";
    }

    return value >= goalValue
      ? "bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-200"
      : "bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-200";
  };

  const renderPerformanceHistory = () => {
    // Create an array of the past 7 days
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - 6 + i);
      return date.toISOString().split("T")[0];
    });

    // Map history data to these days, filling gaps with null
    const formattedHistory = last7Days.map((date) => {
      const dayData = history.find((day) => day.date === date);
      return {
        date,
        value: dayData ? dayData.value : null,
        dayLetter: new Date(date)
          .toLocaleDateString("en-US", { weekday: "short" })
          .charAt(0),
      };
    });

    // Check if we have any non-null values
    const hasData = formattedHistory.some((day) => day.value !== null);

    // Render in a more compact form for the header
    return (
      <div className="flex">
        {formattedHistory.map((day, index) => {
          let bgColor = "bg-gray-100 dark:bg-gray-800";
          let textColor = "text-gray-400 dark:text-gray-500";

          if (day.value !== null) {
            if (type === "binary") {
              bgColor = (day.value as boolean)
                ? "bg-green-100 dark:bg-green-900"
                : "bg-red-100 dark:bg-red-900";
              textColor = (day.value as boolean)
                ? "text-green-700 dark:text-green-200"
                : "text-red-700 dark:text-red-200";
            } else if (type === "scale") {
              const scaleValue = day.value as number;
              if (scaleValue === 1) {
                // Darkest red for lowest value
                bgColor = "bg-red-200 dark:bg-red-900";
                textColor = "text-red-800 dark:text-red-200";
              } else if (scaleValue === 2) {
                // Lighter red for low value
                bgColor = "bg-red-100 dark:bg-red-800";
                textColor = "text-red-700 dark:text-red-200";
              } else if (scaleValue === 3) {
                bgColor = "bg-yellow-100 dark:bg-yellow-900";
                textColor = "text-yellow-700 dark:text-yellow-200";
              } else if (scaleValue === 4) {
                // Use green for high value
                bgColor = "bg-green-100 dark:bg-green-900";
                textColor = "text-green-700 dark:text-green-200";
              } else if (scaleValue === 5) {
                // Use purple for highest value (mood, energy)
                bgColor = "bg-green-100 dark:bg-green-900";
                textColor = "text-green-700 dark:text-green-200";
              }
            } else if (type === "number" || type === "water") {
              if (
                goalValue &&
                type === "number" &&
                label === "Minutes to Office"
              ) {
                // For Minutes to Office, lower is better (want to be under goal)
                const value = day.value as number;
                if (value <= goalValue * 0.5) {
                  // Very fast - purple/green
                  bgColor = "bg-green-100 dark:bg-green-900";
                  textColor = "text-green-700 dark:text-green-200";
                } else if (value <= goalValue) {
                  // Good - green
                  bgColor = "bg-green-100 dark:bg-green-900";
                  textColor = "text-green-700 dark:text-green-200";
                } else if (value <= goalValue * 1.25) {
                  // Acceptable - yellow
                  bgColor = "bg-yellow-100 dark:bg-yellow-900";
                  textColor = "text-yellow-700 dark:text-yellow-200";
                } else if (value <= goalValue * 1.5) {
                  // Borderline - orange
                  bgColor = "bg-orange-100 dark:bg-orange-900";
                  textColor = "text-orange-700 dark:text-orange-200";
                } else if (value <= goalValue * 2) {
                  // Bad - light red
                  bgColor = "bg-red-100 dark:bg-red-800";
                  textColor = "text-red-700 dark:text-red-200";
                } else {
                  // Very bad - dark red
                  bgColor = "bg-red-200 dark:bg-red-900";
                  textColor = "text-red-800 dark:text-red-100";
                }
              } else if (goalValue) {
                // For other metrics with goals, higher is better (want to be over goal)
                const value = day.value as number;
                if (value >= goalValue * 1.5) {
                  // Excellent - purple/green
                  bgColor = "bg-green-100 dark:bg-green-900";
                  textColor = "text-green-700 dark:text-green-200";
                } else if (value >= goalValue) {
                  // Good - green
                  bgColor = "bg-green-100 dark:bg-green-900";
                  textColor = "text-green-700 dark:text-green-200";
                } else if (value >= goalValue * 0.8) {
                  // Close - yellow
                  bgColor = "bg-yellow-100 dark:bg-yellow-900";
                  textColor = "text-yellow-700 dark:text-yellow-200";
                } else if (value >= goalValue * 0.6) {
                  // Getting there - orange
                  bgColor = "bg-orange-100 dark:bg-orange-900";
                  textColor = "text-orange-700 dark:text-orange-200";
                } else if (value >= goalValue * 0.4) {
                  // Not great - light red
                  bgColor = "bg-red-100 dark:bg-red-800";
                  textColor = "text-red-700 dark:text-red-200";
                } else {
                  // Bad - dark red
                  bgColor = "bg-red-200 dark:bg-red-900";
                  textColor = "text-red-800 dark:text-red-100";
                }
              } else {
                bgColor = "bg-blue-100 dark:bg-blue-900";
                textColor = "text-blue-700 dark:text-blue-200";
              }
            }
          }

          return (
            <div
              key={index}
              className={`w-4 h-4 mx-0.5 ${bgColor} ${textColor} rounded-sm flex items-center justify-center text-xs font-medium`}
              title={`${day.date}: ${
                day.value !== null ? day.value : "No data"
              }`}
            >
              {/* No text in the small squares to keep it clean */}
            </div>
          );
        })}
      </div>
    );
  };

  // Render a loading state when history is loading
  const renderHistoryOrLoading = () => {
    if (isHistoryLoading) {
      console.log(`[${label}] History data is loading...`);
      return (
        <div className="animate-pulse h-4 bg-gray-200 dark:bg-gray-700 rounded w-16"></div>
      );
    }

    // Always render the history visualization, even when empty
    return renderPerformanceHistory();
  };

  const renderWaterOptions = () => {
    const options = [
      { label: "350ml", value: 350 },
      { label: "1.1L", value: 1100 },
    ];

    return (
      <div className="flex items-center gap-2">
        {options.map((option) => (
          <button
            key={option.value}
            onClick={() => {
              if (isModalOpen) return;
              handleValueChange((value as number) + option.value);
            }}
            className="py-1.5 px-3 rounded-md text-sm font-medium transition-colors bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-100"
          >
            +{option.label}
          </button>
        ))}
        <div
          onClick={() => {
            if (isModalOpen) return;
            setIsEditing(true);
          }}
          className="flex-1 text-center py-1.5 px-2 text-sm font-mono bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-md cursor-pointer text-gray-800 dark:text-gray-200"
        >
          {isEditing ? (
            <input
              type="number"
              value={tempValue as number}
              onChange={(e) => setTempValue(Number(e.target.value))}
              onKeyDown={handleKeyDown}
              onBlur={() => {
                if (isModalOpen) return;
                handleValueChange(Number(tempValue));
                setIsEditing(false);
              }}
              className="w-full text-center h-full focus:outline-none focus:ring-1 focus:ring-gray-400 dark:focus:ring-gray-500 bg-transparent text-gray-800 dark:text-gray-200"
              autoFocus
            />
          ) : (
            <span className="text-gray-800 dark:text-gray-200">{value}ml</span>
          )}
        </div>
      </div>
    );
  };

  const renderScale = () => {
    const getScaleColor = (num: number) => {
      const colors = {
        1: "bg-red-200 dark:bg-red-900 text-red-800 dark:text-red-200", // Darkest red
        2: "bg-red-100 dark:bg-red-800 text-red-700 dark:text-red-200", // Lighter red
        3: "bg-yellow-100 dark:bg-yellow-900 text-yellow-700 dark:text-yellow-200", // Yellow
        4: "bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-200", // Green
        5: "bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-200", // Purple/green for highest
      };
      return (
        colors[num as keyof typeof colors] ||
        "bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700"
      );
    };

    return (
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((num) => (
          <button
            key={num}
            onClick={() => {
              if (isModalOpen) return;
              handleValueChange(num);
            }}
            className={`flex-1 py-1.5 rounded-md text-sm font-medium transition-colors ${
              value === num
                ? getScaleColor(num)
                : "bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-100"
            }`}
          >
            {num}
          </button>
        ))}
      </div>
    );
  };

  const renderNumber = () => {
    return (
      <div
        onClick={() => {
          if (isModalOpen) return;
          setIsEditing(true);
        }}
        className={`w-full text-center py-1.5 px-2 text-sm font-medium rounded-md cursor-pointer ${
          isEditing
            ? "bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-gray-800 dark:text-gray-200"
            : getTimeColor(value as number)
        }`}
      >
        {isEditing ? (
          <input
            type="number"
            value={tempValue as number}
            onChange={(e) => setTempValue(Number(e.target.value))}
            onKeyDown={handleKeyDown}
            onBlur={() => {
              if (isModalOpen) return;
              handleValueChange(Number(tempValue));
              setIsEditing(false);
            }}
            className="w-full h-6 text-center focus:outline-none focus:ring-1 focus:ring-gray-400 dark:focus:ring-gray-500 bg-transparent"
            autoFocus
          />
        ) : (
          <div className="h-6 flex items-center justify-center">
            {value} min
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-800 overflow-hidden bg-white dark:bg-gray-900 p-3 transition-colors hover:border-gray-300 dark:hover:border-gray-700">
      <div className="flex justify-between items-center mb-2">
        <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
          {label}
        </label>
        <div className="flex justify-end">{renderHistoryOrLoading()}</div>
      </div>

      {type === "binary" ? (
        <button
          onClick={() => {
            if (isModalOpen) return;
            handleValueChange(!value);
          }}
          className={`w-full py-1.5 px-3 rounded-md text-sm font-medium transition-colors ${
            value
              ? "bg-gray-900 dark:bg-white text-white dark:text-gray-900 hover:bg-gray-800 dark:hover:bg-gray-200"
              : "bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
          }`}
        >
          {value ? "Yes" : "No"}
        </button>
      ) : type === "water" ? (
        renderWaterOptions()
      ) : type === "scale" ? (
        renderScale()
      ) : (
        renderNumber()
      )}
    </div>
  );
};

export default SignalCard;
