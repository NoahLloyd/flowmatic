import React, { useEffect, useState } from "react";
import SignalCard from "./SignalCard";
import { api } from "../../../utils/api";
import { useAuth } from "../../../context/AuthContext";
import { getAllSignals, SignalConfig } from "../../../pages/settings/components/SignalSettings";
import { AllSignalsHistory } from "../../../types/Signal";
import { useSignals } from "../../../context/SignalsContext";

import { useTimezone } from "../../../context/TimezoneContext";
import { getAppDayKey } from "../../../utils/appDay";

// Define units for different signals
const SIGNAL_UNITS: Record<string, string> = {
  waterIntake: "ml",
  minutesToOffice: "min",
};

// Display labels for signals (override the default label from AVAILABLE_SIGNALS)
const SIGNAL_DISPLAY_LABELS: Record<string, string> = {
  minutesToOffice: "Minutes",
};

interface SignalsProps {
  isModalOpen?: boolean;
}

const Signals: React.FC<SignalsProps> = ({ isModalOpen = false }) => {
  const { user } = useAuth();
  const { timezone } = useTimezone();
  // Use the Signals context instead of local state
  const { signals, updateSignal, signalScore, signalStreak, signalStreakDanger, totalSignals } = useSignals();

  const [signalHistory, setSignalHistory] = useState<AllSignalsHistory>({});
  const [isHistoryLoading, setIsHistoryLoading] = useState(true);

  // Function to get today's date in YYYY-MM-DD format in user's timezone
  const getTodayInUserTimezone = () => {
    return getAppDayKey(new Date(), timezone);
  };

  // Initial load of signal history. Journaling now comes from the persisted
  // signal row, like the other computed signals, rather than text presence.
  useEffect(() => {
    loadSignalHistory();
  }, [user, timezone]);

  // Refresh signal data when day changes (e.g. app left open overnight)
  useEffect(() => {
    let lastCheckedDay = getTodayInUserTimezone();

    const checkDayChange = () => {
      const currentDay = getTodayInUserTimezone();
      if (currentDay !== lastCheckedDay) {
        lastCheckedDay = currentDay;
        loadSignalHistory();
      }
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") checkDayChange();
    };
    const onFocus = () => checkDayChange();

    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("focus", onFocus);

    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("focus", onFocus);
    };
  }, [user, timezone]);

  const loadSignalHistory = async () => {
    if (!user) return;

    setIsHistoryLoading(true);
    try {
      // Get dates for the last week (7 days)
      const dates: string[] = [];
      const appDay = new Date(`${getTodayInUserTimezone()}T12:00:00Z`);
      for (let i = 6; i >= 0; i--) {
        const d = new Date(appDay);
        d.setUTCDate(d.getUTCDate() - i);
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

  // Get all signals (built-in + custom)
  const allSignals = getAllSignals(
    user?.preferences?.customSignals as Record<string, SignalConfig> | undefined
  );

  // Get active signals from user preferences or use defaults
  const getActiveSignals = (): string[] => {
    if (
      user?.preferences?.activeSignals &&
      user.preferences.activeSignals.length > 0
    ) {
      return user.preferences.activeSignals as string[];
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
    <div className="rounded-lg border border-gray-200 dark:border-gray-800">
      <div className="card-header rounded-t-lg border-b border-gray-200 dark:border-gray-800 px-5 py-3 flex items-center gap-2.5">
        <h2 className="text-sm font-medium text-gray-900 dark:text-white">
          Signals
        </h2>
        {(signalStreak > 0 || signalStreakDanger || totalSignals > 0) && (() => {
          const goalMet = signalScore >= (user?.preferences?.signalPercentageGoal || 75);
          const pillClass = signalStreakDanger
            ? "bg-red-500/10 dark:bg-red-500/10 text-red-500 dark:text-red-400 hover:bg-red-500/20"
            : goalMet
              ? "bg-emerald-500/10 dark:bg-emerald-500/10 text-emerald-500 dark:text-emerald-400 hover:bg-emerald-500/20"
              : "bg-orange-500/10 dark:bg-orange-500/10 text-orange-500 dark:text-orange-400 hover:bg-orange-500/20";
          return (
            <span
              onClick={() => window.dispatchEvent(new CustomEvent("openStreakScreen"))}
              className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold cursor-pointer transition-colors ${pillClass}`}
              title="Open signal streak"
            >
              <span className="tabular-nums">{signalStreak}</span>
            </span>
          );
        })()}
      </div>
      <div className="p-5">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {activeSignals
            .filter((key) => allSignals[key])
            .map((key) => {
              const config = allSignals[key];
              // Computed signals are persisted by their source workflows and
              // remain read-only here.
              if (key === "journaling" || key === "focusHours") {
                return (
                  <SignalCard
                    key={key}
                    metric={key}
                    label={SIGNAL_DISPLAY_LABELS[key] || config.label}
                    format=""
                    value={signals[key] ?? false}
                    unit=""
                    type={config.type}
                    status={"active"}
                    timestamp={new Date()}
                    onChange={() => undefined}
                    goalValue={undefined}
                    history={signalHistory[key] || []}
                    isHistoryLoading={isHistoryLoading}
                    isModalOpen={isModalOpen}
                    isReadOnly={true}
                    requirement={user?.preferences?.signalRequirements?.[key]}
                  />
                );
              }

              // Regular signal handling
              return (
                <SignalCard
                  key={key}
                  metric={key}
                  label={SIGNAL_DISPLAY_LABELS[key] || config.label}
                  format="" // Add empty string as format is required but not used
                  value={signals[key] ?? (config.type === "binary" ? false : 0)}
                  unit={SIGNAL_UNITS[key] || (config as SignalConfig).unit || ""}
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
                  requirement={user?.preferences?.signalRequirements?.[key]}
                />
              );
            })}
        </div>
      </div>
    </div>
  );
};

export default Signals;
