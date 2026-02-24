import React, { useState, useEffect } from "react";
import { History, ChevronDown, ChevronRight, MessageSquare } from "lucide-react";
import { api } from "../../../utils/api";
import { WeeklyReview, QuestionItem } from "../../../types/Review";

interface QuestionWithHistory {
  id: string;
  question: string;
  responses: { weekStart: string; weekLabel: string; answer: string }[];
}

const QuestionHistory: React.FC = () => {
  const [reviews, setReviews] = useState<WeeklyReview[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedQuestions, setExpandedQuestions] = useState<Set<string>>(
    new Set()
  );

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      try {
        const allReviews = await api.getAllReviews();
        // Only show completed reviews with actual answers
        const completed = allReviews.filter(
          (r) =>
            r.is_completed &&
            r.questions?.some((q) => q.answer?.trim().length > 0)
        );
        setReviews(completed);
      } catch (error) {
        console.error("Failed to load review history:", error);
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, []);

  const toggleQuestion = (id: string) => {
    setExpandedQuestions((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Build a map of question -> responses across weeks
  const questionMap = new Map<string, QuestionWithHistory>();

  reviews.forEach((review) => {
    if (!review.questions) return;
    const weekLabel = formatWeekLabel(review.week_start);

    review.questions.forEach((q) => {
      if (!q.answer?.trim()) return;

      if (!questionMap.has(q.id)) {
        questionMap.set(q.id, {
          id: q.id,
          question: q.question,
          responses: [],
        });
      }
      const entry = questionMap.get(q.id)!;
      // Update question text to the latest version
      entry.question = q.question;
      entry.responses.push({
        weekStart: review.week_start,
        weekLabel,
        answer: q.answer,
      });
    });
  });

  const questionsWithHistory = Array.from(questionMap.values()).sort(
    (a, b) => b.responses.length - a.responses.length
  );

  if (isLoading) {
    return (
      <div className="mb-8">
        <div className="flex items-center space-x-2 mb-3">
          <History className="w-5 h-5 text-slate-600 dark:text-slate-400" />
          <h2 className="text-lg font-medium text-slate-800 dark:text-slate-100">
            Question History
          </h2>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
          <div className="animate-pulse space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-12 bg-slate-100 dark:bg-slate-700 rounded-lg" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (questionsWithHistory.length === 0) {
    return (
      <div className="mb-8">
        <div className="flex items-center space-x-2 mb-3">
          <History className="w-5 h-5 text-slate-600 dark:text-slate-400" />
          <h2 className="text-lg font-medium text-slate-800 dark:text-slate-100">
            Question History
          </h2>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
          <p className="text-sm text-slate-400 dark:text-slate-500 text-center">
            Complete a few weekly reviews to see response history here
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mb-8">
      <div className="flex items-center space-x-2 mb-3">
        <History className="w-5 h-5 text-slate-600 dark:text-slate-400" />
        <h2 className="text-lg font-medium text-slate-800 dark:text-slate-100">
          Question History
        </h2>
        <span className="text-sm text-slate-500 dark:text-slate-400">
          {reviews.length} past {reviews.length === 1 ? "review" : "reviews"}
        </span>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 divide-y divide-slate-100 dark:divide-slate-700">
        {questionsWithHistory.map((q) => {
          const isExpanded = expandedQuestions.has(q.id);
          return (
            <div key={q.id}>
              <button
                onClick={() => toggleQuestion(q.id)}
                className="w-full flex items-center justify-between p-4 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors text-left"
              >
                <div className="flex items-center space-x-3 flex-1 min-w-0">
                  {isExpanded ? (
                    <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-slate-400 flex-shrink-0" />
                  )}
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate">
                    {q.question}
                  </span>
                </div>
                <span className="text-xs text-slate-400 dark:text-slate-500 ml-3 flex-shrink-0 tabular-nums">
                  {q.responses.length} {q.responses.length === 1 ? "response" : "responses"}
                </span>
              </button>

              {isExpanded && (
                <div className="px-4 pb-4 pl-11 space-y-3">
                  {q.responses.map((resp, idx) => (
                    <div
                      key={`${resp.weekStart}-${idx}`}
                      className="bg-slate-50 dark:bg-slate-900/50 rounded-lg p-3"
                    >
                      <div className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">
                        {resp.weekLabel}
                      </div>
                      <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">
                        {resp.answer}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

function formatWeekLabel(weekStart: string): string {
  const start = new Date(weekStart + "T00:00:00");
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  const options: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  return `${start.toLocaleDateString("en-US", options)} - ${end.toLocaleDateString("en-US", options)}`;
}

export default QuestionHistory;
