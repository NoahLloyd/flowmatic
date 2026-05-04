import React, { useState } from "react";
import { Check, ListChecks, ChevronDown, ChevronRight } from "lucide-react";
import { ChecklistItem } from "../../../types/Review";

interface ChecklistSectionProps {
  items: ChecklistItem[];
  onToggle: (id: string) => void;
  progress: number;
  disabled?: boolean;
  // Optional renderer that returns a detail panel for a given item id.
  // Items where this returns a non-null node get an expand/collapse chevron;
  // the panel renders inline below the row when expanded.
  renderDetail?: (id: string) => React.ReactNode;
}

const ChecklistSection: React.FC<ChecklistSectionProps> = ({
  items,
  onToggle,
  progress,
  disabled = false,
  renderDetail,
}) => {
  // Default to expanded for items that have a detail panel, so the user
  // sees the relevant tasks/data attached to the to-do without needing to
  // hunt for a chevron.
  const [expanded, setExpanded] = useState<Set<string>>(() => {
    if (!renderDetail) return new Set();
    return new Set(
      items.filter((i) => renderDetail(i.id) !== null).map((i) => i.id)
    );
  });

  const toggleExpanded = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

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
        {items.map((item) => {
          const detail = renderDetail?.(item.id) ?? null;
          const hasDetail = detail !== null;
          const isExpanded = expanded.has(item.id);

          return (
            <div key={item.id}>
              <div
                className={`flex items-center transition-colors ${
                  disabled ? "opacity-60" : ""
                }`}
              >
                <button
                  onClick={() => onToggle(item.id)}
                  disabled={disabled}
                  className={`flex items-center flex-1 p-4 text-left ${
                    disabled
                      ? "cursor-not-allowed"
                      : "hover:bg-slate-50 dark:hover:bg-slate-700/50"
                  }`}
                >
                  <div
                    className={`
                      w-5 h-5 rounded border flex items-center justify-center mr-3 transition-all flex-shrink-0
                      ${
                        item.checked
                          ? "bg-slate-500 border-slate-500 dark:bg-slate-400 dark:border-slate-400"
                          : "border-slate-300 dark:border-slate-600"
                      }
                    `}
                  >
                    {item.checked && (
                      <Check className="w-3.5 h-3.5 text-white dark:text-slate-900" />
                    )}
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
                {hasDetail && (
                  <button
                    onClick={() => toggleExpanded(item.id)}
                    className="p-3 mr-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                    aria-label={isExpanded ? "Hide details" : "Show details"}
                  >
                    {isExpanded ? (
                      <ChevronDown className="w-4 h-4" />
                    ) : (
                      <ChevronRight className="w-4 h-4" />
                    )}
                  </button>
                )}
              </div>
              {hasDetail && isExpanded && (
                <div className="px-4 pb-4 pl-12 bg-slate-50/40 dark:bg-slate-900/20">
                  {detail}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ChecklistSection;
