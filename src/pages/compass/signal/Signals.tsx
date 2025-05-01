import React, { useEffect, useState } from "react";
import SignalCard from "./SignalCard";
import { api } from "../../../utils/api";
import { useAuth } from "../../../context/AuthContext";
import { AVAILABLE_SIGNALS } from "../../../pages/settings/components/SignalSettings";
import { SignalHistory, AllSignalsHistory } from "../../../types/Signal";
import { useSignals } from "../../../context/SignalsContext";

type SignalKey = keyof typeof AVAILABLE_SIGNALS;

// Define units for different signals
const SIGNAL_UNITS: Record<string, string> = {
  waterIntake: "ml",
  minutesToOffice: "min",
};

interface SignalsProps {
  isModalOpen?: boolean;
}

const Signals: React.FC<SignalsProps> = ({ isModalOpen = false }) => {
  const { user } = useAuth();
  // Use the Signals context instead of local state
  const { signals, updateSignal, refreshSignals } = useSignals();

  const [signalHistory, setSignalHistory] = useState<AllSignalsHistory>({});
  const [isHistoryLoading, setIsHistoryLoading] = useState(true);

  // Get today's date in YYYY-MM-DD format
  const today = new Date().toISOString().split("T")[0];

  // Initial load of signal history
  useEffect(() => {
    loadSignalHistory();
  }, [user]);

  const loadSignalHistory = async () => {
    if (!user) return;

    setIsHistoryLoading(true);
    try {
      // Get dates for the last week (7 days)
      const dates = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        dates.push(d.toISOString().split("T")[0]);
      }

      // Get the starting date (7 days ago)
      const startDate = dates[0];
      // Get ending date (today)
      const endDate = dates[dates.length - 1];

      console.log(`Loading signal history from ${startDate} to ${endDate}`);

      // Fetch all signal history for the week
      const historyData = await api.getAllSignalHistory(startDate, endDate);

      console.log("Received signal history:", historyData);

      // Process the history data into a more usable format
      // Group by metric (signal type)
      const groupedHistory: AllSignalsHistory = {};

      if (Array.isArray(historyData)) {
        historyData.forEach((item) => {
          const metric = item.metric;

          if (!groupedHistory[metric]) {
            groupedHistory[metric] = [];
          }

          groupedHistory[metric].push({
            date: item.date,
            value: item.value,
          });
        });
      }

      setSignalHistory(groupedHistory);
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
      // Use the updateSignal function from the context
      await updateSignal(metric, value);

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
          Signals
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
                isModalOpen={isModalOpen}
              />
            ))}
        </div>
      </div>
    </div>
  );
};

export default Signals;
