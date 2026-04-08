import React, { useState, useEffect, useCallback } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Flame,
  Check,
  Loader,
  CheckCircle2,
  Inbox,
  Plus,
  Trash2,
  ChevronDown,
} from "lucide-react";
import { api } from "../../utils/api";
import { useAuth } from "../../context/AuthContext";
import { useTimezone } from "../../context/TimezoneContext";
import { useToast } from "../../context/ToastContext";
import { debounce } from "lodash";
import {
  WeeklyReview,
  ChecklistItem,
  QuestionItem,
  ReviewStreak,
  DEFAULT_CHECKLIST_ITEMS,
  DEFAULT_QUESTIONS,
} from "../../types/Review";
import ChecklistSection from "./components/ChecklistSection";
import QuestionsSection from "./components/QuestionsSection";
import WeekInReview from "./components/WeekInReview";
import QuestionHistory from "./components/QuestionHistory";
import WeeklyTaskPlanner from "./components/WeeklyTaskPlanner";

type ChecklistConfigItem = Omit<ChecklistItem, "checked">;
type QuestionConfigItem = Omit<QuestionItem, "answer">;

type InboxItem = {
  id: string;
  text: string;
  checked: boolean;
};

const parseInboxItem = (raw: string, fallbackId: string): InboxItem => {
  // Backwards-compatible: older inbox_items are plain strings.
  // New format is JSON string: {"id": "...", "text": "...", "checked": true/false}
  try {
    const parsed = JSON.parse(raw) as Partial<InboxItem> | null;
    if (
      parsed &&
      typeof parsed === "object" &&
      typeof parsed.text === "string"
    ) {
      return {
        id: typeof parsed.id === "string" ? parsed.id : fallbackId,
        text: parsed.text,
        checked: Boolean(parsed.checked),
      };
    }
  } catch {
    // ignore
  }
  return { id: fallbackId, text: raw, checked: false };
};

const serializeInboxItems = (items: InboxItem[]): string[] =>
  items.map((item) =>
    JSON.stringify({ id: item.id, text: item.text, checked: item.checked })
  );

// Format a Date as YYYY-MM-DD in local time (avoids UTC shift from toISOString)
const toLocalDateString = (date: Date): string => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

// Helper to format a date as YYYY-MM-DD in a specific timezone
const formatDateInTimezone = (date: Date, timezone: string): string => {
  // Use Intl.DateTimeFormat with 'en-CA' locale which gives YYYY-MM-DD format
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return formatter.format(date);
};

// Helper to get the day of week (0=Sun, 6=Sat) in a specific timezone
const getDayOfWeekInTimezone = (date: Date, timezone: string): number => {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    weekday: "short",
  });
  const dayStr = formatter.format(date);
  const dayMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  return dayMap[dayStr] ?? 0;
};

// Helper to get the Monday of the current review week
// Week period is Mon-Sun. The review can be edited from Friday of that week
// through Tuesday of the following week.
// On Wed/Thu we show the upcoming week (which started Monday) but it's not editable yet.
// On Fri/Sat/Sun we show the current Mon-Sun week (editable).
// On Mon/Tue we show the previous Mon-Sun week (still editable).
const getReviewWeekStart = (date: Date, timezone: string): string => {
  try {
    const day = getDayOfWeekInTimezone(date, timezone);

    // We want the Monday of the week being reviewed.
    // Fri(5), Sat(6), Sun(0): the current calendar week's Monday
    // Mon(1), Tue(2): the previous calendar week's Monday
    // Wed(3), Thu(4): the current calendar week's Monday (upcoming, read-only preview)
    let daysToSubtract;
    if (day === 0) {
      // Sunday -> go back 6 to Monday
      daysToSubtract = 6;
    } else if (day <= 2) {
      // Mon(1), Tue(2) -> previous week's Monday: day + 6
      daysToSubtract = day + 6;
    } else {
      // Wed(3)-Sat(6) -> this week's Monday: day - 1
      daysToSubtract = day - 1;
    }

    const monday = new Date(
      date.getTime() - daysToSubtract * 24 * 60 * 60 * 1000
    );
    return formatDateInTimezone(monday, timezone);
  } catch (error) {
    console.error("Error getting week start:", error);
    const day = date.getDay();
    let daysToSubtract;
    if (day === 0) {
      daysToSubtract = 6;
    } else if (day <= 2) {
      daysToSubtract = day + 6;
    } else {
      daysToSubtract = day - 1;
    }
    const monday = new Date(
      date.getTime() - daysToSubtract * 24 * 60 * 60 * 1000
    );
    return toLocalDateString(monday);
  }
};

// Helper to get the Sunday (end of the review week)
const getWeekEnd = (weekStart: string): string => {
  const monday = new Date(weekStart + "T00:00:00");
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return toLocalDateString(sunday);
};

// Check if the review is currently in its editable window (Friday of the week through Tuesday after)
const isInEditableWindow = (weekStart: string, date: Date, timezone: string): boolean => {
  const day = getDayOfWeekInTimezone(date, timezone);
  const todayStr = formatDateInTimezone(date, timezone);
  const monday = new Date(weekStart + "T00:00:00");

  // Friday of the review week (day 4 after Monday)
  const friday = new Date(monday);
  friday.setDate(monday.getDate() + 4);
  const fridayStr = toLocalDateString(friday);

  // Tuesday after the review week (day 8 after Monday)
  const tuesday = new Date(monday);
  tuesday.setDate(monday.getDate() + 8);
  const tuesdayStr = toLocalDateString(tuesday);

  return todayStr >= fridayStr && todayStr <= tuesdayStr;
};

// Format week range for display
const formatWeekRange = (weekStart: string, weekEnd: string): string => {
  const start = new Date(weekStart + "T00:00:00");
  const end = new Date(weekEnd + "T00:00:00");
  const options: Intl.DateTimeFormatOptions = {
    month: "short",
    day: "numeric",
  };
  return `${start.toLocaleDateString(
    "en-US",
    options
  )} - ${end.toLocaleDateString("en-US", options)}`;
};

const Review: React.FC = () => {
  const { user } = useAuth();
  const { timezone } = useTimezone();
  const { showToast } = useToast();

  // The "home" week is the one getReviewWeekStart picks for today
  const homeWeekStart = getReviewWeekStart(new Date(), timezone);

  // Current week dates (may be navigated to a past week)
  const [weekStart, setWeekStart] = useState(() => homeWeekStart);
  const [weekEnd, setWeekEnd] = useState(() => getWeekEnd(weekStart));

  // Whether viewing a past (non-home) week — always read-only
  const isViewingPast = weekStart !== homeWeekStart;

  // Whether the current date falls in the review focus window (Fri-Tue).
  const inReviewWindow = isInEditableWindow(weekStart, new Date(), timezone);

  // Collapsible sections (questionHistory collapsed by default)
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(
    new Set(["questionHistory"])
  );
  const toggleSection = (key: string) => {
    setCollapsedSections((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // Week navigation
  const goToPreviousWeek = () => {
    const monday = new Date(weekStart + "T00:00:00");
    monday.setDate(monday.getDate() - 7);
    const newStart = toLocalDateString(monday);
    setWeekStart(newStart);
    setWeekEnd(getWeekEnd(newStart));
  };
  const goToNextWeek = () => {
    const monday = new Date(weekStart + "T00:00:00");
    monday.setDate(monday.getDate() + 7);
    const newStart = toLocalDateString(monday);
    // Don't go past the home week
    if (newStart > homeWeekStart) return;
    setWeekStart(newStart);
    setWeekEnd(getWeekEnd(newStart));
  };
  const goToCurrentWeek = () => {
    setWeekStart(homeWeekStart);
    setWeekEnd(getWeekEnd(homeWeekStart));
  };

  // Review state
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [questions, setQuestions] = useState<QuestionItem[]>([]);
  const [isCompleted, setIsCompleted] = useState(false);
  const [isEditing, setIsEditing] = useState(true);
  const [streak, setStreak] = useState<ReviewStreak>({
    current_streak: 0,
    longest_streak: 0,
  });

  // Quick capture inbox state
  const [inboxItems, setInboxItems] = useState<InboxItem[]>([]);
  const [newInboxItem, setNewInboxItem] = useState("");

  // UI state
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);

  // Get checklist items from user preferences or defaults
  const getChecklistConfig = useCallback((): ChecklistConfigItem[] => {
    if (user?.preferences?.reviewChecklistItems) {
      return user.preferences.reviewChecklistItems as ChecklistConfigItem[];
    }
    return DEFAULT_CHECKLIST_ITEMS;
  }, [user]);

  // Get questions from user preferences or defaults
  const getQuestionsConfig = useCallback((): QuestionConfigItem[] => {
    if (user?.preferences?.reviewQuestions) {
      return user.preferences.reviewQuestions as QuestionConfigItem[];
    }
    return DEFAULT_QUESTIONS;
  }, [user]);

  // Initialize checklist and questions with saved data or defaults
  const initializeForm = useCallback(
    (savedReview: WeeklyReview | null, viewOnly: boolean) => {
      const checklistConfig = getChecklistConfig();
      const questionsConfig = getQuestionsConfig();

      if (savedReview) {
        if (viewOnly) {
          // For past reviews, always prefer saved data directly so that
          // answers / checked state are displayed even if config has changed.
          const savedChecklist = savedReview.checklist ?? [];
          const savedQuestions = savedReview.questions ?? [];

          setChecklist(
            savedChecklist.length > 0
              ? savedChecklist
              : checklistConfig.map((item) => ({ ...item, checked: false }))
          );
          setQuestions(
            savedQuestions.length > 0
              ? savedQuestions
              : questionsConfig.map((item) => ({ ...item, answer: "" }))
          );
        } else {
          // For current week, merge saved data with latest config
          const savedChecklist = savedReview.checklist ?? [];
          const savedQuestions = savedReview.questions ?? [];

          const mergedChecklist = checklistConfig.map((item) => {
            const saved = savedChecklist.find((c) => c.id === item.id);
            return {
              ...item,
              checked: saved?.checked || false,
            };
          });

          const mergedQuestions = questionsConfig.map((item) => {
            const saved = savedQuestions.find((q) => q.id === item.id);
            return {
              ...item,
              answer: saved?.answer || "",
            };
          });

          setChecklist(mergedChecklist);
          setQuestions(mergedQuestions);
        }

        setIsCompleted(savedReview.is_completed);
        setIsEditing(!savedReview.is_completed);
        // Load inbox items if they exist
        const rawInbox = savedReview.inbox_items ?? [];
        setInboxItems(
          rawInbox.map((raw, idx) =>
            parseInboxItem(raw, `inbox-${savedReview.week_start}-${idx}`)
          )
        );
      } else {
        // Initialize with empty values
        setChecklist(
          checklistConfig.map((item) => ({ ...item, checked: false }))
        );
        setQuestions(questionsConfig.map((item) => ({ ...item, answer: "" })));
        setIsCompleted(false);
        setIsEditing(true);
        setInboxItems([]);
      }
    },
    [getChecklistConfig, getQuestionsConfig]
  );

  // Load review data — only re-run when weekStart changes.
  // We deliberately exclude initializeForm from deps to avoid
  // re-fetching every time user prefs settle (which recreates
  // getChecklistConfig → initializeForm). Instead we use a ref.
  const initializeFormRef = React.useRef(initializeForm);
  initializeFormRef.current = initializeForm;


  useEffect(() => {
    let cancelled = false;

    const loadReview = async () => {
      setIsLoading(true);
      try {
        const [review, streakData] = await Promise.all([
          api.getWeeklyReview(weekStart),
          api.getReviewStreak(),
        ]);

        if (cancelled) return;

        const viewOnly = weekStart !== homeWeekStart;
        initializeFormRef.current(review, viewOnly);
        setStreak(streakData);
      } catch (error) {
        console.error("Failed to load review:", error);
        if (!cancelled) {
          initializeFormRef.current(null, false);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    loadReview();

    return () => {
      cancelled = true;
    };
  }, [weekStart, homeWeekStart]);

  // Update week start when timezone changes
  useEffect(() => {
    const newWeekStart = getReviewWeekStart(new Date(), timezone);
    setWeekStart(newWeekStart);
    setWeekEnd(getWeekEnd(newWeekStart));
  }, [timezone]);

  // Debounced save function
  const debouncedSave = useCallback(
    debounce(
      async (
        weekStartDate: string,
        checklistData: ChecklistItem[],
        questionsData: QuestionItem[],
        completed: boolean,
        inbox: InboxItem[]
      ) => {
        try {
          setIsSaving(true);
          await api.saveWeeklyReview({
            week_start: weekStartDate,
            week_end: getWeekEnd(weekStartDate),
            checklist: checklistData,
            questions: questionsData,
            is_completed: completed,
            inbox_items: serializeInboxItems(inbox),
          });
          // Let other UI (e.g., sidebar indicator) refresh immediately
          window.dispatchEvent(new Event("weekly-review-updated"));
        } catch (error) {
          console.error("Failed to save review:", error);
        } finally {
          setIsSaving(false);
        }
      },
      1000
    ),
    []
  );

  // Auto-save when data changes (only for the current/home week)
  useEffect(() => {
    if (!isLoading && !isViewingPast && (checklist.length > 0 || questions.length > 0)) {
      debouncedSave(weekStart, checklist, questions, isCompleted, inboxItems);
    }
  }, [
    checklist,
    questions,
    isCompleted,
    weekStart,
    isLoading,
    isViewingPast,
    debouncedSave,
    inboxItems,
  ]);

  // Handle checklist item toggle
  const handleChecklistToggle = (id: string) => {
    if (!isEditing) return;
    setChecklist((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, checked: !item.checked } : item
      )
    );
  };

  // Handle question answer change
  const handleQuestionChange = (id: string, answer: string) => {
    if (!isEditing) return;
    setQuestions((prev) =>
      prev.map((item) => (item.id === id ? { ...item, answer } : item))
    );
  };

  // Handle adding inbox item
  const handleAddInboxItem = () => {
    if (!isEditing) return;
    if (!newInboxItem.trim()) return;
    const newItem: InboxItem = {
      id: `inbox-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      text: newInboxItem.trim(),
      checked: false,
    };
    setInboxItems((prev) => [...prev, newItem]);
    setNewInboxItem("");
  };

  const handleToggleInboxItem = (id: string) => {
    if (!isEditing) return;
    setInboxItems((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, checked: !item.checked } : item
      )
    );
  };

  // Handle removing inbox item
  const handleRemoveInboxItem = (id: string) => {
    if (!isEditing) return;
    setInboxItems((prev) => prev.filter((item) => item.id !== id));
  };

  const isReviewReadyToComplete =
    checklist.length > 0 &&
    questions.length > 0 &&
    checklist.every((c) => c.checked) &&
    questions.every((q) => q.answer.trim().length > 0);

  // Handle complete review
  const handleCompleteReview = async () => {
    if (!isReviewReadyToComplete) {
      showToast(
        "Finish all checklist items and questions before completing.",
        "error"
      );
      return;
    }
    setIsCompleting(true);
    try {
      await api.completeWeeklyReview(weekStart);
      setIsCompleted(true);
      setIsEditing(false);
      window.dispatchEvent(new Event("weekly-review-updated"));
      const streakData = await api.getReviewStreak();
      setStreak(streakData);
      showToast("Weekly review completed!", "success");
    } catch (error) {
      console.error("Failed to complete review:", error);
      showToast("Failed to complete review", "error");
    } finally {
      setIsCompleting(false);
    }
  };

  const handleEditAgain = async () => {
    setIsEditing(true);
    setIsCompleted(false);
    try {
      await api.saveWeeklyReview({
        week_start: weekStart,
        week_end: getWeekEnd(weekStart),
        checklist,
        questions,
        is_completed: false,
        inbox_items: serializeInboxItems(inboxItems),
      });
      window.dispatchEvent(new Event("weekly-review-updated"));
      showToast("Editing re-enabled.", "success");
    } catch (error) {
      console.error("Failed to re-open review for editing:", error);
      showToast("Failed to re-open review", "error");
    }
  };

  // Calculate progress
  const checklistProgress =
    checklist.length > 0
      ? Math.round(
          (checklist.filter((c) => c.checked).length / checklist.length) * 100
        )
      : 0;

  const questionsProgress =
    questions.length > 0
      ? Math.round(
          (questions.filter((q) => q.answer.trim().length > 0).length /
            questions.length) *
            100
        )
      : 0;

  const overallProgress = Math.round(
    (checklistProgress + questionsProgress) / 2
  );

  // Effective editing state: can't edit past weeks
  const canEdit = isEditing && !isViewingPast;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader className="w-6 h-6 animate-spin text-slate-400" />
      </div>
    );
  }

  const nextWeekDisabled = weekStart >= homeWeekStart;

  return (
    <div className="max-w-4xl mx-auto p-8">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {/* Week navigation */}
          <button
            onClick={goToPreviousWeek}
            className="p-1.5 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={goToCurrentWeek}
            className="text-sm font-medium text-slate-800 dark:text-slate-100 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
          >
            {formatWeekRange(weekStart, weekEnd)}
          </button>
          <button
            onClick={goToNextWeek}
            disabled={nextWeekDisabled}
            className="p-1.5 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-20 disabled:cursor-not-allowed"
          >
            <ChevronRight className="w-4 h-4" />
          </button>

          {isViewingPast && (
            <span className="text-xs text-slate-400 dark:text-slate-500 ml-1">
              View only
            </span>
          )}

          {isCompleted && (
            <span className="inline-flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Done
            </span>
          )}
        </div>

        <div className="flex items-center gap-3">
          {streak.current_streak > 0 && (
            <span className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
              <Flame className="w-3.5 h-3.5 text-orange-400" />
              {streak.current_streak}w
            </span>
          )}
          <span className="text-xs text-slate-400 dark:text-slate-500 tabular-nums">
            {overallProgress}%
          </span>
          <div className="w-16 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-slate-400 dark:bg-slate-500 transition-all duration-300 rounded-full"
              style={{ width: `${overallProgress}%` }}
            />
          </div>
          <span
            className={`flex items-center text-xs text-slate-400 transition-opacity duration-200 ${
              isSaving ? "opacity-100" : "opacity-0"
            }`}
          >
            <Loader className="w-3 h-3 animate-spin mr-1" />
            Saving
          </span>
        </div>
      </div>

      {/* Week in Review - collapsible */}
      <CollapsibleSection
        title="Week in Review"
        collapsed={collapsedSections.has("weekInReview")}
        onToggle={() => toggleSection("weekInReview")}
      >
        <WeekInReview weekStart={weekStart} weekEnd={weekEnd} />
      </CollapsibleSection>

      {/* Quick Capture Inbox - collapsible */}
      <CollapsibleSection
        title={`Inbox${inboxItems.length > 0 ? ` (${inboxItems.length})` : ""}`}
        collapsed={collapsedSections.has("inbox")}
        onToggle={() => toggleSection("inbox")}
      >
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-4">
          {!isViewingPast && (
            <div className="flex items-center gap-2 mb-3">
              <input
                type="text"
                value={newInboxItem}
                onChange={(e) => setNewInboxItem(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleAddInboxItem();
                  if (e.key === "Escape") (e.target as HTMLInputElement).blur();
                }}
                placeholder="Capture something..."
                disabled={!canEdit}
                className="flex-1 px-3 py-2 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-md text-sm text-slate-700 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-400"
              />
              <button
                onClick={handleAddInboxItem}
                disabled={!canEdit}
                className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors disabled:opacity-30"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          )}

          {inboxItems.length > 0 ? (
            <div className="space-y-1">
              {inboxItems.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between py-1.5 px-2 rounded-md group"
                >
                  <button
                    onClick={() => handleToggleInboxItem(item.id)}
                    disabled={!canEdit}
                    className="flex items-center flex-1 text-left"
                  >
                    <div
                      className={`w-4 h-4 rounded border flex items-center justify-center mr-2.5 transition-all flex-shrink-0 ${
                        item.checked
                          ? "bg-slate-500 border-slate-500 dark:bg-slate-400 dark:border-slate-400"
                          : "border-slate-300 dark:border-slate-600"
                      }`}
                    >
                      {item.checked && <Check className="w-3 h-3 text-white dark:text-slate-900" />}
                    </div>
                    <span
                      className={`text-sm ${
                        item.checked
                          ? "text-slate-400 dark:text-slate-500 line-through"
                          : "text-slate-700 dark:text-slate-200"
                      }`}
                    >
                      {item.text}
                    </span>
                  </button>
                  {canEdit && (
                    <button
                      onClick={() => handleRemoveInboxItem(item.id)}
                      className="text-slate-300 hover:text-red-400 dark:text-slate-600 dark:hover:text-red-400 p-0.5 ml-2 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-400 dark:text-slate-500 text-center py-2">
              No items
            </p>
          )}
        </div>
      </CollapsibleSection>

      {/* Checklist Section - always visible (core) */}
      <ChecklistSection
        items={checklist}
        onToggle={handleChecklistToggle}
        progress={checklistProgress}
        disabled={!canEdit}
      />

      {/* Questions Section - always visible (core) */}
      <QuestionsSection
        questions={questions}
        onChange={handleQuestionChange}
        progress={questionsProgress}
        disabled={!canEdit}
      />

      {/* Question History - collapsible */}
      <CollapsibleSection
        title="Question History"
        collapsed={collapsedSections.has("questionHistory")}
        onToggle={() => toggleSection("questionHistory")}
      >
        <QuestionHistory />
      </CollapsibleSection>

      {/* Plan Next Week - collapsible */}
      {!isViewingPast && (
        <CollapsibleSection
          title="Plan Next Week"
          collapsed={collapsedSections.has("taskPlanner")}
          onToggle={() => toggleSection("taskPlanner")}
        >
          <WeeklyTaskPlanner disabled={!canEdit} />
        </CollapsibleSection>
      )}

      {/* Complete / Edit buttons - only for current week */}
      {!isViewingPast && (
        <div className="mt-10 flex justify-center">
          <div className="flex items-center gap-3">
            {isCompleted && (
              <button
                onClick={handleEditAgain}
                className="px-5 py-2.5 rounded-md text-sm font-medium transition-colors border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                Edit again
              </button>
            )}

            <button
              onClick={handleCompleteReview}
              disabled={isCompleting || isCompleted || !isReviewReadyToComplete}
              className={`px-5 py-2.5 rounded-md text-sm font-medium transition-colors ${
                isCompleted
                  ? "bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-default"
                  : isReviewReadyToComplete
                  ? "bg-slate-900 dark:bg-white hover:bg-slate-800 dark:hover:bg-slate-100 text-white dark:text-slate-900"
                  : "bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-not-allowed"
              }`}
            >
              {isCompleting ? (
                <span className="flex items-center">
                  <Loader className="w-3.5 h-3.5 animate-spin mr-1.5" />
                  Completing...
                </span>
              ) : isCompleted ? (
                <span className="flex items-center">
                  <Check className="w-3.5 h-3.5 mr-1.5" />
                  Completed
                </span>
              ) : (
                "Complete Review"
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// --- Collapsible section wrapper ---

const CollapsibleSection: React.FC<{
  title: string;
  collapsed: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}> = ({ title, collapsed, onToggle, children }) => {
  return (
    <div className="mb-6">
      <button
        onClick={onToggle}
        className="flex items-center gap-1.5 mb-3 text-sm font-medium text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
      >
        <ChevronDown
          className={`w-3.5 h-3.5 transition-transform ${
            collapsed ? "-rotate-90" : ""
          }`}
        />
        {title}
      </button>
      {!collapsed && children}
    </div>
  );
};

export default Review;
