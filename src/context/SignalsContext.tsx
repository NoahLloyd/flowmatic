import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import { api } from "../utils/api";
import { useAuth } from "./AuthContext";
import { useTimezone } from "./TimezoneContext";
import { AVAILABLE_SIGNALS as ImportedAvailableSignals } from "../pages/settings/components/SignalSettings";

// Declare global interface for TypeScript
declare global {
  interface Window {
    AVAILABLE_SIGNALS: typeof ImportedAvailableSignals;
  }
}

// Define the shape of our SignalsContext
interface SignalsContextType {
  signals: Record<string, number | boolean>;
  signalScore: number;
  totalSignals: number;
  completedSignals: number;
  updateSignal: (metric: string, value: number | boolean) => Promise<void>;
  refreshSignals: () => Promise<void>;
}

// Create the context with a default value
const SignalsContext = createContext<SignalsContextType>({
  signals: {},
  signalScore: 0,
  totalSignals: 0,
  completedSignals: 0,
  updateSignal: async () => {},
  refreshSignals: async () => {},
});

// Helper function to get the current signals configuration
const getAvailableSignals = () => {
  // Prefer the global instance if it exists (for consistency across components)
  return window.AVAILABLE_SIGNALS || ImportedAvailableSignals;
};

// Provider component to wrap application
export const SignalsProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const { user } = useAuth();
  const { timezone, formatDate } = useTimezone();
  const [signals, setSignals] = useState<Record<string, number | boolean>>({});
  const [signalScore, setSignalScore] = useState(0);
  const [totalSignals, setTotalSignals] = useState(0);
  const [completedSignals, setCompletedSignals] = useState(0);

  // Function to get today's date in YYYY-MM-DD format in user's timezone
  const getTodayInUserTimezone = () => {
    const now = new Date();
    try {
      // Create a date for "today" in the user's timezone
      const todayInUserTZ = new Date(
        now.toLocaleString("en-US", { timeZone: timezone })
      );
      return todayInUserTZ.toISOString().split("T")[0];
    } catch (error) {
      console.error("Error formatting date with timezone:", error);
      // Fallback to UTC
      return now.toISOString().split("T")[0];
    }
  };

  // Function to get date n days ago in YYYY-MM-DD format in user's timezone
  const getDateDaysAgo = (daysAgo: number) => {
    const now = new Date();
    try {
      // Create a date in the user's timezone
      const dateInUserTZ = new Date(
        now.toLocaleString("en-US", { timeZone: timezone })
      );
      // Go back n days
      dateInUserTZ.setDate(dateInUserTZ.getDate() - daysAgo);
      return dateInUserTZ.toISOString().split("T")[0];
    } catch (error) {
      console.error(
        `Error formatting date ${daysAgo} days ago with timezone:`,
        error
      );
      // Fallback to UTC
      const date = new Date();
      date.setDate(date.getDate() - daysAgo);
      return date.toISOString().split("T")[0];
    }
  };

  // Function to refresh signals and recalculate scores
  const refreshSignals = async () => {
    if (!user) return;

    try {
      // Get dates in user's timezone
      const today = getTodayInUserTimezone();
      const yesterdayStr = getDateDaysAgo(1);
      const dayBeforeYesterdayStr = getDateDaysAgo(2);

      // Fetch today's signals
      const todaySignals = await api.getDailySignals(today);
      setSignals(todaySignals);

      // Get signal history for the past 3 days for shower
      let showerHistory: any[] = [];
      try {
        // Fetch all signal history for the past 3 days
        const historyData = await api.getAllSignalHistory(
          dayBeforeYesterdayStr,
          today
        );
        if (Array.isArray(historyData)) {
          // Filter for shower history only
          showerHistory = historyData.filter(
            (item) => item.metric === "shower"
          );
        }
      } catch (error) {
        console.error("Failed to fetch shower history:", error);
      }

      // Get active signals from user preferences
      const activeSignals = user?.preferences?.activeSignals || [];

      // Get signal goals from user preferences
      const signalGoals = user?.preferences?.signalGoals || {};

      // Track total active signals and their scores
      let totalActiveSignals = 0;
      let totalCompletedSignals = 0;
      let totalScore = 0;

      // Track if user has showered in the past 3 days
      let hasShoweredIn3Days = false;

      // Check if user has showered in the past 3 days
      // First check today's shower status
      const todayShowerValue = todaySignals.shower;

      // Check all possible truthy values for shower
      if (
        todayShowerValue === true ||
        todayShowerValue === "true" ||
        todayShowerValue === 1 ||
        todayShowerValue === "1"
      ) {
        hasShoweredIn3Days = true;
      } else {
        // Check shower history for yesterday and day before
        // Look for any truthy value in the history
        hasShoweredIn3Days = showerHistory.some((item) => {
          const itemDate = item.date;
          const itemValue = item.value;

          // Check if date is in the last 3 days
          const isRecentDate =
            itemDate === today ||
            itemDate === yesterdayStr ||
            itemDate === dayBeforeYesterdayStr;

          // Check if value is truthy in any format
          const isTruthyValue =
            itemValue === true ||
            itemValue === "true" ||
            itemValue === 1 ||
            itemValue === "1";

          return isRecentDate && isTruthyValue;
        });
      }

      // For debugging
      const signalScores: Record<string, number> = {};
      const completionTracker: Record<string, number> = {}; // Track individual signal completion

      // Get the current signals configuration
      const availableSignals = getAvailableSignals();

      // Loop through all available signals
      Object.entries(availableSignals).forEach(([key, config]) => {
        // Only count signals that are active
        if (!activeSignals.includes(key)) return;

        // Skip shower as it's handled specially
        if (key === "shower") return;

        totalActiveSignals++;
        const value = todaySignals[key];

        // Calculate completion score for this signal (0-100%)
        let completionScore = 0;
        let completionValue = 0; // How much this contributes to the completion count

        // Different calculation based on signal type
        if (config.type === "binary") {
          // Binary signals: 100% if true, 0% if false
          // Ensure we're checking for any truthy representation of true
          if (value === true || value === "true" || value === 1) {
            completionScore = 100;
            completionValue = 1;
            // Count as completed if 100%
            totalCompletedSignals++;
          } else {
            // Explicitly set to 0 for false values
            completionScore = 0;
            completionValue = 0;
          }
        } else if (config.type === "scale") {
          // Scale signals (1-5): Convert to percentage
          if (typeof value === "number") {
            completionScore = (value / 5) * 100;

            // Determine completion value for display
            if (completionScore >= 80) {
              completionValue = 1;
              totalCompletedSignals++;
            } else if (completionScore >= 60) {
              completionValue = 0.75;
              // Do not increment totalCompletedSignals for partial completion
            } else if (completionScore >= 40) {
              completionValue = 0.5;
            } else if (completionScore >= 20) {
              completionValue = 0.25;
            } else {
              completionValue = 0;
            }
          }
        } else if (config.type === "number" || config.type === "water") {
          // Handle number signals with goals
          if (config.hasGoal && key in signalGoals) {
            const goal = signalGoals[key];

            if (typeof value === "number") {
              // For "Minutes to Office" - lower is better
              if (key === "minutesToOffice") {
                if (value <= goal) {
                  completionScore = 100;
                  completionValue = 1;
                  totalCompletedSignals++;
                } else {
                  // Partial credit: How close to the goal are we?
                  completionScore = Math.max(
                    0,
                    100 - ((value - goal) / goal) * 100
                  );

                  // Determine completion value for display
                  if (completionScore >= 80) {
                    completionValue = 1;
                    totalCompletedSignals++;
                  } else if (completionScore >= 60) {
                    completionValue = 0.75;
                  } else if (completionScore >= 40) {
                    completionValue = 0.5;
                  } else if (completionScore >= 20) {
                    completionValue = 0.25;
                  } else {
                    completionValue = 0;
                  }
                }
              }
              // For other number metrics - higher is better
              else {
                if (value >= goal) {
                  completionScore = 100;
                  completionValue = 1;
                  totalCompletedSignals++;
                } else {
                  // Partial credit: Calculate percentage of goal achieved
                  completionScore = (value / goal) * 100;

                  // Determine completion value for display
                  if (completionScore >= 80) {
                    completionValue = 1;
                    totalCompletedSignals++;
                  } else if (completionScore >= 60) {
                    completionValue = 0.75;
                  } else if (completionScore >= 40) {
                    completionValue = 0.5;
                  } else if (completionScore >= 20) {
                    completionValue = 0.25;
                  } else {
                    completionValue = 0;
                  }
                }
              }
            }
          } else {
            // Number signals without goals - can't calculate without reference point
            completionScore = 0;
            completionValue = 0;
          }
        }

        // Store individual signal scores and completion values for debugging
        signalScores[key] = completionScore;
        completionTracker[key] = completionValue;

        // Add this signal's score to the total
        totalScore += completionScore;
      });

      // Special handling for shower signal
      // If shower is active, include it in total count
      if (activeSignals.includes("shower")) {
        totalActiveSignals++;

        if (hasShoweredIn3Days) {
          // If they have showered in past 3 days, count as 100%
          signalScores["shower"] = 100;
          completionTracker["shower"] = 1;
          totalScore += 100;
          totalCompletedSignals++;
        } else {
          // If they haven't showered in 3 days, count as 0%
          signalScores["shower"] = 0;
          completionTracker["shower"] = 0;
          // No penalty, just count as 0%
        }
      }

      // Double-check our totals by summing the completion tracker
      const sumOfCompletions = Object.values(completionTracker).reduce(
        (sum, value) => sum + (value >= 1 ? 1 : 0),
        0
      );

      // Count signals that are at or above 80% as completed
      const displayCompletedSignals = Object.values(signalScores).filter(
        (score) => score >= 80
      ).length;

      // Calculate average score (0-100)
      let averageScore;

      // Force 100% when all signals are completed
      if (
        displayCompletedSignals === totalActiveSignals &&
        totalActiveSignals > 0
      ) {
        averageScore = 100;
      } else {
        // Otherwise calculate average normally
        averageScore =
          totalActiveSignals > 0
            ? Math.round(totalScore / totalActiveSignals)
            : 0;
      }

      // Ensure the score is between 0 and 100
      averageScore = Math.max(0, Math.min(100, averageScore));

      setSignalScore(averageScore);
      setTotalSignals(totalActiveSignals);
      setCompletedSignals(displayCompletedSignals);
    } catch (error) {
      console.error("Failed to fetch signals data:", error);
    }
  };

  // Function to update a signal
  const updateSignal = async (metric: string, value: number | boolean) => {
    try {
      const today = getTodayInUserTimezone();

      // Update the signal immediately in the local state first
      setSignals((prev) => ({
        ...prev,
        [metric]: value,
      }));

      // Call the API to update the signal
      await api.recordSignal(today, metric, value);

      // Recalculate scores
      await refreshSignals();

      // Dispatch event to notify other components
      const event = new CustomEvent("signalUpdated");
      window.dispatchEvent(event);
    } catch (error) {
      console.error("Failed to update signal:", error);
    }
  };

  // Initial fetch of signal data
  useEffect(() => {
    // Skip if no user is logged in
    if (!user) return;

    // Initial load - give a small delay to ensure window.AVAILABLE_SIGNALS is set
    setTimeout(() => {
      refreshSignals();
    }, 100);

    // Set up interval to refresh the data every 5 minutes
    const interval = setInterval(refreshSignals, 5 * 60 * 1000);

    // Set up an event listener for signal updates from elsewhere in the app
    const handleSignalUpdate = () => {
      console.log("Signal update detected, refreshing signals data");
      refreshSignals();
    };

    // Listen for custom event that will be triggered when signals are updated anywhere
    window.addEventListener("signalUpdated", handleSignalUpdate);

    return () => {
      clearInterval(interval);
      window.removeEventListener("signalUpdated", handleSignalUpdate);
    };
  }, [user]);

  // Re-fetch signals when timezone changes
  useEffect(() => {
    if (user) {
      refreshSignals();
    }
  }, [timezone, user]);

  // Provide the context to children
  return (
    <SignalsContext.Provider
      value={{
        signals,
        signalScore,
        totalSignals,
        completedSignals,
        updateSignal,
        refreshSignals,
      }}
    >
      {children}
    </SignalsContext.Provider>
  );
};

// Custom hook to use the signals context
export const useSignals = () => useContext(SignalsContext);

export default SignalsContext;
