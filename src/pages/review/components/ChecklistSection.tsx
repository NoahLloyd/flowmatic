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
        <span className="text-xs text-slate-400 dark:text-slate-500 tabular-nums">
          {items.filter((i) => i.checked).length}/{items.length}
        </span>
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
                w-5 h-5 rounded border flex items-center justify-center mr-3 transition-all
                ${
                  item.checked
                    ? "bg-slate-500 border-slate-500 dark:bg-slate-400 dark:border-slate-400"
                    : "border-slate-300 dark:border-slate-600"
                }
              `}
            >
              {item.checked && <Check className="w-3.5 h-3.5 text-white dark:text-slate-900" />}
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

