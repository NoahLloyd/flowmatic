import React, { useState, useEffect, useCallback } from "react";
import {
  Calendar,
  Star,
  Check,
  Loader,
  Settings,
  Play,
  Pause,
  RotateCcw,
} from "lucide-react";
import { api } from "../../utils/api";
import { MorningEntry } from "../../types/Morning";
import { useAuth } from "../../context/AuthContext";
import { debounce } from "lodash";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import MorningSettings from "./MorningSettings";

interface Exercise {
  id: string;
  name: string;
  settings: {
    timerDuration?: number;
    affirmations?: string[];
    visualizations?: string[];
  };
}

const Morning = () => {
  const { user } = useAuth();
  const [entries, setEntries] = useState<MorningEntry[]>([]);
  const [currentEntry, setCurrentEntry] = useState("");
  const [streak, setStreak] = useState(0);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [hasPendingChanges, setHasPendingChanges] = useState(false);
  const [highlightedDates, setHighlightedDates] = useState<Date[]>([]);
  const [currentExerciseIndex, setCurrentExerciseIndex] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [isTimerComplete, setIsTimerComplete] = useState(false);

  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().split("T")[0]
  );

  // Get current day's exercises
  const getCurrentDayExercises = (): Exercise[] => {
    const dayOfWeek = new Date().toLocaleString("en-US", { weekday: "long" });
    return user?.preferences?.morning?.schedule[dayOfWeek]?.exercises || [];
  };

  const currentExercise = getCurrentDayExercises()[currentExerciseIndex];

  // Timer functions
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isTimerRunning && timeRemaining > 0) {
      interval = setInterval(() => {
        setTimeRemaining((prev) => {
          if (prev <= 1) {
            setIsTimerRunning(false);
            setIsTimerComplete(true);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isTimerRunning, timeRemaining]);

  const handleTimerToggle = () => {
    if (!isTimerRunning && timeRemaining === 0) {
      // Start new timer
      const duration = currentExercise?.settings?.timerDuration || 15;
      setTimeRemaining(duration * 60);
    }
    setIsTimerRunning(!isTimerRunning);
  };

  const handleTimerReset = () => {
    setIsTimerRunning(false);
    setIsTimerComplete(false);
    setTimeRemaining(0);
  };

  // Load entries and streak on mount
  useEffect(() => {
    const loadEntries = async () => {
      try {
        const data = await api.getAllEntries();
        setEntries(data.entries);
        setStreak(data.streak);

        const dates = data.entries
          .filter((entry) => entry.content?.trim())
          .map((entry) => new Date(entry.date));
        setHighlightedDates(dates);
      } catch (error) {
        console.error("Failed to load entries:", error);
      }
    };

    loadEntries();
  }, []);

  // Load current date's entry
  useEffect(() => {
    const loadCurrentEntry = async () => {
      try {
        const { content } = await api.getEntry(selectedDate);
        setCurrentEntry(content);
      } catch (error) {
        console.error("Failed to load entry:", error);
      }
    };

    loadCurrentEntry();
  }, [selectedDate]);

  // Debounced save function
  const debouncedSave = useCallback(
    debounce(async (date: string, content: string) => {
      try {
        setIsSaving(true);
        await api.updateEntry(date, content);
        setLastSaved(new Date());
        setHasPendingChanges(false);
        setEntries((prevEntries) => {
          const userId = localStorage.getItem("name");
          const entryIndex = prevEntries.findIndex(
            (entry) => entry.date === date && entry.user_id === userId
          );
          if (entryIndex >= 0) {
            const newEntries = [...prevEntries];
            newEntries[entryIndex] = {
              date,
              content,
              user_id: userId,
            };
            return newEntries;
          } else {
            return [
              ...prevEntries,
              {
                date,
                content,
                user_id: userId,
              },
            ];
          }
        });
      } catch (error) {
        console.error("Failed to save entry:", error);
      } finally {
        setIsSaving(false);
      }
    }, 500),
    []
  );

  // Auto-save when content changes
  useEffect(() => {
    if (currentEntry) {
      debouncedSave(selectedDate, currentEntry);
    }
  }, [currentEntry, selectedDate, debouncedSave]);

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setHasPendingChanges(true);
    let newText = e.target.value;
    const lastChar = newText[e.target.selectionStart - 1];
    const textBeforeCursor = newText.slice(0, e.target.selectionStart);
    const textAfterCursor = newText.slice(e.target.selectionStart);
    const lastWord = textBeforeCursor.split("\n").pop()?.trim();

    if (lastChar === " ") {
      if (lastWord === "#") {
        newText = textBeforeCursor.slice(0, -2) + "# " + textAfterCursor;
      } else if (lastWord === "-") {
        newText = textBeforeCursor.slice(0, -2) + "• " + textAfterCursor;
      } else if (lastWord === "*") {
        newText = textBeforeCursor.slice(0, -2) + "**" + textAfterCursor;
      }
    }

    setCurrentEntry(newText);
  };

  const handleDateChange = (date: Date) => {
    setSelectedDate(date.toISOString().split("T")[0]);
    setIsCalendarOpen(false);
  };

  const handleNextExercise = () => {
    const exercises = getCurrentDayExercises();
    if (currentExerciseIndex < exercises.length - 1) {
      setCurrentExerciseIndex((prev) => prev + 1);
      handleTimerReset();
      setCurrentEntry("");
    }
  };

  const renderExerciseContent = () => {
    if (!currentExercise) return null;

    switch (currentExercise.id) {
      case "consciousness":
        return <div className="space-y-4"></div>;

      case "affirmations":
        return (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
              Daily Affirmations
            </h2>
            <div className="space-y-2">
              {currentExercise.settings.affirmations?.map(
                (affirmation, index) => (
                  <div
                    key={index}
                    className="p-2 bg-slate-50 dark:bg-slate-800 rounded"
                  >
                    {affirmation}
                  </div>
                )
              )}
            </div>
          </div>
        );

      case "gratitude":
        return (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
              Gratitude Practice
            </h2>
            <p className="text-slate-600 dark:text-slate-400">
              Write about things you're grateful for today.
            </p>
          </div>
        );

      case "visualization":
      case "negative-visualization":
        return (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
              {currentExercise.id === "visualization"
                ? "Visualization"
                : "Negative Visualization"}
            </h2>
            <div className="space-y-2">
              {currentExercise.settings.visualizations?.map(
                (visualization, index) => (
                  <div
                    key={index}
                    className="p-2 bg-slate-50 dark:bg-slate-800 dark:text-white rounded"
                  >
                    {visualization}
                  </div>
                )
              )}
            </div>
          </div>
        );

      case "breathing":
        return (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
              Breathing Exercise
            </h2>
            <p className="text-slate-600 dark:text-slate-400">
              Focus on your breath and follow the timer.
            </p>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div
      className={`max-w-4xl mx-auto p-8 dark:bg-slate-900 ${
        isTimerComplete ? "bg-amber-50 dark:bg-amber-900/30" : ""
      }`}
    >
      <div className="mb-8 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2 px-4 py-2 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
            <Star className="w-5 h-5 text-yellow-500" />
            <span className="text-slate-700 dark:text-slate-200">
              {streak} day streak
            </span>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={handleTimerToggle}
              className="p-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
            >
              {isTimerRunning ? (
                <Pause className="w-5 h-5 text-slate-600 dark:text-slate-400" />
              ) : (
                <Play className="w-5 h-5 text-slate-600 dark:text-slate-400" />
              )}
            </button>
            {timeRemaining > 0 && (
              <div className="px-4 py-2 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
                <span className="text-slate-700 dark:text-slate-200 font-medium">
                  {Math.floor(timeRemaining / 60)} min
                </span>
              </div>
            )}
            {(isTimerRunning || timeRemaining > 0) && (
              <button
                onClick={handleTimerReset}
                className="p-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
              >
                <RotateCcw className="w-5 h-5 text-slate-600 dark:text-slate-400" />
              </button>
            )}
          </div>
        </div>
        <div className="relative flex items-center space-x-2">
          <button
            onClick={() => setIsSettingsOpen(true)}
            className="flex items-center space-x-2 px-4 py-2 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700"
          >
            <Settings className="w-4 h-4 text-slate-500 dark:text-slate-400" />
          </button>
          <button
            onClick={() => setIsCalendarOpen(!isCalendarOpen)}
            className="flex items-center space-x-2 px-4 py-2 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700"
          >
            <Calendar className="w-4 h-4 text-slate-500 dark:text-slate-400" />
            {isSaving || hasPendingChanges ? (
              <Loader className="w-4 h-4 text-slate-500 dark:text-slate-400 animate-spin" />
            ) : lastSaved ? (
              <Check className="w-4 h-4 text-green-500" />
            ) : null}
          </button>
          {isCalendarOpen && (
            <div className="absolute top-full right-0 mt-2 z-10">
              <DatePicker
                selected={new Date(selectedDate)}
                onChange={handleDateChange}
                inline
                maxDate={new Date()}
                highlightDates={highlightedDates}
                dayClassName={(date) =>
                  highlightedDates.some(
                    (d) =>
                      d.toISOString().split("T")[0] ===
                      date.toISOString().split("T")[0]
                  )
                    ? "highlighted-date"
                    : undefined
                }
              />
            </div>
          )}
        </div>
      </div>

      {renderExerciseContent()}

      <div className="w-full mt-4">
        <textarea
          value={currentEntry}
          onChange={handleTextChange}
          placeholder={`Write your ${
            currentExercise?.name?.toLowerCase() || "morning"
          } entry here...`}
          className="w-full h-[calc(100vh-16rem)] p-6 rounded-lg bg-white dark:bg-slate-800 shadow-sm border border-slate-100 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-200 dark:focus:ring-slate-600 resize-none font-sans text-slate-700 dark:text-slate-200 text-lg leading-relaxed placeholder-slate-400 dark:placeholder-slate-500"
          spellCheck="true"
        />
      </div>

      {currentExerciseIndex < getCurrentDayExercises().length - 1 && (
        <button
          onClick={handleNextExercise}
          className="mt-4 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          Next Exercise
        </button>
      )}

      <MorningSettings
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />
    </div>
  );
};

export default Morning;
