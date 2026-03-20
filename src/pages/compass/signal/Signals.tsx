import React, { useEffect, useState } from "react";
import SignalCard from "./SignalCard";
import { api } from "../../../utils/api";
import { useAuth } from "../../../context/AuthContext";
import { AVAILABLE_SIGNALS, getAllSignals, SignalConfig } from "../../../pages/settings/components/SignalSettings";
import { SignalHistory, AllSignalsHistory } from "../../../types/Signal";
import { useSignals } from "../../../context/SignalsContext";
import { Flame } from "lucide-react";
import { useTimezone } from "../../../context/TimezoneContext";
import { MorningEntry } from "../../../types/Morning";

// Define units for different signals
const SIGNAL_UNITS: Record<string, string> = {
  waterIntake: "ml",
  minutesToOffice: "min",
};

// Display labels for signals (override the default label from AVAILABLE_SIGNALS)
const SIGNAL_DISPLAY_LABELS: Record<string, string> = {
  minutesToOffice: "Minutes",
};

// Helper function to check if a morning entry has journaling content
const hasJournalingContent = (entry: MorningEntry | undefined): boolean => {
  if (!entry) return false;

  // Check for new activityContent format
  if (entry.activityContent) {
    const { writing, gratitude, affirmations } = entry.activityContent;
    if (
      (writing && writing.trim().length > 0) ||
      (gratitude && gratitude.trim().length > 0) ||
      (affirmations && affirmations.trim().length > 0)
    ) {
      return true;
    }
  }

  // Check for legacy content format
  if (entry.content && entry.content.trim().length > 0) {
    return true;
  }

  return false;
};

interface SignalsProps {
  isModalOpen?: boolean;
}

const Signals: React.FC<SignalsProps> = ({ isModalOpen = false }) => {
  const { user } = useAuth();
  const { timezone } = useTimezone();
  // Use the Signals context instead of local state
  const { signals, updateSignal, refreshSignals, signalStreak, signalStreakDanger } = useSignals();

  const [signalHistory, setSignalHistory] = useState<AllSignalsHistory>({});
  const [isHistoryLoading, setIsHistoryLoading] = useState(true);

  // State for journaling signal (derived from morning entries)
  // Initialize from localStorage to avoid loading flash
  const [journalingValue, setJournalingValue] = useState<boolean>(() => {
    const cached = localStorage.getItem("journalingValue");
    return cached === "true";
  });
  const [journalingHistory, setJournalingHistory] = useState<SignalHistory[]>(
    () => {
      const cached = localStorage.getItem("journalingHistory");
      if (cached) {
        try {
          return JSON.parse(cached);
        } catch {
          return [];
        }
      }
      return [];
    }
  );

  // Function to get today's date in YYYY-MM-DD format in user's timezone
  const getTodayInUserTimezone = () => {
    try {
      const date = new Intl.DateTimeFormat("en-US", {
        timeZone: timezone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).formatToParts(new Date());

      const month = date.find((part) => part.type === "month")?.value || "01";
      const day = date.find((part) => part.type === "day")?.value || "01";
      const year = date.find((part) => part.type === "year")?.value || "2023";

      return `${year}-${month}-${day}`;
    } catch (error) {
      console.error("Error formatting date with timezone:", error);
      return new Date().toISOString().split("T")[0];
    }
  };

  // Get today's date in YYYY-MM-DD format
  const today = getTodayInUserTimezone();

  // Initial load of signal history and morning entries
  useEffect(() => {
    loadSignalHistory();
    loadMorningEntries();
  }, [user]);

  // Load morning entries for journaling signal
  const loadMorningEntries = async () => {
    if (!user) return;

    try {
      const data = await api.getAllEntries();

      // Check today's journaling status
      const todayEntry = data.entries?.find(
        (entry: MorningEntry) => entry.date === today
      );
      const newJournalingValue = hasJournalingContent(todayEntry);

      // Build journaling history for the past 7 days
      const last7Days = Array.from({ length: 7 }, (_, i) => {
        const date = new Date();
        date.setDate(date.getDate() - 6 + i);
        return date.toISOString().split("T")[0];
      });

      const journalingHistoryData: SignalHistory[] = last7Days.map((date) => {
        const entry = data.entries?.find((e: MorningEntry) => e.date === date);
        return {
          date,
          value: hasJournalingContent(entry),
        };
      });

      // Update state and localStorage if data changed
      const cachedValue = localStorage.getItem("journalingValue") === "true";
      const cachedHistory = localStorage.getItem("journalingHistory");
      const newHistoryJson = JSON.stringify(journalingHistoryData);

      if (newJournalingValue !== cachedValue) {
        setJournalingValue(newJournalingValue);
        localStorage.setItem("journalingValue", String(newJournalingValue));
      }

      if (cachedHistory !== newHistoryJson) {
        setJournalingHistory(journalingHistoryData);
        localStorage.setItem("journalingHistory", newHistoryJson);
      }
    } catch (error) {
      console.error("Failed to load morning entries for journaling:", error);
    }
  };

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
    <div className="rounded-lg border border-gray-200 dark:border-gray-800 overflow-hidden">
      <div className="border-b border-gray-200 dark:border-gray-800 px-5 py-3 flex items-center gap-2.5">
        <h2 className="text-sm font-medium text-gray-900 dark:text-white">
          Signals
        </h2>
        {(signalStreak > 0 || signalStreakDanger) && (
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
            signalStreakDanger
              ? "bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400"
              : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400"
          }`}>
            <Flame className="w-3 h-3" />
            {signalStreak} day{signalStreak !== 1 ? "s" : ""}
          </span>
        )}
      </div>
      <div className="p-5">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Object.entries(allSignals)
            .filter(([key]) => activeSignals.includes(key))
            .map(([key, config]) => {
              // Special handling for journaling signal - use morning entries data
              if (key === "journaling") {
                return (
                  <SignalCard
                    key={key}
                    metric={key}
                    label={SIGNAL_DISPLAY_LABELS[key] || config.label}
                    format=""
                    value={journalingValue}
                    unit=""
                    type={config.type}
                    status={"active"}
                    timestamp={new Date()}
                    onChange={() => {}} // Read-only - journaling is determined by Morning page
                    goalValue={undefined}
                    history={journalingHistory}
                    isHistoryLoading={false} // Always false - we use localStorage cache to avoid loading flash
                    isModalOpen={isModalOpen}
                    isReadOnly={true}
                  />
                );
              }

              // Special handling for focusHours signal - read-only, computed from sessions
              if (key === "focusHours") {
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
                    onChange={() => {}} // Read-only - focusHours is determined by sessions
                    goalValue={undefined}
                    history={signalHistory[key] || []}
                    isHistoryLoading={isHistoryLoading}
                    isModalOpen={isModalOpen}
                    isReadOnly={true}
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
                />
              );
            })}
        </div>
      </div>
    </div>
  );
};

export default Signals;
