import React from "react";
import { MessageSquare, ExternalLink } from "lucide-react";
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
        <span className="text-xs text-slate-400 dark:text-slate-500 tabular-nums">
          {questions.filter((q) => q.answer.trim().length > 0).length}/{questions.length}
        </span>
      </div>

      {/* Questions List */}
      <div className="space-y-6">
        {questions.map((question) => (
          <div
            key={question.id}
            className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5"
          >
            <label
              htmlFor={`question-${question.id}`}
              className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-2"
            >
              {question.question}
            </label>

            {/* Attached Obsidian notes — click to open in Obsidian */}
            {question.obsidianLinks && question.obsidianLinks.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-3">
                {question.obsidianLinks.map((file) => (
                  <button
                    key={file}
                    type="button"
                    onClick={() =>
                      window.electron?.obsidian?.openFile?.(file)
                    }
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs bg-slate-100 dark:bg-slate-700/60 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-600 border border-slate-200 dark:border-slate-600 transition-colors"
                    title={`Open ${file} in Obsidian`}
                  >
                    <ExternalLink className="w-3 h-3" />
                    <span className="font-mono">
                      {file.replace(/\.md$/, "").split("/").pop()}
                    </span>
                  </button>
                ))}
              </div>
            )}

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

