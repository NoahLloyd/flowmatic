import React, { useEffect, useState } from "react";
import SignalCard from "./SignalCard";
import { api } from "../../../utils/api";
import { useAuth } from "../../../context/AuthContext";
import { AVAILABLE_SIGNALS } from "../../../pages/settings/components/SignalSettings";
import { SignalHistory, AllSignalsHistory } from "../../../types/Signal";

type SignalKey = keyof typeof AVAILABLE_SIGNALS;

// Define unit mapping for different signal types
const SIGNAL_UNITS: Record<string, string> = {
  minutesToOffice: "min",
  waterIntake: "ml",
  sleep: "hours",
  steps: "steps",
};

const Signals: React.FC = () => {
  const { user } = useAuth();
  const [signals, setSignals] = useState<Record<string, number | boolean>>({});
  const [signalHistory, setSignalHistory] = useState<AllSignalsHistory>({});
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const today = new Date().toISOString().split("T")[0];

  useEffect(() => {
    loadDailySignals();
    loadSignalHistory();
  }, []);

  const loadDailySignals = async () => {
    try {
      const data = await api.getDailySignals(today);
      setSignals(data);
    } catch (error) {
      console.error("Failed to load signals:", error);
    }
  };

  const loadSignalHistory = async () => {
    try {
      setIsHistoryLoading(true);

      // Calculate date range for the past 7 days
      const endDate = today;
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 6); // 7 days including today
      const startDateStr = startDate.toISOString().split("T")[0];

      console.log(`Fetching signal history from ${startDateStr} to ${endDate}`);

      // Call the API to get all signal history in one call
      const historyDataArray = await api.getAllSignalHistory(
        startDateStr,
        endDate
      );

      // Debug log to see the actual response structure
      console.log("API Response - All Signal History:", historyDataArray);

      // Transform the array of records into an object grouped by metric
      const transformedHistory: AllSignalsHistory = {};

      // Check if the response is an array
      if (Array.isArray(historyDataArray)) {
        historyDataArray.forEach((record) => {
          if (record.metric && record.date && record.value !== undefined) {
            // Initialize the array for this metric if it doesn't exist
            if (!transformedHistory[record.metric]) {
              transformedHistory[record.metric] = [];
            }

            // Add this record to the appropriate metric array
            transformedHistory[record.metric].push({
              date: record.date,
              value: record.value,
            });
          }
        });
      }

      console.log("Transformed history data:", transformedHistory);
      console.log("Transformed history keys:", Object.keys(transformedHistory));

      // Sample the transformed data
      const sampleKey = Object.keys(transformedHistory)[0];
      if (sampleKey) {
        console.log(
          `Sample ${sampleKey} history:`,
          transformedHistory[sampleKey]
        );
      }

      setSignalHistory(transformedHistory);
    } catch (error) {
      console.error("Failed to load signal history:", error);
    } finally {
      setIsHistoryLoading(false);
    }
  };

  const handleSignalChange = async (
    metric: string,
    value: number | boolean
  ) => {
    try {
      await api.recordSignal(today, metric, value);
      setSignals((prev) => ({ ...prev, [metric]: value }));

      // Refresh history after a small delay to allow backend to update
      setTimeout(() => {
        loadSignalHistory();
      }, 500);
    } catch (error) {
      console.error("Failed to update signal:", error);
    }
  };

  // Get active signals from user preferences or use defaults
  const getActiveSignals = (): SignalKey[] => {
    if (
      user?.preferences?.activeSignals &&
      user.preferences.activeSignals.length > 0
    ) {
      return user.preferences.activeSignals as SignalKey[];
    }

    // Default active signals
    return [
      "minutesToOffice",
      "waterIntake",
      "energy",
      "mood",
      "exercise",
      "breakfast",
      "lunch",
      "shower",
    ];
  };

  // Get signal goals from user preferences
  const getGoalForSignal = (signalKey: string): number | undefined => {
    if (
      user?.preferences?.signalGoals &&
      user.preferences.signalGoals[signalKey]
    ) {
      return user.preferences.signalGoals[signalKey];
    }
    return undefined;
  };

  const activeSignals = getActiveSignals();

  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-800 overflow-hidden mb-6">
      <div className="border-b border-gray-200 dark:border-gray-800 px-5 py-3 flex items-center">
        <h2 className="text-sm font-medium text-gray-900 dark:text-white">
          Daily Signals
        </h2>
      </div>
      <div className="p-5">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Object.entries(AVAILABLE_SIGNALS)
            .filter(([key]) => activeSignals.includes(key as SignalKey))
            .map(([key, config]) => (
              <SignalCard
                key={key}
                metric={key}
                label={config.label}
                format="" // Add empty string as format is required but not used
                value={signals[key] ?? (config.type === "binary" ? false : 0)}
                unit={SIGNAL_UNITS[key] || ""} // Add unit based on signal type
                type={config.type}
                status={"active"} // Default to active status
                timestamp={new Date()} // Use current date as default
                onChange={(value: number | boolean) =>
                  handleSignalChange(key, value)
                }
                goalValue={getGoalForSignal(key)}
                history={signalHistory[key] || []}
                isHistoryLoading={isHistoryLoading}
              />
            ))}
        </div>
      </div>
    </div>
  );
};

export default Signals;
