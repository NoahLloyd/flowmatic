import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from "react";
import { api } from "../utils/api";
import { useAuth } from "./AuthContext";
import { useTimezone } from "./TimezoneContext";
import { AVAILABLE_SIGNALS as ImportedAvailableSignals, getAllSignals, SignalConfig } from "../pages/settings/components/SignalSettings";
import { MorningEntry } from "../types/Morning";
import { Session } from "../types/Session";

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

// Helper function to get the current signals configuration (including custom signals)
const getAvailableSignals = (user: any) => {
  const customSignals = user?.preferences?.customSignals as Record<string, SignalConfig> | undefined;
  return getAllSignals(customSignals);
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
    try {
      // Use Intl.DateTimeFormat to get the date parts in the user's timezone
      const date = new Intl.DateTimeFormat("en-US", {
        timeZone: timezone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).formatToParts(new Date());

      // Extract and format as YYYY-MM-DD
      const month = date.find((part) => part.type === "month")?.value || "01";
      const day = date.find((part) => part.type === "day")?.value || "01";
      const year = date.find((part) => part.type === "year")?.value || "2023";

      return `${year}-${month}-${day}`;
    } catch (error) {
      console.error("Error formatting date with timezone:", error);
      // Fallback to UTC
      return new Date().toISOString().split("T")[0];
    }
  };

  // Function to get date n days ago in YYYY-MM-DD format in user's timezone
  const getDateDaysAgo = (daysAgo: number) => {
    try {
      // Get current date in user's timezone
      const now = new Date();

      // Create a date object for n days ago in UTC
      const pastDate = new Date(now);
      pastDate.setDate(pastDate.getDate() - daysAgo);

      // Format the date in user's timezone
      const date = new Intl.DateTimeFormat("en-US", {
        timeZone: timezone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).formatToParts(pastDate);

      // Extract and format as YYYY-MM-DD
      const month = date.find((part) => part.type === "month")?.value || "01";
      const day = date.find((part) => part.type === "day")?.value || "01";
      const year = date.find((part) => part.type === "year")?.value || "2023";

      return `${year}-${month}-${day}`;
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

  // Helper function to get the daily focus goal from user preferences
  const getDailyGoal = useCallback(
    (date: Date = new Date()) => {
      // Get the day of week in user's timezone
      const day = new Date(
        date.toLocaleString("en-US", { timeZone: timezone })
      ).getDay();

      // Convert to our day format (monday, tuesday, etc.)
      const dayNames = [
        "sunday",
        "monday",
        "tuesday",
        "wednesday",
        "thursday",
        "friday",
        "saturday",
      ];
      const dayName = dayNames[day];

      // Check if user has preferences set
      if (
        user?.preferences?.dailyHoursGoals &&
        dayName in user.preferences.dailyHoursGoals
      ) {
        return user.preferences.dailyHoursGoals[dayName];
      }
      return 4; // Default if not set
    },
    [user, timezone]
  );

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

      // Fetch today's morning entry for journaling signal (only today, not all entries)
      let journalingValue = false;
      try {
        const todayEntryData = await api.getEntry(today);
        // getEntry returns { date, ...fields } or the entry object directly
        const todayEntry = todayEntryData as MorningEntry | null;
        journalingValue = hasJournalingContent(todayEntry);
      } catch (error) {
        console.error(
          "Failed to fetch morning entry for journaling signal:",
          error
        );
      }

      // Fetch sessions near today and compute focusHours signal
      // Use ±1 day UTC padding to account for timezone differences
      let focusHoursValue = false;
      let hoursToday = 0;
      try {
        const todayDate = new Date(today + "T12:00:00Z");
        const startUTC = new Date(todayDate);
        startUTC.setUTCDate(startUTC.getUTCDate() - 1);
        const endUTC = new Date(todayDate);
        endUTC.setUTCDate(endUTC.getUTCDate() + 1);
        const startISO = startUTC.toISOString();
        const endISO = endUTC.toISOString();

        const sessions = (await api.getSessionsByDateRange(startISO, endISO)) as Session[];

        // Filter sessions for today (using timezone-aware filtering)
        const todaySessions = sessions.filter((session) => {
          try {
            // Convert the session date to the user's timezone
            const rawDate = new Date(session.created_at);

            // Create a date string in the user's timezone format
            const sessionDateStr = rawDate.toLocaleString("en-US", {
              timeZone: timezone,
              year: "numeric",
              month: "2-digit",
              day: "2-digit",
            });

            // Create today's date string in the same format
            const now = new Date();
            const todayDateStr = now.toLocaleString("en-US", {
              timeZone: timezone,
              year: "numeric",
              month: "2-digit",
              day: "2-digit",
            });

            // Compare the date strings directly
            return sessionDateStr === todayDateStr;
          } catch (error) {
            console.error("Error filtering session date:", error);
            return false;
          }
        });

        // Calculate hours using same reducer logic as elsewhere
        hoursToday = todaySessions.reduce(
          (acc, session) => acc + session.minutes / 60,
          0
        );

        // Get the daily goal for today
        const dailyGoal = getDailyGoal();

        // Focus hours signal is complete if we've met or exceeded the goal
        focusHoursValue = hoursToday >= dailyGoal;

        console.log(
          `[SignalsContext] Focus Hours: ${hoursToday.toFixed(
            1
          )}h / ${dailyGoal}h goal = ${
            focusHoursValue ? "COMPLETE" : "incomplete"
          }`
        );
      } catch (error) {
        console.error("Failed to fetch sessions for focusHours signal:", error);
      }

      // Add computed signals (journaling and focusHours) to signals (overriding any manual values)
      const signalsWithComputed: Record<string, number | boolean> = {
        ...todaySignals,
        journaling: journalingValue,
        focusHours: focusHoursValue,
      };

      setSignals(signalsWithComputed);

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
      const todayShowerValue = signalsWithComputed.shower;

      // Check all possible truthy values for shower
      // Cast to unknown first to handle potential string values from API
      const showerVal = todayShowerValue as unknown;
      if (
        showerVal === true ||
        showerVal === "true" ||
        showerVal === 1 ||
        showerVal === "1"
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
      const availableSignals = getAvailableSignals(user);

      // Loop through all available signals
      Object.entries(availableSignals).forEach(([key, config]) => {
        // Only count signals that are active
        if (!activeSignals.includes(key)) return;

        // Skip shower as it's handled specially
        if (key === "shower") return;

        totalActiveSignals++;
        const value = signalsWithComputed[key];

        // Calculate completion score for this signal (0-100%)
        let completionScore = 0;
        let completionValue = 0; // How much this contributes to the completion count

        // Different calculation based on signal type
        if (config.type === "binary") {
          // Binary signals: 100% if true, 0% if false
          // Ensure we're checking for any truthy representation of true
          // Cast to unknown to handle potential string values from API
          const binaryVal = value as unknown;
          if (binaryVal === true || binaryVal === "true" || binaryVal === 1) {
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
    // Journaling signal is read-only - it's determined by the Morning page
    if (metric === "journaling") {
      console.log(
        "Journaling signal is read-only. It's automatically tracked from the Morning page."
      );
      return;
    }

    // Focus hours signal is read-only - it's determined by sessions
    if (metric === "focusHours") {
      console.log(
        "Focus Hours signal is read-only. It's automatically tracked from your focus sessions."
      );
      return;
    }

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
      console.log(
        "[SignalsContext] Signal update detected, refreshing signals data"
      );
      refreshSignals();
    };

    // Listen for session updates (new sessions, deleted sessions, etc.)
    const handleSessionUpdate = () => {
      console.log(
        "[SignalsContext] Session update detected, refreshing focusHours signal"
      );
      refreshSignals();
    };

    // Listen for morning entry updates (journaling)
    const handleMorningUpdate = () => {
      console.log(
        "[SignalsContext] Morning entry update detected, refreshing journaling signal"
      );
      refreshSignals();
    };

    // Listen for custom events that will be triggered when updates happen anywhere
    window.addEventListener("signalUpdated", handleSignalUpdate);
    window.addEventListener("sessionCreated", handleSessionUpdate);
    window.addEventListener("sessionDeleted", handleSessionUpdate);
    window.addEventListener("sessionUpdated", handleSessionUpdate);
    window.addEventListener("morningEntryUpdated", handleMorningUpdate);

    return () => {
      clearInterval(interval);
      window.removeEventListener("signalUpdated", handleSignalUpdate);
      window.removeEventListener("sessionCreated", handleSessionUpdate);
      window.removeEventListener("sessionDeleted", handleSessionUpdate);
      window.removeEventListener("sessionUpdated", handleSessionUpdate);
      window.removeEventListener("morningEntryUpdated", handleMorningUpdate);
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
