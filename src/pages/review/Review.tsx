import React, { useState, useEffect, useCallback } from "react";
import {
  Calendar,
  Flame,
  Check,
  Loader,
  CheckCircle2,
  Inbox,
  Plus,
  Trash2,
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

// Helper to get the Wednesday of the current review week
// Week runs Wed-Tue, so Mon/Tue belong to the previous week
const getWeekStart = (date: Date, timezone: string): string => {
  try {
    const day = getDayOfWeekInTimezone(date, timezone);

    // Calculate days to subtract to get to Wednesday
    // If Wed(3), Thu(4), Fri(5), Sat(6) -> subtract (day - 3)
    // If Sun(0) -> subtract 4 (to get to previous Wed)
    // If Mon(1) -> subtract 5 (to get to previous Wed)
    // If Tue(2) -> subtract 6 (to get to previous Wed)
    let daysToSubtract;
    if (day >= 3) {
      daysToSubtract = day - 3; // Wed=0, Thu=1, Fri=2, Sat=3
    } else {
      daysToSubtract = day + 4; // Sun=4, Mon=5, Tue=6
    }

    const wednesday = new Date(
      date.getTime() - daysToSubtract * 24 * 60 * 60 * 1000
    );
    return formatDateInTimezone(wednesday, timezone);
  } catch (error) {
    console.error("Error getting week start:", error);
    const day = date.getDay();
    let daysToSubtract;
    if (day >= 3) {
      daysToSubtract = day - 3;
    } else {
      daysToSubtract = day + 4;
    }
    const wednesday = new Date(
      date.getTime() - daysToSubtract * 24 * 60 * 60 * 1000
    );
    return wednesday.toISOString().split("T")[0];
  }
};

// Helper to get the Tuesday (end of the review week)
const getWeekEnd = (weekStart: string): string => {
  const wednesday = new Date(weekStart);
  const tuesday = new Date(wednesday);
  tuesday.setDate(wednesday.getDate() + 6);
  return tuesday.toISOString().split("T")[0];
};

// Format week range for display
const formatWeekRange = (weekStart: string, weekEnd: string): string => {
  const start = new Date(weekStart);
  const end = new Date(weekEnd);
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

  // Current week dates
  const [weekStart, setWeekStart] = useState(() =>
    getWeekStart(new Date(), timezone)
  );
  const [weekEnd, setWeekEnd] = useState(() => getWeekEnd(weekStart));

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
    (savedReview: WeeklyReview | null) => {
      const checklistConfig = getChecklistConfig();
      const questionsConfig = getQuestionsConfig();

      if (savedReview) {
        // Merge saved data with config (in case config has new items)
        const mergedChecklist = checklistConfig.map((item) => {
          const saved = savedReview.checklist.find((c) => c.id === item.id);
          return {
            ...item,
            checked: saved?.checked || false,
          };
        });

        const mergedQuestions = questionsConfig.map((item) => {
          const saved = savedReview.questions.find((q) => q.id === item.id);
          return {
            ...item,
            answer: saved?.answer || "",
          };
        });

        setChecklist(mergedChecklist);
        setQuestions(mergedQuestions);
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

  // Load review data
  useEffect(() => {
    const loadReview = async () => {
      setIsLoading(true);
      try {
        const [review, streakData] = await Promise.all([
          api.getWeeklyReview(weekStart),
          api.getReviewStreak(),
        ]);

        initializeForm(review);
        setStreak(streakData);
      } catch (error) {
        console.error("Failed to load review:", error);
        initializeForm(null);
      } finally {
        setIsLoading(false);
      }
    };

    loadReview();
  }, [weekStart, initializeForm]);

  // Update week start when timezone changes
  useEffect(() => {
    const newWeekStart = getWeekStart(new Date(), timezone);
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

  // Auto-save when data changes
  useEffect(() => {
    if (!isLoading && (checklist.length > 0 || questions.length > 0)) {
      debouncedSave(weekStart, checklist, questions, isCompleted, inboxItems);
    }
  }, [
    checklist,
    questions,
    isCompleted,
    weekStart,
    isLoading,
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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader className="w-8 h-8 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-8">
      {/* Header - no title, just info bar */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2 px-4 py-2 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
              <Calendar className="w-5 h-5 text-slate-500 dark:text-slate-400" />
              <span className="text-slate-700 dark:text-slate-200 font-medium">
                {formatWeekRange(weekStart, weekEnd)}
              </span>
            </div>

            <div className="flex items-center space-x-2 px-4 py-2 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
              <Flame className="w-5 h-5 text-orange-500" />
              <span className="text-slate-700 dark:text-slate-200">
                {streak.current_streak} week streak
              </span>
            </div>

            {/* Progress indicator */}
            <div className="flex items-center space-x-2 px-4 py-2 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
              <div className="w-24 h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 dark:bg-blue-400 transition-all duration-300"
                  style={{ width: `${overallProgress}%` }}
                />
              </div>
              <span className="text-sm text-slate-600 dark:text-slate-300">
                {overallProgress}%
              </span>
            </div>

            {isCompleted && (
              <span className="inline-flex items-center px-3 py-1.5 rounded-lg text-sm font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300">
                <CheckCircle2 className="w-4 h-4 mr-1" />
                Done
              </span>
            )}
          </div>

          <div className="flex items-center space-x-2 text-sm text-slate-500 dark:text-slate-400 min-w-[80px] justify-end">
            <span
              className={`flex items-center transition-opacity duration-200 ${
                isSaving ? "opacity-100" : "opacity-0"
              }`}
            >
              <Loader className="w-4 h-4 animate-spin mr-1" />
              Saving...
            </span>
          </div>
        </div>
      </div>

      {/* Quick Capture Inbox */}
      <div className="mb-8">
        <div className="flex items-center space-x-2 mb-3">
          <Inbox className="w-5 h-5 text-slate-600 dark:text-slate-400" />
          <h2 className="text-lg font-medium text-slate-800 dark:text-slate-100">
            Inbox
          </h2>
          <span className="text-sm text-slate-500 dark:text-slate-400">
            Quick capture throughout the week
          </span>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
          {/* Add new item */}
          <div className="flex items-center space-x-2 mb-3">
            <input
              type="text"
              value={newInboxItem}
              onChange={(e) => setNewInboxItem(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAddInboxItem()}
              placeholder="Drop something here to process during review..."
              disabled={!isEditing}
              className="flex-1 px-3 py-2 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
            />
            <button
              onClick={handleAddInboxItem}
              disabled={!isEditing}
              className="p-2 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-lg transition-colors"
            >
              <Plus className="w-5 h-5 text-slate-600 dark:text-slate-300" />
            </button>
          </div>

          {/* Inbox items list */}
          {inboxItems.length > 0 ? (
            <div className="space-y-2">
              {inboxItems.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-2 bg-slate-50 dark:bg-slate-900/50 rounded-lg"
                >
                  <button
                    onClick={() => handleToggleInboxItem(item.id)}
                    disabled={!isEditing}
                    className="flex items-center flex-1 text-left"
                  >
                    <div
                      className={`
                        w-5 h-5 rounded-md border-2 flex items-center justify-center mr-3 transition-all
                        ${
                          item.checked
                            ? "bg-emerald-500 border-emerald-500 dark:bg-emerald-600 dark:border-emerald-600"
                            : "border-slate-300 dark:border-slate-600"
                        }
                      `}
                    >
                      {item.checked && (
                        <Check className="w-3.5 h-3.5 text-white" />
                      )}
                    </div>
                    <span
                      className={`
                        text-slate-700 dark:text-slate-200 transition-all
                        ${
                          item.checked
                            ? "text-slate-400 dark:text-slate-500 line-through"
                            : ""
                        }
                      `}
                    >
                      {item.text}
                    </span>
                  </button>
                  <button
                    onClick={() => handleRemoveInboxItem(item.id)}
                    disabled={!isEditing}
                    className="text-slate-400 hover:text-red-500 dark:text-slate-500 dark:hover:text-red-400 p-1 ml-2 disabled:opacity-40 disabled:cursor-not-allowed"
                    aria-label="Delete inbox item"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-400 dark:text-slate-500 text-center py-2">
              Empty inbox - add items throughout the week
            </p>
          )}
        </div>
      </div>

      {/* Checklist Section */}
      <ChecklistSection
        items={checklist}
        onToggle={handleChecklistToggle}
        progress={checklistProgress}
        disabled={!isEditing}
      />

      {/* Questions Section */}
      <QuestionsSection
        questions={questions}
        onChange={handleQuestionChange}
        progress={questionsProgress}
        disabled={!isEditing}
      />

      {/* Complete Button - minimal modern style */}
      <div className="mt-10 flex justify-center">
        <div className="flex items-center space-x-3">
          {isCompleted && (
            <button
              onClick={handleEditAgain}
              className="px-6 py-3 rounded-lg font-medium transition-all bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              Edit again
            </button>
          )}

          <button
            onClick={handleCompleteReview}
            disabled={isCompleting || isCompleted || !isReviewReadyToComplete}
            className={`
              px-6 py-3 rounded-lg font-medium transition-all
              ${
                isCompleted
                  ? "bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-default"
                  : isReviewReadyToComplete
                  ? "bg-slate-900 dark:bg-white hover:bg-slate-800 dark:hover:bg-slate-100 text-white dark:text-slate-900"
                  : "bg-slate-200 dark:bg-slate-800 text-slate-500 dark:text-slate-400 cursor-not-allowed"
              }
            `}
          >
            {isCompleting ? (
              <span className="flex items-center">
                <Loader className="w-4 h-4 animate-spin mr-2" />
                Completing...
              </span>
            ) : isCompleted ? (
              <span className="flex items-center">
                <Check className="w-4 h-4 mr-2" />
                Completed
              </span>
            ) : (
              "Complete Review"
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Review;
