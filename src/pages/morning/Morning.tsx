import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  Calendar,
  Star,
  Check,
  Loader,
  Timer,
  Play,
  Pause,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  PenLine,
  Eye,
  Heart,
  Wind,
  CalendarDays,
} from "lucide-react";
import { api } from "../../utils/api";
import {
  MorningEntry,
  MorningActivity,
  DayOfWeek,
  MorningActivityContent,
} from "../../types/Morning";
import { useAuth } from "../../context/AuthContext";
import { debounce } from "lodash";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";

const Morning = () => {
  const { user } = useAuth();
  const [entries, setEntries] = useState<MorningEntry[]>([]);
  const [currentEntry, setCurrentEntry] = useState("");
  const [streak, setStreak] = useState(0);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [hasPendingChanges, setHasPendingChanges] = useState(false);
  const [highlightedDates, setHighlightedDates] = useState<Date[]>([]);

  // Morning activities from user preferences
  const [activities, setActivities] = useState<MorningActivity[]>([
    {
      id: "writing",
      type: "writing",
      enabled: true,
      timerMinutes: 15,
      title: "Stream of Consciousness Writing",
    },
  ]);

  // Current active activity
  const [currentActivityIndex, setCurrentActivityIndex] = useState(0);

  // Timer states
  const [timerActive, setTimerActive] = useState(false);
  const [timerComplete, setTimerComplete] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(15 * 60); // 15 minutes in seconds
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const hasStartedWriting = useRef(false);

  // Gratitude and affirmation entries
  const [gratitudeEntry, setGratitudeEntry] = useState("");
  const [affirmationsEntry, setAffirmationsEntry] = useState("");

  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().split("T")[0]
  );

  // Keep track of today's day of week
  const [currentDayOfWeek, setCurrentDayOfWeek] = useState<string>("");

  // Format time as MM:SS
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    return `${mins} min`;
  };

  // Load activities from user preferences
  useEffect(() => {
    if (user?.preferences?.weeklyMorningSchedule) {
      // Get current day of the week
      const today = new Date();
      const daysOfWeek = [
        "sunday",
        "monday",
        "tuesday",
        "wednesday",
        "thursday",
        "friday",
        "saturday",
      ];
      const currentDay = daysOfWeek[today.getDay()]; // getDay() returns 0-6 starting with Sunday

      // Store current day name for display
      setCurrentDayOfWeek(
        currentDay.charAt(0).toUpperCase() + currentDay.slice(1)
      );

      // Get activities for current day or fall back to default
      let todayActivities;

      if (user.preferences.weeklyMorningSchedule[currentDay]) {
        // Filter to only enabled activities
        todayActivities = user.preferences.weeklyMorningSchedule[
          currentDay
        ].filter((activity: MorningActivity) => activity.enabled);
      } else if (user.preferences.morningActivities) {
        // Fall back to legacy format if daily schedule isn't available
        todayActivities = user.preferences.morningActivities.filter(
          (activity: MorningActivity) => activity.enabled
        );
      }

      if (todayActivities && todayActivities.length > 0) {
        setActivities(todayActivities);

        // Set timer to first activity's duration
        const firstActivity = todayActivities[0];
        if (firstActivity.timerMinutes) {
          setTimeRemaining(firstActivity.timerMinutes * 60);
        }
      }
    } else if (user?.preferences?.morningActivities) {
      // Legacy format - using the same activities for all days
      // Filter to only enabled activities
      const enabledActivities = user.preferences.morningActivities.filter(
        (activity: MorningActivity) => activity.enabled
      );
      setActivities(enabledActivities);

      // Set timer to first activity's duration
      if (enabledActivities.length > 0) {
        const firstActivity = enabledActivities[0];
        if (firstActivity.timerMinutes) {
          setTimeRemaining(firstActivity.timerMinutes * 60);
        }
      }
    }
  }, [user]);

  // Timer control functions
  const startTimer = useCallback(() => {
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);

    setTimerActive(true);
    setTimerComplete(false);

    timerIntervalRef.current = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          // Timer complete
          clearInterval(timerIntervalRef.current as NodeJS.Timeout);
          setTimerActive(false);
          setTimerComplete(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  const pauseTimer = useCallback(() => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    setTimerActive(false);
  }, []);

  const resetTimer = useCallback(() => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }

    // Reset timer to current activity's duration
    const activity = activities[currentActivityIndex];
    if (activity && activity.timerMinutes) {
      setTimeRemaining(activity.timerMinutes * 60);
    } else {
      setTimeRemaining(15 * 60); // Default to 15 minutes
    }

    setTimerActive(false);
    setTimerComplete(false);
  }, [activities, currentActivityIndex]);

  // Switch to next activity
  const nextActivity = useCallback(() => {
    if (currentActivityIndex < activities.length - 1) {
      setCurrentActivityIndex((prev) => prev + 1);
      setTimerComplete(false);

      // Reset timer for new activity
      const nextActivity = activities[currentActivityIndex + 1];
      if (nextActivity && nextActivity.timerMinutes) {
        setTimeRemaining(nextActivity.timerMinutes * 60);
      } else {
        setTimeRemaining(15 * 60); // Default
      }
    }
  }, [activities, currentActivityIndex]);

  // Switch to previous activity
  const prevActivity = useCallback(() => {
    if (currentActivityIndex > 0) {
      setCurrentActivityIndex((prev) => prev - 1);
      setTimerComplete(false);

      // Reset timer for new activity
      const prevActivity = activities[currentActivityIndex - 1];
      if (prevActivity && prevActivity.timerMinutes) {
        setTimeRemaining(prevActivity.timerMinutes * 60);
      } else {
        setTimeRemaining(15 * 60); // Default
      }
    }
  }, [activities, currentActivityIndex]);

  // Clean up interval on unmount
  useEffect(() => {
    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
    };
  }, []);

  // Reset timer when date or activity changes
  useEffect(() => {
    resetTimer();
    hasStartedWriting.current = false;
  }, [selectedDate, currentActivityIndex, resetTimer]);

  // Load entries and streak on mount
  useEffect(() => {
    const loadEntries = async () => {
      try {
        const data = await api.getAllEntries();
        setEntries(data.entries);
        setStreak(data.streak);

        // Filter to entries with writing content, migrating from old to new format
        const dates = data.entries
          .filter(
            (entry) =>
              (entry.activityContent?.writing &&
                entry.activityContent.writing.trim()) ||
              (entry.content && entry.content.trim())
          )
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
        const response = await api.getEntry(selectedDate);
        console.log("API Response:", response); // Debug: Log full response

        const { content, activityContent } = response;

        // Debug logs to help diagnose the issue
        console.log("Content from API:", content);
        console.log("Activity content from API:", activityContent);

        // Only reset content if we have actual data to set
        // This prevents wiping out the UI when empty data is returned
        const hasActivityContent =
          activityContent &&
          Object.keys(activityContent).length > 0 &&
          (activityContent.writing ||
            activityContent.gratitude ||
            activityContent.affirmations);

        const hasContent = content && content.trim().length > 0;

        if (!hasActivityContent && !hasContent) {
          console.log("No content received from API, keeping current state");
          return; // Don't reset if no content found
        }

        // Reset entry values
        setCurrentEntry("");
        setGratitudeEntry("");
        setAffirmationsEntry("");

        // Load saved activity data if available
        if (activityContent && Object.keys(activityContent).length > 0) {
          console.log("Loading from activityContent");

          // Set content for different activities
          if (activityContent.writing) {
            console.log("Found writing content:", activityContent.writing);
            setCurrentEntry(activityContent.writing);
          } else if (content && content.trim()) {
            // Backward compatibility: if writing not in activityContent but in content
            console.log("Using legacy content field:", content);
            setCurrentEntry(content);
          }

          if (activityContent.gratitude) {
            console.log("Found gratitude content:", activityContent.gratitude);
            setGratitudeEntry(activityContent.gratitude);
          }

          if (activityContent.affirmations) {
            console.log(
              "Found affirmations content:",
              activityContent.affirmations
            );
            setAffirmationsEntry(activityContent.affirmations);
          }

          // Restore last activity index if available and valid
          if (
            typeof activityContent.lastActivityIndex === "number" &&
            activityContent.lastActivityIndex >= 0 &&
            activityContent.lastActivityIndex < activities.length
          ) {
            console.log(
              "Restoring activity index:",
              activityContent.lastActivityIndex
            );
            setCurrentActivityIndex(activityContent.lastActivityIndex);
          }
        } else if (content && content.trim()) {
          // Backward compatibility if no activityContent but has content
          console.log("No activityContent, using legacy content:", content);
          setCurrentEntry(content);
        } else {
          console.log("No content or activityContent found");
        }

        // If either writing content or legacy content exists, consider writing already started
        if (
          (activityContent?.writing && activityContent.writing.trim()) ||
          (content && content.trim())
        ) {
          hasStartedWriting.current = true;
        } else {
          hasStartedWriting.current = false;
        }
      } catch (error) {
        console.error("Failed to load entry:", error);
      }
    };

    loadCurrentEntry();
  }, [selectedDate, activities.length]);

  // Debounced save function for all activity content
  const debouncedSave = useCallback(
    debounce(
      async (
        date: string,
        content: string,
        gratitudeText: string,
        affirmationsText: string,
        activityIndex: number
      ) => {
        try {
          setIsSaving(true);

          // Create activity content object to save all activities
          const activityContent: MorningActivityContent = {
            writing: content,
            gratitude: gratitudeText,
            affirmations: affirmationsText,
            lastActivityIndex: activityIndex,
          };

          console.log("Saving to API:", {
            date,
            contentLength: content?.length || 0,
            gratitudeLength: gratitudeText?.length || 0,
            affirmationsLength: affirmationsText?.length || 0,
            activityContent,
          });

          // Pass empty string for content (we'll use writing from activityContent)
          const saveResponse = await api.updateEntry(date, "", activityContent);
          console.log("Save response:", saveResponse);

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
                content: "", // Don't store in content anymore
                user_id: userId,
                activityContent,
              };
              return newEntries;
            } else {
              return [
                ...prevEntries,
                {
                  date,
                  content: "", // Don't store in content anymore
                  user_id: userId,
                  activityContent,
                },
              ];
            }
          });
        } catch (error) {
          console.error("Failed to save entry:", error);
        } finally {
          setIsSaving(false);
        }
      },
      500
    ),
    []
  );

  // Auto-save when any content changes
  useEffect(() => {
    // Only save if there's actual content to save
    if (currentEntry || gratitudeEntry || affirmationsEntry) {
      debouncedSave(
        selectedDate,
        currentEntry,
        gratitudeEntry,
        affirmationsEntry,
        currentActivityIndex
      );
    }
  }, [
    currentEntry,
    gratitudeEntry,
    affirmationsEntry,
    selectedDate,
    currentActivityIndex,
    debouncedSave,
  ]);

  // Refs for textarea/input elements
  const writingTextareaRef = useRef<HTMLTextAreaElement>(null);
  const gratitudeTextareaRef = useRef<HTMLTextAreaElement>(null);
  const affirmationsTextareaRef = useRef<HTMLTextAreaElement>(null);

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setHasPendingChanges(true);
    let newText = e.target.value;
    const lastChar = newText[e.target.selectionStart - 1];
    const textBeforeCursor = newText.slice(0, e.target.selectionStart);
    const textAfterCursor = newText.slice(e.target.selectionStart);
    const lastWord = textBeforeCursor.split("\n").pop()?.trim();

    // Start timer automatically if this is the first time typing
    if (!hasStartedWriting.current && newText.trim() !== "") {
      hasStartedWriting.current = true;
      if (!timerActive && !timerComplete) {
        startTimer();
      }
    }

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

  // Handle key press in textareas - Escape to exit
  const handleTextareaKeyDown = (
    e: React.KeyboardEvent<HTMLTextAreaElement>
  ) => {
    // Escape key exits textarea focus
    if (e.key === "Escape") {
      e.currentTarget.blur();
    }

    // Arrow keys for navigation when at the beginning or end of content
    if (
      (e.key === "ArrowLeft" || e.key === "ArrowUp") &&
      e.currentTarget.selectionStart === 0 &&
      e.currentTarget.selectionEnd === 0
    ) {
      e.currentTarget.blur();
      if (currentActivityIndex > 0) {
        prevActivity();
      }
      e.preventDefault();
    }

    if (
      (e.key === "ArrowRight" || e.key === "ArrowDown") &&
      e.currentTarget.selectionStart === e.currentTarget.value.length &&
      e.currentTarget.selectionEnd === e.currentTarget.value.length
    ) {
      e.currentTarget.blur();
      if (currentActivityIndex < activities.length - 1) {
        nextActivity();
      }
      e.preventDefault();
    }
  };

  const handleGratitudeChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setGratitudeEntry(e.target.value);
    setHasPendingChanges(true);
    // Start timer if first typing
    if (!timerActive && !timerComplete && e.target.value.trim() !== "") {
      startTimer();
    }
  };

  const handleAffirmationsChange = (
    e: React.ChangeEvent<HTMLTextAreaElement>
  ) => {
    setAffirmationsEntry(e.target.value);
    setHasPendingChanges(true);
    // Start timer if first typing
    if (!timerActive && !timerComplete && e.target.value.trim() !== "") {
      startTimer();
    }
  };

  const handleDateChange = (date: Date) => {
    setSelectedDate(date.toISOString().split("T")[0]);
    setIsCalendarOpen(false);
  };

  // Get icon for activity type
  const getActivityIcon = (type: MorningActivity["type"]) => {
    switch (type) {
      case "writing":
        return <PenLine className="w-5 h-5 text-blue-500 dark:text-blue-400" />;
      case "visualization":
        return <Eye className="w-5 h-5 text-purple-500 dark:text-purple-400" />;
      case "gratitude":
        return <Heart className="w-5 h-5 text-red-500 dark:text-red-400" />;
      case "affirmations":
        return (
          <Star className="w-5 h-5 text-yellow-500 dark:text-yellow-400" />
        );
      case "breathwork":
        return <Wind className="w-5 h-5 text-cyan-500 dark:text-cyan-400" />;
    }
  };

  // Current activity
  const currentActivity = activities[currentActivityIndex];

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle if not in an input or after blur
      if (
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLInputElement
      ) {
        return;
      }

      if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        if (currentActivityIndex < activities.length - 1) {
          nextActivity();
        }
      } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        if (currentActivityIndex > 0) {
          prevActivity();
        }
      } else if (e.key === "Enter") {
        // Focus the appropriate textarea based on current activity
        if (currentActivity.type === "writing") {
          writingTextareaRef.current?.focus();
        } else if (currentActivity.type === "gratitude") {
          gratitudeTextareaRef.current?.focus();
        } else if (currentActivity.type === "affirmations") {
          affirmationsTextareaRef.current?.focus();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [
    currentActivityIndex,
    activities.length,
    nextActivity,
    prevActivity,
    currentActivity,
  ]);

  // Start timer when changing to visualization or breathwork
  useEffect(() => {
    // Start timer automatically if the current activity is visualization or breathwork
    if (
      (currentActivity.type === "visualization" ||
        currentActivity.type === "breathwork") &&
      !timerActive &&
      !timerComplete
    ) {
      startTimer();
    }
  }, [
    currentActivityIndex,
    currentActivity,
    timerActive,
    timerComplete,
    startTimer,
  ]);

  return (
    <div className="max-w-4xl mx-auto p-8 dark:bg-slate-900">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2 px-4 py-2 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
            <Star className="w-5 h-5 text-yellow-500" />
            <span className="text-slate-700 dark:text-slate-200">
              {streak} day streak
            </span>
          </div>

          {/* Day of week indicator */}
          {currentDayOfWeek && (
            <div className="flex items-center space-x-2 px-4 py-2 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
              <CalendarDays className="w-5 h-5 text-purple-500 dark:text-purple-400" />
              <span className="text-slate-700 dark:text-slate-200">
                {currentDayOfWeek}
              </span>
            </div>
          )}

          {/* Timer display */}
          <div
            className={`flex items-center space-x-2 px-4 py-2 rounded-lg border ${
              timerComplete
                ? "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800"
                : timerActive
                ? "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800"
                : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700"
            }`}
          >
            <Timer
              className={`w-5 h-5 ${
                timerComplete
                  ? "text-green-500 dark:text-green-400"
                  : timerActive
                  ? "text-blue-500 dark:text-blue-400"
                  : "text-slate-500 dark:text-slate-400"
              }`}
            />
            <span
              className={`${
                timerComplete
                  ? "text-green-700 dark:text-green-300"
                  : timerActive
                  ? "text-blue-700 dark:text-blue-300"
                  : "text-slate-700 dark:text-slate-200"
              }`}
            >
              {formatTime(timeRemaining)}
            </span>
            <div className="flex space-x-1 ml-1">
              {timerActive ? (
                <button
                  onClick={pauseTimer}
                  className="p-1 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700"
                  title="Pause timer"
                >
                  <Pause className="w-4 h-4 text-slate-600 dark:text-slate-300" />
                </button>
              ) : (
                <button
                  onClick={startTimer}
                  className="p-1 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700"
                  title="Start timer"
                >
                  <Play className="w-4 h-4 text-slate-600 dark:text-slate-300" />
                </button>
              )}
              <button
                onClick={resetTimer}
                className="p-1 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700"
                title="Reset timer"
              >
                <RefreshCw className="w-4 h-4 text-slate-600 dark:text-slate-300" />
              </button>
            </div>
          </div>
        </div>
        <div className="relative flex items-center space-x-2">
          <button
            onClick={() => setIsCalendarOpen(!isCalendarOpen)}
            className="flex items-center space-x-2 px-4 py-2 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700"
          >
            <Calendar className="w-4 h-4 text-slate-500 dark:text-slate-400" />
            {isSaving || hasPendingChanges ? (
              <Loader className="w-4 h-4 text-slate-500 dark:text-slate-400" />
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

      {/* Activity navigation controls */}
      {activities.length > 1 && (
        <div className="mb-4 flex items-center justify-between bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-3">
          <button
            onClick={prevActivity}
            disabled={currentActivityIndex === 0}
            className={`flex items-center px-3 py-1.5 rounded ${
              currentActivityIndex === 0
                ? "text-slate-400 dark:text-slate-600"
                : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
            }`}
            title="Previous (← or ↑ key)"
          >
            <ChevronUp className="w-4 h-4 mr-1" />
            Previous
          </button>

          <div className="flex items-center space-x-2">
            {getActivityIcon(currentActivity.type)}
            <span className="text-slate-700 dark:text-slate-300 font-medium">
              {currentActivity.title}
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400 m-0">
              {currentActivityIndex + 1} of {activities.length}
            </span>
          </div>

          <button
            onClick={nextActivity}
            disabled={currentActivityIndex === activities.length - 1}
            className={`flex items-center px-3 py-1.5 rounded ${
              currentActivityIndex === activities.length - 1
                ? "text-slate-400 dark:text-slate-600"
                : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
            }`}
            title="Next (→ or ↓ key)"
          >
            Next
            <ChevronDown className="w-4 h-4 ml-1" />
          </button>
        </div>
      )}

      {/* Timer completion notification */}
      {timerComplete && (
        <div className="mb-4 p-4 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-800 dark:text-green-200 flex items-center justify-between">
          <div className="flex items-center">
            <Check className="w-5 h-5 mr-2" />
            <span>{currentActivity.timerMinutes}-minute session complete!</span>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={resetTimer}
              className="px-3 py-1 bg-green-100 dark:bg-green-800 rounded-md text-sm hover:bg-green-200 dark:hover:bg-green-700"
            >
              Restart
            </button>
            {currentActivityIndex < activities.length - 1 && (
              <button
                onClick={nextActivity}
                className="px-3 py-1 bg-blue-100 dark:bg-blue-800 text-blue-800 dark:text-blue-200 rounded-md text-sm hover:bg-blue-200 dark:hover:bg-blue-700"
              >
                Next Activity
              </button>
            )}
          </div>
        </div>
      )}

      {/* Different activity types */}
      <div className="w-full mt-4">
        {/* Stream of Consciousness Writing */}
        {currentActivity.type === "writing" && (
          <textarea
            ref={writingTextareaRef}
            value={currentEntry}
            onChange={handleTextChange}
            onKeyDown={handleTextareaKeyDown}
            placeholder="Write your morning entry here..."
            className="w-full h-[calc(100vh-16rem)] p-6 rounded-lg bg-white dark:bg-slate-800 shadow-sm border border-slate-100 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-200 dark:focus:ring-slate-600 resize-none font-sans text-slate-700 dark:text-slate-200 text-lg leading-relaxed placeholder-slate-400 dark:placeholder-slate-500"
            spellCheck="true"
          />
        )}

        {/* Visualization */}
        {currentActivity.type === "visualization" && (
          <div className="w-full h-[calc(100vh-16rem)] p-6 rounded-lg bg-white dark:bg-slate-800 shadow-sm border border-slate-100 dark:border-slate-700 flex flex-col">
            {timerComplete && (
              <div className="mb-4 text-sm text-green-600 dark:text-green-400 flex items-center self-end">
                <Check className="w-4 h-4 mr-1" /> Complete
              </div>
            )}
            <div className="flex-grow flex flex-col justify-center items-center">
              <div className="max-w-2xl text-center space-y-4">
                <p className="text-lg text-slate-700 dark:text-slate-200 leading-relaxed whitespace-pre-line">
                  {currentActivity.text ||
                    "Close your eyes and visualize your goals. Imagine yourself achieving them in vivid detail."}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Gratitude */}
        {currentActivity.type === "gratitude" && (
          <div className="w-full h-[calc(100vh-16rem)] p-6 rounded-lg bg-white dark:bg-slate-800 shadow-sm border border-slate-100 dark:border-slate-700 flex flex-col">
            <textarea
              ref={gratitudeTextareaRef}
              value={gratitudeEntry}
              onChange={handleGratitudeChange}
              onKeyDown={handleTextareaKeyDown}
              placeholder="Write down things you're grateful for..."
              className="w-full h-full p-0 bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-200 dark:focus:ring-slate-600 resize-none font-sans text-slate-700 dark:text-slate-200 text-lg leading-relaxed placeholder-slate-400 dark:placeholder-slate-500 border-0"
              spellCheck="true"
            />
          </div>
        )}

        {/* Affirmations */}
        {currentActivity.type === "affirmations" && (
          <div className="w-full h-[calc(100vh-16rem)] p-6 rounded-lg bg-white dark:bg-slate-800 shadow-sm border border-slate-100 dark:border-slate-700 flex flex-col">
            <textarea
              ref={affirmationsTextareaRef}
              value={affirmationsEntry}
              onChange={handleAffirmationsChange}
              onKeyDown={handleTextareaKeyDown}
              placeholder="Write your positive affirmations here..."
              className="w-full h-full p-0 bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-200 dark:focus:ring-slate-600 resize-none font-sans text-slate-700 dark:text-slate-200 text-lg leading-relaxed placeholder-slate-400 dark:placeholder-slate-500 border-0"
              spellCheck="true"
            />
          </div>
        )}

        {/* Breathwork */}
        {currentActivity.type === "breathwork" && (
          <div className="w-full h-[calc(100vh-16rem)] p-6 rounded-lg bg-white dark:bg-slate-800 shadow-sm border border-slate-100 dark:border-slate-700 flex flex-col">
            {timerComplete && (
              <div className="mb-4 text-sm text-green-600 dark:text-green-400 flex items-center self-end">
                <Check className="w-4 h-4 mr-1" /> Complete
              </div>
            )}
            <div className="flex-grow flex flex-col justify-center items-center">
              <div className="max-w-2xl text-center">
                <p className="text-lg text-slate-700 dark:text-slate-200 leading-relaxed whitespace-pre-line">
                  {currentActivity.text ||
                    `1. Sit comfortably with your back straight
2. Breathe in deeply through your nose for 4 counts
3. Hold your breath for 4 counts
4. Exhale through your mouth for 6 counts
5. Repeat for 5-10 cycles`}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Morning;
