import React, { useState, useEffect } from "react";
import { useAuth } from "../../../context/AuthContext";
import { api } from "../../../utils/api";
import { AlertCircle, Plus, X } from "lucide-react";

// Signal configuration type
export interface SignalConfig {
  label: string;
  type: "binary" | "number" | "water" | "scale";
  max?: number;
  hasGoal: boolean;
  isComputed?: boolean;
  isCustom?: boolean;
  unit?: string;
}

// All available built-in signals with their configurations
export const AVAILABLE_SIGNALS: Record<string, SignalConfig> = {
  focusHours: {
    label: "Focus Hours",
    type: "binary",
    hasGoal: false,
    isComputed: true,
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
};

// Helper to merge built-in signals with custom signals from user preferences.
// Also accepts DB-loaded configs which take precedence over hardcoded defaults.
export const getAllSignals = (
  customSignals?: Record<string, SignalConfig>,
  dbSignals?: Record<string, SignalConfig>,
): Record<string, SignalConfig> => {
  return { ...AVAILABLE_SIGNALS, ...(dbSignals || {}), ...(customSignals || {}) };
};

const SIGNAL_TYPES: { value: SignalConfig["type"]; label: string; description: string }[] = [
  { value: "binary", label: "Yes / No", description: "Simple on/off toggle" },
  { value: "number", label: "Number", description: "Numeric value with optional goal" },
  { value: "scale", label: "Scale (1-5)", description: "Rate on a 1-5 scale" },
  { value: "water", label: "Water", description: "Water intake tracker (ml)" },
];

const SignalSettings: React.FC = () => {
  const { user } = useAuth();

  // Custom signals from user preferences
  const [customSignals, setCustomSignals] = useState<Record<string, SignalConfig>>(
    (user?.preferences?.customSignals as Record<string, SignalConfig>) || {}
  );

  // Initialize active signals from user preferences or default to all
  const [activeSignals, setActiveSignals] = useState<string[]>(
    (user?.preferences?.activeSignals as string[]) || [
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
      minutesToOffice: 30,
      waterIntake: 2000,
      sleep: 8,
      steps: 10000,
    }
  );

  // Form state for creating new signals
  const [showForm, setShowForm] = useState(false);
  const [newSignalName, setNewSignalName] = useState("");
  const [newSignalType, setNewSignalType] = useState<SignalConfig["type"]>("binary");
  const [newSignalHasGoal, setNewSignalHasGoal] = useState(false);
  const [newSignalMax, setNewSignalMax] = useState<number | "">("");
  const [newSignalUnit, setNewSignalUnit] = useState("");
  const [formError, setFormError] = useState("");

  // DB-loaded signal configs (takes precedence over hardcoded AVAILABLE_SIGNALS)
  const [dbSignals, setDbSignals] = useState<Record<string, SignalConfig>>({});

  // Load signal configs from DB on mount
  useEffect(() => {
    api.getSignalConfigs().then((configs) => {
      const mapped: Record<string, SignalConfig> = {};
      for (const c of configs) {
        mapped[c.key] = {
          label: c.label,
          type: c.type,
          max: c.max_value ?? undefined,
          hasGoal: c.has_goal,
          isComputed: c.is_computed ?? undefined,
          unit: c.unit ?? undefined,
        };
      }
      setDbSignals(mapped);
    }).catch((err) => console.error("Failed to load signal configs:", err));
  }, []);

  // Merged signals (DB configs > built-in > custom)
  const allSignals = getAllSignals(customSignals, dbSignals);

  // Update state when user data changes
  useEffect(() => {
    if (user?.preferences?.activeSignals) {
      setActiveSignals(user.preferences.activeSignals as string[]);
    }
    if (user?.preferences?.signalGoals) {
      setSignalGoals(user.preferences.signalGoals);
    }
    if (user?.preferences?.customSignals) {
      setCustomSignals(user.preferences.customSignals as Record<string, SignalConfig>);
    }
  }, [user]);

  const toggleSignal = (signalKey: string) => {
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

  const getUnitForSignal = (signalKey: string): string => {
    // Check custom signal unit first
    const signal = allSignals[signalKey];
    if (signal?.isCustom && signal.unit) return signal.unit;

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

  // Generate a key from the signal name
  const generateKey = (name: string): string => {
    return name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_|_$/g, "");
  };

  const handleCreateSignal = () => {
    setFormError("");

    const trimmedName = newSignalName.trim();
    if (!trimmedName) {
      setFormError("Signal name is required");
      return;
    }

    const key = generateKey(trimmedName);
    if (!key) {
      setFormError("Invalid signal name");
      return;
    }

    if (allSignals[key]) {
      setFormError("A signal with this name already exists");
      return;
    }

    const newSignal: SignalConfig = {
      label: trimmedName,
      type: newSignalType,
      hasGoal: newSignalHasGoal,
      isCustom: true,
    };

    if ((newSignalType === "number" || newSignalType === "water") && newSignalMax) {
      newSignal.max = Number(newSignalMax);
    }

    if (newSignalUnit.trim()) {
      newSignal.unit = newSignalUnit.trim();
    }

    setCustomSignals((prev) => ({ ...prev, [key]: newSignal }));
    // Auto-activate the new signal
    setActiveSignals((prev) => [...prev, key]);

    // Reset form
    setNewSignalName("");
    setNewSignalType("binary");
    setNewSignalHasGoal(false);
    setNewSignalMax("");
    setNewSignalUnit("");
    setShowForm(false);
  };

  const handleDeleteCustomSignal = (key: string) => {
    setCustomSignals((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
    setActiveSignals((prev) => prev.filter((k) => k !== key));
    setSignalGoals((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  // Store current values in a custom property that the parent component can access
  React.useEffect(() => {
    // @ts-ignore - This is a hack to expose state to parent component
    window.__signalSettings = {
      activeSignals,
      signalGoals,
      customSignals,
    };
  }, [activeSignals, signalGoals, customSignals]);

  const renderGoalInput = (signalKey: string) => {
    const signal = allSignals[signalKey];
    if (!signal?.hasGoal) return null;

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
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowForm(!showForm)}
              className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              <Plus className="w-3 h-3" />
              Create Signal
            </button>
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 text-xs px-2 py-1 rounded-md flex items-center">
              <AlertCircle className="w-3 h-3 mr-1" />
              Select signals to track
            </div>
          </div>
        </div>

        {/* Create Signal Form */}
        {showForm && (
          <div className="mb-4 p-4 border border-gray-200 dark:border-gray-800 rounded-md bg-gray-50 dark:bg-gray-900/40">
            <div className="flex justify-between items-center mb-3">
              <h4 className="text-sm font-medium text-gray-900 dark:text-white">
                Create Custom Signal
              </h4>
              <button
                onClick={() => {
                  setShowForm(false);
                  setFormError("");
                }}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Signal Name */}
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Name
                </label>
                <input
                  type="text"
                  value={newSignalName}
                  onChange={(e) => setNewSignalName(e.target.value)}
                  placeholder="e.g. Cold Plunge"
                  className="w-full p-2 text-sm border border-gray-200 dark:border-gray-800 rounded-md bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-gray-400 dark:focus:ring-gray-500 focus:border-gray-400 dark:focus:border-gray-500"
                />
              </div>

              {/* Signal Type */}
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Type
                </label>
                <select
                  value={newSignalType}
                  onChange={(e) => {
                    const type = e.target.value as SignalConfig["type"];
                    setNewSignalType(type);
                    // Reset goal if switching to scale/binary
                    if (type === "binary" || type === "scale") {
                      setNewSignalHasGoal(false);
                      setNewSignalMax("");
                    }
                  }}
                  className="w-full p-2 text-sm border border-gray-200 dark:border-gray-800 rounded-md bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-gray-400 dark:focus:ring-gray-500 focus:border-gray-400 dark:focus:border-gray-500"
                >
                  {SIGNAL_TYPES.map((st) => (
                    <option key={st.value} value={st.value}>
                      {st.label} — {st.description}
                    </option>
                  ))}
                </select>
              </div>

              {/* Unit (for number/water types) */}
              {(newSignalType === "number" || newSignalType === "water") && (
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Unit (optional)
                  </label>
                  <input
                    type="text"
                    value={newSignalUnit}
                    onChange={(e) => setNewSignalUnit(e.target.value)}
                    placeholder="e.g. minutes, reps, km"
                    className="w-full p-2 text-sm border border-gray-200 dark:border-gray-800 rounded-md bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-gray-400 dark:focus:ring-gray-500 focus:border-gray-400 dark:focus:border-gray-500"
                  />
                </div>
              )}

              {/* Max value (for number/water types) */}
              {(newSignalType === "number" || newSignalType === "water") && (
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Max Value (optional)
                  </label>
                  <input
                    type="number"
                    value={newSignalMax}
                    onChange={(e) =>
                      setNewSignalMax(e.target.value ? Number(e.target.value) : "")
                    }
                    placeholder="e.g. 100"
                    min="1"
                    className="w-full p-2 text-sm border border-gray-200 dark:border-gray-800 rounded-md bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-gray-400 dark:focus:ring-gray-500 focus:border-gray-400 dark:focus:border-gray-500"
                  />
                </div>
              )}
            </div>

            {/* Has Goal toggle */}
            {(newSignalType === "number" || newSignalType === "water") && (
              <div className="mt-3 flex items-center gap-2">
                <input
                  type="checkbox"
                  id="hasGoal"
                  checked={newSignalHasGoal}
                  onChange={(e) => setNewSignalHasGoal(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 dark:border-gray-600 text-indigo-600 dark:text-indigo-500 focus:ring-indigo-500 dark:focus:ring-indigo-400"
                />
                <label
                  htmlFor="hasGoal"
                  className="text-xs text-gray-700 dark:text-gray-300"
                >
                  Enable goal tracking for this signal
                </label>
              </div>
            )}

            {formError && (
              <p className="mt-2 text-xs text-red-600 dark:text-red-400">
                {formError}
              </p>
            )}

            <div className="mt-3 flex justify-end">
              <button
                onClick={handleCreateSignal}
                className="px-3 py-1.5 text-sm bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-md hover:bg-gray-800 dark:hover:bg-gray-200 transition-colors"
              >
                Create Signal
              </button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {Object.entries(allSignals).map(([key, signal]) => (
            <div
              key={key}
              className={`p-3 border rounded-md transition-colors ${
                activeSignals.includes(key)
                  ? "border-indigo-300 dark:border-indigo-700 bg-indigo-50 dark:bg-indigo-900/20"
                  : "border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900"
              }`}
            >
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center">
                  <input
                    type="checkbox"
                    checked={activeSignals.includes(key)}
                    onChange={() => toggleSignal(key)}
                    className="mr-2 h-4 w-4 rounded border-gray-300 dark:border-gray-600 text-indigo-600 dark:text-indigo-500 focus:ring-indigo-500 dark:focus:ring-indigo-400"
                  />
                  {signal.label}
                </label>
                <div className="flex items-center gap-1">
                  <span className="text-xs text-gray-500 dark:text-gray-400 px-2 py-0.5 bg-gray-100 dark:bg-gray-800 rounded">
                    {signal.type}
                  </span>
                  {signal.isCustom && (
                    <button
                      onClick={() => handleDeleteCustomSignal(key)}
                      className="text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition-colors"
                      title="Delete custom signal"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {activeSignals.includes(key) && renderGoalInput(key)}
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
