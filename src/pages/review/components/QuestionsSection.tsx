import React from "react";
import { MessageSquare, CheckCircle } from "lucide-react";
import { QuestionItem } from "../../../types/Review";

interface QuestionsSectionProps {
  questions: QuestionItem[];
  onChange: (id: string, answer: string) => void;
  progress: number;
  disabled?: boolean;
}

const QuestionsSection: React.FC<QuestionsSectionProps> = ({
  questions,
  onChange,
  progress,
  disabled = false,
}) => {
  return (
    <div className="mb-8">
      {/* Section Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <MessageSquare className="w-5 h-5 text-slate-600 dark:text-slate-400" />
          <h2 className="text-lg font-medium text-slate-800 dark:text-slate-100">
            Questions
          </h2>
        </div>
        <div className="flex items-center space-x-2">
          <span className="text-sm text-slate-500 dark:text-slate-400">
            {questions.filter((q) => q.answer.trim().length > 0).length} /{" "}
            {questions.length}
          </span>
          <div className="w-20 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-500 dark:bg-blue-400 transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>

      {/* Questions List */}
      <div className="space-y-6">
        {questions.map((question) => (
          <div
            key={question.id}
            className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5"
          >
            <div className="flex items-start justify-between mb-3">
              <label
                htmlFor={`question-${question.id}`}
                className="text-base font-medium text-slate-700 dark:text-slate-200 flex-1"
              >
                {question.question}
              </label>
              {question.answer.trim().length > 0 && (
                <CheckCircle className="w-5 h-5 text-emerald-500 dark:text-emerald-400 ml-2 flex-shrink-0" />
              )}
            </div>
            <textarea
              id={`question-${question.id}`}
              value={question.answer}
              onChange={(e) => onChange(question.id, e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  e.preventDefault();
                  (e.target as HTMLTextAreaElement).blur();
                }
              }}
              placeholder="Type your answer..."
              rows={3}
              disabled={disabled}
              className="
                w-full px-4 py-3 rounded-lg
                bg-slate-50 dark:bg-slate-900/50
                border border-slate-200 dark:border-slate-700
                text-slate-700 dark:text-slate-200
                placeholder-slate-400 dark:placeholder-slate-500
                focus:outline-none focus:ring-2 focus:ring-blue-500/50 dark:focus:ring-blue-400/50
                focus:border-blue-500 dark:focus:border-blue-400
                resize-none transition-all
              "
            />
          </div>
        ))}
      </div>
    </div>
  );
};

export default QuestionsSection;

