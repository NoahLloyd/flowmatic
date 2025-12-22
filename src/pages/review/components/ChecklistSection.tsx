import React from "react";
import { Check, ListChecks } from "lucide-react";
import { ChecklistItem } from "../../../types/Review";

interface ChecklistSectionProps {
  items: ChecklistItem[];
  onToggle: (id: string) => void;
  progress: number;
  disabled?: boolean;
}

const ChecklistSection: React.FC<ChecklistSectionProps> = ({
  items,
  onToggle,
  progress,
  disabled = false,
}) => {
  return (
    <div className="mb-8">
      {/* Section Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <ListChecks className="w-5 h-5 text-slate-600 dark:text-slate-400" />
          <h2 className="text-lg font-medium text-slate-800 dark:text-slate-100">
            Checklist
          </h2>
        </div>
        <div className="flex items-center space-x-2">
          <span className="text-sm text-slate-500 dark:text-slate-400">
            {items.filter((i) => i.checked).length} / {items.length}
          </span>
          <div className="w-20 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-500 dark:bg-emerald-400 transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>

      {/* Checklist Items */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 divide-y divide-slate-100 dark:divide-slate-700">
        {items.map((item) => (
          <button
            key={item.id}
            onClick={() => onToggle(item.id)}
            disabled={disabled}
            className={`
              w-full flex items-center p-4 transition-colors text-left
              ${disabled ? "opacity-60 cursor-not-allowed" : "hover:bg-slate-50 dark:hover:bg-slate-700/50"}
            `}
          >
            <div
              className={`
                w-6 h-6 rounded-md border-2 flex items-center justify-center mr-4 transition-all
                ${
                  item.checked
                    ? "bg-emerald-500 border-emerald-500 dark:bg-emerald-600 dark:border-emerald-600"
                    : "border-slate-300 dark:border-slate-600"
                }
              `}
            >
              {item.checked && <Check className="w-4 h-4 text-white" />}
            </div>
            <span
              className={`
                flex-1 text-base transition-all
                ${
                  item.checked
                    ? "text-slate-400 dark:text-slate-500 line-through"
                    : "text-slate-700 dark:text-slate-200"
                }
              `}
            >
              {item.label}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
};

export default ChecklistSection;

