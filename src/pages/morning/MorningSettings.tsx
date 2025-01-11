import React from "react";
import { X } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
interface Exercise {
  id: string;
  name: string;
  settings: {
    timerDuration?: number;
    affirmations?: string[];
    visualizations?: string[]; // Added this
  };
}

interface DaySchedule {
  exercises: Exercise[];
}

interface MorningSettings {
  schedule: Record<string, DaySchedule>;
  defaultTimerDuration: number;
  affirmations: string[];
}

interface MorningSettingsProps {
  isOpen: boolean;
  onClose: () => void;
}

const DAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];
const AVAILABLE_EXERCISES = [
  {
    id: "consciousness",
    name: "Stream of Consciousness",
    hasTimer: true,
    defaultDuration: 15,
    description: "Free-flow writing without judgment or editing",
  },
  {
    id: "affirmations",
    name: "Affirmations",
    hasAffirmations: true,
    description: "Personal positive statements to reinforce beliefs",
  },
  {
    id: "gratitude",
    name: "Gratitude",
    description: "Express appreciation for things in your life",
  },
  {
    id: "visualization",
    name: "Visualization",
    hasTimer: true,
    defaultDuration: 5,
    hasVisualizations: true, // Added this
    description: "Mental imagery of desired outcomes",
  },
  {
    id: "negative-visualization",
    name: "Negative Visualization",
    hasTimer: true,
    defaultDuration: 5,
    hasVisualizations: true, // Added this
    description: "Stoic practice of imagining losing what you value",
  },
  {
    id: "breathing",
    name: "Breathing Exercise",
    hasTimer: true,
    defaultDuration: 5,
    description: "Focused breathing techniques",
  },
];

const MorningSettings: React.FC<MorningSettingsProps> = ({
  isOpen,
  onClose,
}) => {
  const { user, updateUserPreferences } = useAuth();
  const [settings, setSettings] = React.useState<MorningSettings>(
    user?.preferences?.morning || {
      schedule: {},
      defaultTimerDuration: 15,
      affirmations: [],
    }
  );
  const [selectedExercise, setSelectedExercise] = React.useState<string | null>(
    null
  );
  const [editingDay, setEditingDay] = React.useState<string | null>(null);

  const handleSave = async () => {
    try {
      const updatedPreferences = {
        ...user?.preferences,
        morning: settings,
      };
      await updateUserPreferences(updatedPreferences);
      onClose();
    } catch (error) {
      console.error("Failed to save morning settings:", error);
    }
  };

  const toggleExercise = (day: string, exerciseId: string) => {
    setSettings((prev) => {
      const daySchedule = prev.schedule[day] || { exercises: [] };
      const exercises = daySchedule.exercises;

      const exists = exercises.some((e) => e.id === exerciseId);
      const updatedExercises = exists
        ? exercises.filter((e) => e.id !== exerciseId)
        : [
            ...exercises,
            {
              id: exerciseId,
              name:
                AVAILABLE_EXERCISES.find((e) => e.id === exerciseId)?.name ||
                "",
              settings: {
                timerDuration: AVAILABLE_EXERCISES.find(
                  (e) => e.id === exerciseId
                )?.defaultDuration,
              },
            },
          ];

      return {
        ...prev,
        schedule: {
          ...prev.schedule,
          [day]: { exercises: updatedExercises },
        },
      };
    });
  };

  const updateExerciseSettings = (
    day: string,
    exerciseId: string,
    newSettings: any
  ) => {
    setSettings((prev) => {
      const daySchedule = prev.schedule[day] || { exercises: [] };
      const exercises = daySchedule.exercises.map((exercise) =>
        exercise.id === exerciseId
          ? { ...exercise, settings: { ...exercise.settings, ...newSettings } }
          : exercise
      );

      return {
        ...prev,
        schedule: {
          ...prev.schedule,
          [day]: { exercises },
        },
      };
    });
  };

  const renderExerciseSettings = (day: string, exercise: Exercise) => {
    const exerciseConfig = AVAILABLE_EXERCISES.find(
      (e) => e.id === exercise.id
    );

    return (
      <div className="ml-8 mt-2 space-y-2">
        {exerciseConfig?.hasTimer && (
          <div className="flex items-center space-x-2">
            <label className="text-sm text-slate-600 dark:text-slate-400">
              Duration (minutes):
              <input
                type="number"
                min="1"
                max="60"
                value={
                  exercise.settings.timerDuration ||
                  exerciseConfig.defaultDuration
                }
                onChange={(e) =>
                  updateExerciseSettings(day, exercise.id, {
                    timerDuration: parseInt(e.target.value),
                  })
                }
                className="ml-2 w-16 px-2 py-1 rounded border border-slate-300 dark:border-slate-600 dark:bg-slate-700"
              />
            </label>
          </div>
        )}
        {exerciseConfig?.hasAffirmations && (
          <div className="space-y-2">
            <label className="text-sm text-slate-600 dark:text-slate-400">
              Affirmations:
              <textarea
                value={exercise.settings.affirmations?.join("\n") || ""}
                onChange={(e) =>
                  updateExerciseSettings(day, exercise.id, {
                    affirmations: e.target.value
                      .split("\n")
                      .filter((line) => line.trim()),
                  })
                }
                className="mt-1 w-full px-2 py-1 rounded border border-slate-300 dark:border-slate-600 dark:bg-slate-700"
                placeholder="Enter each affirmation on a new line"
                rows={3}
              />
            </label>
          </div>
        )}
        {exerciseConfig?.hasVisualizations && (
          <div className="space-y-2">
            <label className="text-sm text-slate-600 dark:text-slate-400">
              {exercise.id === "visualization"
                ? "Visualization Prompts:"
                : "Negative Visualization Prompts:"}
              <textarea
                value={exercise.settings.visualizations?.join("\n") || ""}
                onChange={(e) =>
                  updateExerciseSettings(day, exercise.id, {
                    visualizations: e.target.value
                      .split("\n")
                      .filter((line) => line.trim()),
                  })
                }
                className="mt-1 w-full px-2 py-1 rounded border border-slate-300 dark:border-slate-600 dark:bg-slate-700"
                placeholder={
                  exercise.id === "visualization"
                    ? "Enter each visualization prompt on a new line (e.g., 'Achieving my career goals', 'Living my ideal lifestyle')"
                    : "Enter each negative visualization prompt on a new line (e.g., 'Losing access to technology', 'Not having good health')"
                }
                rows={3}
              />
            </label>
          </div>
        )}
      </div>
    );
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-slate-800 rounded-lg w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center">
          <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
            Morning Routine Settings
          </h2>
          <button
            onClick={onClose}
            className="text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6">
          <div className="space-y-6">
            {DAYS.map((day) => (
              <div
                key={day}
                className="border-b border-slate-200 dark:border-slate-700 pb-4"
              >
                <h3 className="text-lg font-medium mb-3 text-slate-900 dark:text-slate-100">
                  {day}
                </h3>
                <div className="space-y-4">
                  {AVAILABLE_EXERCISES.map((exercise) => (
                    <div key={exercise.id}>
                      <label className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          checked={settings.schedule[day]?.exercises.some(
                            (e) => e.id === exercise.id
                          )}
                          onChange={() => toggleExercise(day, exercise.id)}
                          className="rounded border-slate-300 dark:border-slate-600"
                        />
                        <span className="text-slate-700 dark:text-slate-300">
                          {exercise.name}
                        </span>
                        <span className="text-sm text-slate-500 dark:text-slate-400">
                          ({exercise.description})
                        </span>
                      </label>
                      {settings.schedule[day]?.exercises.some(
                        (e) => e.id === exercise.id
                      ) &&
                        renderExerciseSettings(
                          day,
                          settings.schedule[day].exercises.find(
                            (e) => e.id === exercise.id
                          )!
                        )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="p-6 border-t border-slate-200 dark:border-slate-700 flex justify-end space-x-4">
          <button
            onClick={onClose}
            className="px-4 py-2 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
};

export default MorningSettings;
