import React, { useState, useEffect } from "react";
import { useAuth } from "../../../context/AuthContext";
import { AlertCircle } from "lucide-react";

// All available signals with their configurations
export const AVAILABLE_SIGNALS = {
  focusHours: {
    label: "Focus Hours",
    type: "binary",
    hasGoal: false,
    isComputed: true, // This signal is automatically computed from sessions
  },
  minutesToOffice: {
    label: "Minutes to Office",
    type: "number",
    max: 180,
    hasGoal: true,
  },
  waterIntake: { label: "Water", type: "water", max: 5000, hasGoal: true },
  energy: { label: "Energy", type: "scale", hasGoal: false },
  mood: { label: "Routine", type: "scale", hasGoal: false },
  exercise: { label: "Exercise", type: "binary", hasGoal: false },
  breakfast: { label: "Breakfast", type: "binary", hasGoal: false },
  lunch: { label: "Lunch", type: "binary", hasGoal: false },
  shower: { label: "Shower", type: "binary", hasGoal: false },
  meditation: { label: "Meditation", type: "binary", hasGoal: false },
  reading: { label: "Reading", type: "binary", hasGoal: false },
  journaling: { label: "Journaling", type: "binary", hasGoal: false },
  vitamins: { label: "Vitamins", type: "binary", hasGoal: false },
  sleep: { label: "Sleep Hours", type: "number", max: 12, hasGoal: true },
  steps: { label: "Steps", type: "number", max: 30000, hasGoal: true },
} as const;

type SignalKey = keyof typeof AVAILABLE_SIGNALS;

const SignalSettings: React.FC = () => {
  const { user } = useAuth();

  // Initialize active signals from user preferences or default to all
  const [activeSignals, setActiveSignals] = useState<SignalKey[]>(
    (user?.preferences?.activeSignals as SignalKey[]) || [
      "minutesToOffice",
      "waterIntake",
      "energy",
      "mood",
      "exercise",
      "breakfast",
      "lunch",
      "shower",
    ]
  );

  // Initialize signal goals
  const [signalGoals, setSignalGoals] = useState<Record<string, number>>(
    user?.preferences?.signalGoals || {
      minutesToOffice: 30, // Target: 30 minutes to office
      waterIntake: 2000, // Target: 2000ml of water per day
      sleep: 8, // Target: 8 hours of sleep
      steps: 10000, // Target: 10,000 steps per day
    }
  );

  // Update state when user data changes
  useEffect(() => {
    if (user?.preferences?.activeSignals) {
      setActiveSignals(user.preferences.activeSignals as SignalKey[]);
    }
    if (user?.preferences?.signalGoals) {
      setSignalGoals(user.preferences.signalGoals);
    }
  }, [user]);

  const toggleSignal = (signalKey: SignalKey) => {
    setActiveSignals((prev) => {
      if (prev.includes(signalKey)) {
        return prev.filter((key) => key !== signalKey);
      } else {
        return [...prev, signalKey];
      }
    });
  };

  const handleGoalChange = (signalKey: string, value: number) => {
    setSignalGoals((prev) => ({
      ...prev,
      [signalKey]: value,
    }));
  };

  const getUnitForSignal = (signalKey: SignalKey): string => {
    switch (signalKey) {
      case "waterIntake":
        return "ml";
      case "sleep":
        return "hours";
      case "steps":
        return "steps";
      case "minutesToOffice":
        return "minutes";
      default:
        return "";
    }
  };

  // Store current values in a custom property that the parent component can access
  React.useEffect(() => {
    // @ts-ignore - This is a hack to expose state to parent component
    window.__signalSettings = {
      activeSignals,
      signalGoals,
    };
  }, [activeSignals, signalGoals]);

  const renderGoalInput = (signalKey: SignalKey) => {
    const signal = AVAILABLE_SIGNALS[signalKey];
    if (!signal.hasGoal) return null;

    const unit = getUnitForSignal(signalKey);

    return (
      <div className="mt-2">
        <label className="text-xs text-gray-500 dark:text-gray-400">
          Target Goal
        </label>
        <div className="relative mt-1">
          <input
            type="number"
            min="0"
            max={signal.max ?? undefined}
            value={signalGoals[signalKey] || 0}
            onChange={(e) =>
              handleGoalChange(signalKey, Number(e.target.value))
            }
            className="w-full p-1.5 text-xs border border-gray-200 dark:border-gray-800 rounded-md bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-gray-400 dark:focus:ring-gray-500 focus:border-gray-400 dark:focus:border-gray-500 pr-12"
          />
          {unit && (
            <span className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-500 dark:text-gray-400 text-xs">
              {unit}
            </span>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-sm font-medium text-gray-900 dark:text-white">
            Track Your Daily Signals
          </h3>
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 text-xs px-2 py-1 rounded-md flex items-center">
            <AlertCircle className="w-3 h-3 mr-1" />
            Select signals to track
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {Object.entries(AVAILABLE_SIGNALS).map(([key, signal]) => (
            <div
              key={key}
              className={`p-3 border rounded-md transition-colors ${
                activeSignals.includes(key as SignalKey)
                  ? "border-indigo-300 dark:border-indigo-700 bg-indigo-50 dark:bg-indigo-900/20"
                  : "border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900"
              }`}
            >
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center">
                  <input
                    type="checkbox"
                    checked={activeSignals.includes(key as SignalKey)}
                    onChange={() => toggleSignal(key as SignalKey)}
                    className="mr-2 h-4 w-4 rounded border-gray-300 dark:border-gray-600 text-indigo-600 dark:text-indigo-500 focus:ring-indigo-500 dark:focus:ring-indigo-400"
                  />
                  {signal.label}
                </label>
                <span className="text-xs text-gray-500 dark:text-gray-400 px-2 py-0.5 bg-gray-100 dark:bg-gray-800 rounded">
                  {signal.type}
                </span>
              </div>

              {activeSignals.includes(key as SignalKey) &&
                renderGoalInput(key as SignalKey)}
            </div>
          ))}
        </div>
      </div>

      <div className="p-4 border border-gray-200 dark:border-gray-800 rounded-md bg-gray-50 dark:bg-gray-900/40">
        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Signal Tracking Information
        </h4>
        <ul className="space-y-1 text-xs text-gray-600 dark:text-gray-400">
          <li>• Active signals appear on your Compass page</li>
          <li>• Set specific goals for applicable signals</li>
          <li>• Your daily progress will be tracked automatically</li>
          <li>• Performance metrics will show your 7-day history</li>
        </ul>
      </div>
    </div>
  );
};

export default SignalSettings;
