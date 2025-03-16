import React, { useEffect, useState } from "react";
import SignalCard from "./SignalCard";
import { api } from "../../../utils/api";

const SIGNALS = {
  minutesToOffice: { label: "Minutes to Office", type: "number", max: 180 },
  waterIntake: { label: "Water", type: "water" },
  energy: { label: "Energy", type: "scale" },
  mood: { label: "Mood", type: "scale" },
  exercise: { label: "Exercise", type: "binary" },
  breakfast: { label: "Breakfast", type: "binary" },
  lunch: { label: "Lunch", type: "binary" },
  shower: { label: "Shower", type: "binary" },
} as const;

const Signals: React.FC = () => {
  const [signals, setSignals] = useState<Record<string, number | boolean>>({});
  const today = new Date().toISOString().split("T")[0];

  useEffect(() => {
    loadDailySignals();
  }, []);

  const loadDailySignals = async () => {
    try {
      const data = await api.getDailySignals(today);
      setSignals(data);
    } catch (error) {
      console.error("Failed to load signals:", error);
    }
  };

  const handleSignalChange = async (
    metric: string,
    value: number | boolean
  ) => {
    try {
      await api.recordSignal(today, metric, value);
      setSignals((prev) => ({ ...prev, [metric]: value }));
    } catch (error) {
      console.error("Failed to update signal:", error);
    }
  };

  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-800 overflow-hidden mb-6">
      <div className="border-b border-gray-200 dark:border-gray-800 px-5 py-3 flex items-center">
        <h2 className="text-sm font-medium text-gray-900 dark:text-white">
          Daily Signals
        </h2>
      </div>
      <div className="p-5">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Object.entries(SIGNALS).map(([key, config]) => (
            <SignalCard
              key={key}
              label={config.label}
              type={config.type}
              value={signals[key] ?? (config.type === "binary" ? false : 0)}
              onChange={(value) => handleSignalChange(key, value)}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default Signals;
