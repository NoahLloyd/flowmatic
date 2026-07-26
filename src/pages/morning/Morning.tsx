import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  Calendar,
  Star,
  Check,
  Loader,
  Play,
  Pause,
  RefreshCw,
  PenLine,
  Eye,
  Heart,
  Wind,
  CheckSquare,
  EyeOff,
  CircleOff,
} from "lucide-react";
import { api } from "../../utils/api";
import {
  MorningEntry,
  MorningActivity,
  DayOfWeek,
  MorningActivityContent,
  MorningDistraction,
} from "../../types/Morning";
import { useAuth } from "../../context/AuthContext";
import { debounce } from "lodash";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { useTimezone } from "../../context/TimezoneContext";
import MorningTasks from "./MorningTasks";
import { pickNextPrompt, recordPromptShown } from "../../utils/promptPicker";

const DISTRACTION_STORAGE_PREFIX = "morningDistractions:";
const ACTIVE_DISTRACTION_KEY = "morningActiveDistraction";
const MIN_DISTRACTION_MS = 1000;

interface ActiveDistraction {
  id: string;
  date: string;
  startedAt: string;
  activityId: string;
  remainingTimerSeconds: number;
}

const getStoredDistractions = (date: string): MorningDistraction[] => {
  try {
    const stored = localStorage.getItem(DISTRACTION_STORAGE_PREFIX + date);
    if (!stored) return [];
    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const storeDistractions = (
  date: string,
  distractions: MorningDistraction[]
) => {
  localStorage.setItem(
    DISTRACTION_STORAGE_PREFIX + date,
    JSON.stringify(distractions)
  );
};

const mergeDistractions = (
  ...groups: MorningDistraction[][]
): MorningDistraction[] => {
  const byId = new Map<string, MorningDistraction>();
  groups.flat().forEach((distraction) => {
    if (distraction?.id) byId.set(distraction.id, distraction);
  });
  return Array.from(byId.values()).sort(
    (a, b) =>
      new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime()
  );
};

const readActiveDistraction = (): ActiveDistraction | null => {
  try {
    const stored = localStorage.getItem(ACTIVE_DISTRACTION_KEY);
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
};

const Morning = () => {
  const { user } = useAuth();
  const { timezone, getUserTimezone } = useTimezone();

  const [entries, setEntries] = useState<MorningEntry[]>([]);
  const [currentEntry, setCurrentEntry] = useState("");
  const [streak, setStreak] = useState(0);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [hasPendingChanges, setHasPendingChanges] = useState(false);
  const [highlightedDates, setHighlightedDates] = useState<Date[]>([]);
  const [distractions, setDistractions] = useState<MorningDistraction[]>([]);

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

  const [selectedDate, setSelectedDate] = useState(getTodayInUserTimezone());

  // Keep track of today's day of week
  const [currentDayOfWeek, setCurrentDayOfWeek] = useState<string>("");

  // Refs let focus and unmount listeners read the latest tracking state
  // without rebinding on every timer tick.
  const selectedDateRef = useRef(selectedDate);
  const trackedActivityIdRef = useRef("writing");
  const shouldTrackDistractionsRef = useRef(false);
  const remainingTimerSecondsRef = useRef(timeRemaining);

  useEffect(() => {
    selectedDateRef.current = selectedDate;
    trackedActivityIdRef.current =
      activities[currentActivityIndex]?.id || "writing";
    remainingTimerSecondsRef.current = timeRemaining;
    shouldTrackDistractionsRef.current =
      timerActive && selectedDate === getTodayInUserTimezone();
  }, [
    selectedDate,
    activities,
    currentActivityIndex,
    timerActive,
    timeRemaining,
    timezone,
  ]);

  const beginDistraction = useCallback(() => {
    if (!shouldTrackDistractionsRef.current || readActiveDistraction()) return;

    const now = new Date();
    const active: ActiveDistraction = {
      id: `distraction-${now.getTime()}-${Math.random()
        .toString(36)
        .slice(2)}`,
      date: selectedDateRef.current,
      startedAt: now.toISOString(),
      activityId: trackedActivityIdRef.current,
      remainingTimerSeconds: remainingTimerSecondsRef.current,
    };
    localStorage.setItem(ACTIVE_DISTRACTION_KEY, JSON.stringify(active));
  }, []);

  const finishDistraction = useCallback(() => {
    const active = readActiveDistraction();
    if (!active) return;

    localStorage.removeItem(ACTIVE_DISTRACTION_KEY);
    const endedAt = new Date();
    const elapsedMs =
      endedAt.getTime() - new Date(active.startedAt).getTime();
    const maximumDurationMs =
      typeof active.remainingTimerSeconds === "number"
        ? Math.max(0, active.remainingTimerSeconds) * 1000
        : elapsedMs;
    const durationMs = Math.min(
      elapsedMs,
      maximumDurationMs
    );
    if (!Number.isFinite(durationMs) || durationMs < MIN_DISTRACTION_MS) return;

    const completed: MorningDistraction = {
      id: active.id,
      startedAt: active.startedAt,
      endedAt: endedAt.toISOString(),
      durationSeconds: Math.max(1, Math.round(durationMs / 1000)),
      activityId: active.activityId,
    };

    const stored = getStoredDistractions(active.date);
    const next = mergeDistractions(stored, [completed]);
    storeDistractions(active.date, next);

    if (selectedDateRef.current === active.date) {
      setDistractions((current) => mergeDistractions(current, next));
    }
  }, []);

  // Electron reports whether any Flowmatic window is focused. In a regular
  // browser preview, fall back to the standard focus/visibility events.
  useEffect(() => {
    const handleFocusChanged = (isFocused: boolean) => {
      if (isFocused) finishDistraction();
      else beginDistraction();
    };
    const handleWindowFocus = () => finishDistraction();
    const handleWindowBlur = () => beginDistraction();
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") beginDistraction();
      else finishDistraction();
    };

    let focusListenerId: number | undefined;
    if (window.electron?.on) {
      focusListenerId = window.electron.on(
        "flowmatic-focus-changed",
        handleFocusChanged
      );
    } else {
      window.addEventListener("focus", handleWindowFocus);
      window.addEventListener("blur", handleWindowBlur);
      document.addEventListener("visibilitychange", handleVisibilityChange);
    }

    window.addEventListener("beforeunload", beginDistraction);
    finishDistraction();

    return () => {
      window.removeEventListener("beforeunload", beginDistraction);
      window.removeEventListener("focus", handleWindowFocus);
      window.removeEventListener("blur", handleWindowBlur);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      if (
        focusListenerId !== undefined &&
        window.electron?.removeListener
      ) {
        window.electron.removeListener(
          "flowmatic-focus-changed",
          focusListenerId
        );
      }
    };
  }, [beginDistraction, finishDistraction]);

  // Navigating to another Flowmatic page unmounts Morning without blurring the
  // app, so start the away interval during unmount as well.
  useEffect(
    () => () => {
      beginDistraction();
    },
    [beginDistraction]
  );

  // Function to get today's date in YYYY-MM-DD format in user's timezone
  function getTodayInUserTimezone() {
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
  }

  const formatTimerTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    return `${minutes} min`;
  };

  const distractionSeconds = distractions.reduce(
    (total, distraction) => total + distraction.durationSeconds,
    0
  );

  const formatDistractionTime = (seconds: number) => {
    if (seconds < 60) return `${seconds}s away`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    if (minutes < 60) {
      return `${minutes}m${
        remainingSeconds ? ` ${remainingSeconds}s` : ""
      } away`;
    }
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return `${hours}h${remainingMinutes ? ` ${remainingMinutes}m` : ""} away`;
  };

  const formatDuration = (seconds: number) =>
    formatDistractionTime(seconds).replace(" away", "");

  const formatSelectedDate = (date: string) =>
    new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      weekday: "short",
      month: "short",
      day: "numeric",
    }).format(new Date(`${date}T12:00:00`));

  const recentDistractions = [...distractions]
    .sort(
      (a, b) =>
        new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
    )
    .slice(0, 4);

  // Load activities from user preferences
  useEffect(() => {
    if (user?.preferences?.weeklyMorningSchedule) {
      // Get current day of the week based on user's timezone
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

      // Get the day of the week in the user's timezone
      const currentDay =
        daysOfWeek[
          new Date(
            new Intl.DateTimeFormat("en-US", {
              timeZone: timezone,
            }).format(today)
          ).getDay()
        ];

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
  }, [user, timezone]);

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
      const nextActivityIndex = currentActivityIndex + 1;
      const nextActivityItem = activities[nextActivityIndex];

      // Just move to the next activity
      setCurrentActivityIndex(nextActivityIndex);
      setTimerComplete(false);

      // Reset timer for new activity
      if (nextActivityItem && nextActivityItem.timerMinutes) {
        setTimeRemaining(nextActivityItem.timerMinutes * 60);
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
      const locallyStoredDistractions = getStoredDistractions(selectedDate);
      setDistractions(locallyStoredDistractions);

      try {
        const response = await api.getEntry(selectedDate);
        const { content, activityContent } = response;

        // Only reset content if we have actual data to set
        // This prevents wiping out the UI when empty data is returned
        const hasActivityContent =
          activityContent &&
          Object.keys(activityContent).length > 0;

        const hasContent = content && content.trim().length > 0;

        if (!hasActivityContent && !hasContent) {
          return; // Don't reset if no content found
        }

        // Reset entry values
        setCurrentEntry("");
        setGratitudeEntry("");
        setAffirmationsEntry("");

        // Load saved activity data if available
        if (activityContent && Object.keys(activityContent).length > 0) {
          // Set content for different activities
          if (activityContent.writing) {
            setCurrentEntry(activityContent.writing);
          } else if (content && content.trim()) {
            // Backward compatibility: if writing not in activityContent but in content
            setCurrentEntry(content);
          }

          if (activityContent.gratitude) {
            setGratitudeEntry(activityContent.gratitude);
          }

          if (activityContent.affirmations) {
            setAffirmationsEntry(activityContent.affirmations);
          }

          const mergedDistractions = mergeDistractions(
            activityContent.distractions || [],
            locallyStoredDistractions
          );
          setDistractions((current) => {
            const next = mergeDistractions(current, mergedDistractions);
            storeDistractions(selectedDate, next);
            return next;
          });

          // Restore last activity index if available and valid
          if (
            typeof activityContent.lastActivityIndex === "number" &&
            activityContent.lastActivityIndex >= 0 &&
            activityContent.lastActivityIndex < activities.length
          ) {
            setCurrentActivityIndex(activityContent.lastActivityIndex);
          }
        } else if (content && content.trim()) {
          // Backward compatibility if no activityContent but has content
          setCurrentEntry(content);
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
        activityIndex: number,
        distractionEvents: MorningDistraction[]
      ) => {
        try {
          setIsSaving(true);

          // Create activity content object to save all activities
          const activityContent: MorningActivityContent = {
            writing: content,
            gratitude: gratitudeText,
            affirmations: affirmationsText,
            lastActivityIndex: activityIndex,
            distractions: distractionEvents,
          };

          // Pass empty string for content (we'll use writing from activityContent)
          const saveResponse = await api.updateEntry(date, "", activityContent);

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

          // Dispatch event to notify other components (like SignalsContext) that morning entry has been updated
          // This will update the journaling signal in real-time
          window.dispatchEvent(new CustomEvent("morningEntryUpdated"));
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
    if (
      currentEntry ||
      gratitudeEntry ||
      affirmationsEntry ||
      distractions.length > 0
    ) {
      debouncedSave(
        selectedDate,
        currentEntry,
        gratitudeEntry,
        affirmationsEntry,
        currentActivityIndex,
        distractions
      );
    }
  }, [
    currentEntry,
    gratitudeEntry,
    affirmationsEntry,
    selectedDate,
    currentActivityIndex,
    distractions,
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

  // Handle date change in user's timezone
  const handleDateChange = (date: Date) => {
    try {
      // Format the selected date in the user's timezone
      const dateParts = new Intl.DateTimeFormat("en-US", {
        timeZone: timezone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).formatToParts(date);

      // Extract date parts and format as YYYY-MM-DD
      const month =
        dateParts.find((part) => part.type === "month")?.value || "01";
      const day = dateParts.find((part) => part.type === "day")?.value || "01";
      const year =
        dateParts.find((part) => part.type === "year")?.value || "2023";

      const formattedDate = `${year}-${month}-${day}`;
      setSelectedDate(formattedDate);
      setIsCalendarOpen(false);
    } catch (error) {
      console.error("Error formatting selected date with timezone:", error);
      // Fallback to UTC if there's an error
      setSelectedDate(date.toISOString().split("T")[0]);
      setIsCalendarOpen(false);
    }
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
      case "tasks":
        return (
          <CheckSquare className="w-5 h-5 text-emerald-500 dark:text-emerald-400" />
        );
    }
  };

  // Current activity
  const currentActivity = activities[currentActivityIndex];

  // Currently displayed writing prompt for this activity, if any. Picked
  // once per (activity-id, date) so the user gets a stable prompt within
  // the session but a fresh one tomorrow.
  const [activePrompt, setActivePrompt] = useState<string | null>(null);
  useEffect(() => {
    if (
      currentActivity?.type === "writing" &&
      currentActivity.prompts &&
      currentActivity.prompts.length > 0
    ) {
      const key = `${currentActivity.id}:${selectedDate}`;
      const stored = localStorage.getItem("activePromptByKey:" + key);
      if (stored && currentActivity.prompts.includes(stored)) {
        setActivePrompt(stored);
        return;
      }
      const pick = pickNextPrompt(currentActivity.prompts, currentActivity.id);
      if (pick) {
        recordPromptShown(pick, currentActivity.id);
        localStorage.setItem("activePromptByKey:" + key, pick);
        setActivePrompt(pick);
      } else {
        setActivePrompt(null);
      }
    } else {
      setActivePrompt(null);
    }
  }, [
    currentActivity?.id,
    currentActivity?.type,
    currentActivity?.prompts,
    selectedDate,
  ]);

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

      // When the tasks activity is active, let MorningTasks handle all keyboard input
      if (currentActivity?.type === "tasks") {
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
      } else if (e.key === "Enter" || e.key === "f") {
        // Prevent default only for 'f' key to avoid inserting character into input
        if (e.key === "f") {
          e.preventDefault();
        }

        // Focus the appropriate textarea based on current activity
        if (currentActivity?.type === "writing") {
          writingTextareaRef.current?.focus();
        } else if (currentActivity?.type === "gratitude") {
          gratitudeTextareaRef.current?.focus();
        } else if (currentActivity?.type === "affirmations") {
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
      currentActivity &&
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

  const [isTextBlurred, setIsTextBlurred] = useState(false);

  // Add global keyboard shortcut for blur toggle
  useEffect(() => {
    const handleBlurShortcut = (e: KeyboardEvent) => {
      // Alt+B to toggle blur
      if (e.key === "$") {
        e.preventDefault();
        setIsTextBlurred((prev) => !prev);
      }
    };

    window.addEventListener("keydown", handleBlurShortcut);
    return () => {
      window.removeEventListener("keydown", handleBlurShortcut);
    };
  }, []);

  // Toggle blur state
  const toggleBlur = () => {
    setIsTextBlurred((prev) => !prev);
  };

  // Update when timezone changes
  useEffect(() => {
    // Update selected date when timezone changes
    const newToday = getTodayInUserTimezone();
    setSelectedDate(newToday);
  }, [timezone]);

  return (
    <div className="mx-auto w-full max-w-[1500px] p-2 dark:bg-slate-900">
      <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[190px_minmax(0,1fr)_250px]">
        <aside className="xl:sticky xl:top-2">
          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-4 dark:border-slate-700">
              <span
                className={`text-2xl font-medium tracking-tight ${
                  timerComplete
                    ? "text-green-600 dark:text-green-400"
                    : timerActive
                    ? "text-blue-600 dark:text-blue-400"
                    : "text-slate-800 dark:text-white"
                }`}
              >
                {formatTimerTime(timeRemaining)}
              </span>
              <div className="flex items-center gap-1">
                {timerActive ? (
                  <button
                    onClick={pauseTimer}
                    className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
                    title="Pause timer"
                  >
                    <Pause className="h-3.5 w-3.5" />
                  </button>
                ) : (
                  <button
                    onClick={startTimer}
                    className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
                    title="Start timer"
                  >
                    <Play className="h-3.5 w-3.5" />
                  </button>
                )}
                <button
                  onClick={resetTimer}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-700 dark:hover:text-slate-200"
                  title="Reset timer"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            <div className="p-2">
              {activities.map((activity, index) => {
                const isActive = index === currentActivityIndex;
                return (
                  <button
                    key={activity.id}
                    onClick={() => setCurrentActivityIndex(index)}
                    className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm transition-colors ${
                      isActive
                        ? "bg-slate-100 font-medium text-slate-900 dark:bg-slate-700 dark:text-white"
                        : "text-slate-500 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-700/60"
                    }`}
                  >
                    {getActivityIcon(activity.type)}
                    <span className="truncate">
                      {activity.type.charAt(0).toUpperCase() +
                        activity.type.slice(1)}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="grid grid-cols-2 border-t border-slate-100 dark:border-slate-700">
              <button
                onClick={toggleBlur}
                title={
                  isTextBlurred ? "Show text (Alt+B)" : "Blur text (Alt+B)"
                }
                className="flex items-center justify-center gap-1.5 border-r border-slate-100 px-2 py-3 text-xs text-slate-500 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-700"
              >
                {isTextBlurred ? (
                  <Eye className="h-3.5 w-3.5" />
                ) : (
                  <EyeOff className="h-3.5 w-3.5" />
                )}
                {isTextBlurred ? "Show" : "Blur"}
              </button>
              <div className="flex items-center justify-center gap-1.5 px-2 py-3 text-xs text-slate-500 dark:text-slate-400">
                <Star className="h-3.5 w-3.5 text-yellow-500" />
                {streak} {streak === 1 ? "day" : "days"}
              </div>
            </div>
          </section>
        </aside>

        <main className="min-w-0">
          <header className="mb-4 flex min-h-[48px] items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-2.5">
              {getActivityIcon(currentActivity?.type || "writing")}
              <h1 className="truncate text-lg font-semibold text-slate-800 dark:text-white">
                {currentActivity?.title || "Morning"}
              </h1>
            </div>

            <div className="relative">
              <button
                onClick={() => setIsCalendarOpen(!isCalendarOpen)}
                className="flex items-center gap-2.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-left hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700"
              >
                <Calendar className="h-4 w-4 text-slate-400" />
                <span>
                  <span className="block text-xs font-medium text-slate-700 dark:text-slate-200">
                    {selectedDate === getTodayInUserTimezone()
                      ? "Today"
                      : "Journal"}
                  </span>
                  <span className="block text-[10px] text-slate-400 dark:text-slate-500">
                    {formatSelectedDate(selectedDate)}
                  </span>
                </span>
                {isSaving || hasPendingChanges ? (
                  <Loader className="h-4 w-4 text-slate-400" />
                ) : lastSaved ? (
                  <Check className="h-4 w-4 text-green-500" />
                ) : null}
              </button>
              {isCalendarOpen && (
                <div className="absolute right-0 top-full z-50 mt-2">
                  <DatePicker
                    selected={new Date(selectedDate)}
                    onChange={handleDateChange}
                    inline
                    maxDate={new Date()}
                    highlightDates={highlightedDates}
                    dayClassName={(date) =>
                      highlightedDates.some((d) => {
                        const dateParts = new Intl.DateTimeFormat("en-US", {
                          timeZone: timezone,
                          year: "numeric",
                          month: "2-digit",
                          day: "2-digit",
                        }).formatToParts(date);

                        const month =
                          dateParts.find((part) => part.type === "month")
                            ?.value || "01";
                        const day =
                          dateParts.find((part) => part.type === "day")?.value ||
                          "01";
                        const year =
                          dateParts.find((part) => part.type === "year")
                            ?.value || "2023";

                        const formattedDate = `${year}-${month}-${day}`;
                        const entryDateString = d.toISOString().split("T")[0];

                        return entryDateString === formattedDate;
                      })
                        ? "highlighted-date"
                        : undefined
                    }
                  />
                </div>
              )}
            </div>
          </header>

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
          <div className="flex flex-col gap-3 h-[calc(100vh-16rem)]">
            {activePrompt && (
              <div className="px-5 py-3 rounded-lg bg-amber-50/70 dark:bg-amber-900/20 border border-amber-200/70 dark:border-amber-800/40 text-amber-900 dark:text-amber-100 text-base leading-snug shrink-0">
                <span className="text-[10px] uppercase tracking-wider font-semibold text-amber-600 dark:text-amber-400 mr-2">
                  Prompt
                </span>
                {activePrompt}
              </div>
            )}
            <textarea
              ref={writingTextareaRef}
              value={currentEntry}
              onChange={handleTextChange}
              onKeyDown={handleTextareaKeyDown}
              placeholder={
                activePrompt
                  ? "Write in response to the prompt..."
                  : "Write your morning entry here..."
              }
              className={`w-full flex-1 min-h-0 p-6 rounded-lg bg-white dark:bg-slate-800 shadow-sm border border-slate-100 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-200 dark:focus:ring-slate-600 resize-none font-sans text-slate-700 dark:text-slate-200 text-lg leading-relaxed placeholder-slate-400 dark:placeholder-slate-500 ${
                isTextBlurred ? "blur-sm" : ""
              }`}
              spellCheck="true"
            />
          </div>
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
              className={`w-full h-full p-0 bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-200 dark:focus:ring-slate-600 resize-none font-sans text-slate-700 dark:text-slate-200 text-lg leading-relaxed placeholder-slate-400 dark:placeholder-slate-500 border-0 ${
                isTextBlurred ? "blur-sm" : ""
              }`}
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
              className={`w-full h-full p-0 bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-200 dark:focus:ring-slate-600 resize-none font-sans text-slate-700 dark:text-slate-200 text-lg leading-relaxed placeholder-slate-400 dark:placeholder-slate-500 border-0 ${
                isTextBlurred ? "blur-sm" : ""
              }`}
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

        {/* Tasks */}
        {currentActivity?.type === "tasks" && <MorningTasks />}
          </div>
        </main>

        <aside className="xl:sticky xl:top-2">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-800">
            <div className="mb-5 flex items-center gap-2">
              <CircleOff className="h-4 w-4 text-amber-500 dark:text-amber-400" />
              <h2 className="text-sm font-semibold text-slate-800 dark:text-white">
                Distractions
              </h2>
            </div>

            <div className="mb-6 grid grid-cols-2">
              <div className="border-r border-slate-100 pr-4 dark:border-slate-700">
                <div
                  data-testid="distraction-count"
                  className="text-4xl font-semibold leading-none text-slate-900 dark:text-white"
                >
                  {distractions.length}
                </div>
                <div className="mt-1.5 text-xs text-slate-400 dark:text-slate-500">
                  {distractions.length === 1 ? "time" : "times"}
                </div>
              </div>
              <div className="pl-4">
                <div
                  data-testid="distraction-total"
                  className="text-lg font-semibold tabular-nums text-slate-800 dark:text-slate-100"
                >
                  {formatDuration(distractionSeconds)}
                </div>
                <div className="mt-1.5 text-xs text-slate-400 dark:text-slate-500">
                  away
                </div>
              </div>
            </div>

            <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400 dark:text-slate-500">
              Recent
            </div>
            {recentDistractions.length === 0 ? (
              <div className="pt-3 text-xs text-slate-400 dark:text-slate-500">
                None yet
              </div>
            ) : (
              <div className="mt-2 divide-y divide-slate-100 dark:divide-slate-700">
                {recentDistractions.map((distraction, index) => (
                  <div
                    key={distraction.id}
                    className="flex items-center justify-between py-2.5 text-xs"
                  >
                    <span className="text-slate-400 dark:text-slate-500">
                      #{distractions.length - index}
                    </span>
                    <span className="font-medium tabular-nums text-slate-700 dark:text-slate-200">
                      {formatDuration(distraction.durationSeconds)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
};

export default Morning;
