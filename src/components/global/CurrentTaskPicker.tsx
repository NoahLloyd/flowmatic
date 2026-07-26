import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { api } from "../../utils/api";
import { Check, Trash2 } from "lucide-react";
import { subscribeToTaskAdded } from "../../utils/taskEvents";
import LinkifiedTaskText from "../task/LinkifiedTaskText";

interface CurrentTaskPickerProps {
  isOpen: boolean;
  onClose: () => void;
  // Ordered list of currently active task titles (newest first).
  currentTasks: string[];
  // Toggles the given task title in/out of the active set.
  onToggleTask: (title: string) => void;
  // Adds (or moves to front) — used for freeform Enter additions that may
  // not exist in the typed-task list.
  onAddTask: (title: string) => void;
  // Removes the given title from the active set.
  onRemoveTask: (title: string) => void;
  // Clears all active tasks.
  onClearAll: () => void;
}

interface PickerTask {
  id: string;
  title: string;
  type: string;
}

const TASK_TYPES = ["day", "week", "future", "blocked", "shopping"] as const;

const sortByStoredOrder = (tasks: PickerTask[], type: string): PickerTask[] => {
  const storedOrder = localStorage.getItem(`taskOrder_${type}`);
  if (!storedOrder) return tasks;
  try {
    const order: string[] = JSON.parse(storedOrder);
    return [...tasks].sort((a, b) => {
      const indexA = order.indexOf(a.id);
      const indexB = order.indexOf(b.id);
      if (indexA === -1 && indexB === -1) return 0;
      if (indexA === -1) return 1;
      if (indexB === -1) return -1;
      return indexA - indexB;
    });
  } catch {
    return tasks;
  }
};

const CurrentTaskPicker: React.FC<CurrentTaskPickerProps> = ({
  isOpen,
  onClose,
  currentTasks,
  onToggleTask,
  onAddTask,
  onRemoveTask,
  onClearAll,
}) => {
  const [inputValue, setInputValue] = useState("");
  const [tasks, setTasks] = useState<PickerTask[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  // Keep the typed-task pool fresh in the background so the picker opens
  // with the same ordering as Compass instantly. (Refreshes on mount,
  // window focus, taskAdded events, and on open.)
  const refresh = useCallback(async () => {
    try {
      const results = await Promise.all(
        TASK_TYPES.map((type) => api.getTasksByType(type))
      );
      const allTasks: PickerTask[] = [];
      results.forEach((typeTasks, typeIdx) => {
        const type = TASK_TYPES[typeIdx];
        let active: PickerTask[] = typeTasks
          .filter((t) => !t.completed)
          .map((t) => ({ id: t.id, title: t.title, type: type as string }));
        active = sortByStoredOrder(active, type);
        allTasks.push(...active);
      });
      setTasks(allTasks);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    refresh();
    const onFocus = () => refresh();
    window.addEventListener("focus", onFocus);
    const unsub = subscribeToTaskAdded(() => refresh());
    return () => {
      window.removeEventListener("focus", onFocus);
      unsub();
    };
  }, [refresh]);

  useEffect(() => {
    if (!isOpen) return;
    setInputValue("");
    refresh();
    const timer = setTimeout(() => inputRef.current?.focus(), 50);
    return () => clearTimeout(timer);
  }, [isOpen, refresh]);

  // Build the ordered list shown in the picker:
  //   1) currently-selected tasks (in selection order — newest first), then
  //   2) the typed-task pool minus anything already selected.
  // Filtering applies to both groups uniformly.
  const selectedSet = new Set(currentTasks);
  const filterText = inputValue.trim().toLowerCase();
  const matches = (s: string) =>
    !filterText || s.toLowerCase().includes(filterText);

  // Selected rows. `id` synthesised since they may be freeform / not in the
  // task pool. We keep the type tag if we can find it.
  const typeByTitle = new Map<string, string>();
  for (const t of tasks) typeByTitle.set(t.title, t.type);

  const selectedRows: PickerTask[] = currentTasks
    .filter(matches)
    .map((title) => ({
      id: `sel-${title}`,
      title,
      type: typeByTitle.get(title) || "free",
    }));

  const unselectedRows: PickerTask[] = tasks
    .filter((t) => !selectedSet.has(t.title) && matches(t.title))
    .map((t) => ({ id: t.id, title: t.title, type: t.type }));

  // Flat, numbered list — selected first, then unselected. The number key
  // mapping always tracks the visible top-down order.
  const visibleRows: { row: PickerTask; selected: boolean }[] = [
    ...selectedRows.map((row) => ({ row, selected: true })),
    ...unselectedRows.map((row) => ({ row, selected: false })),
  ];

  const handleToggleByTitle = (title: string) => onToggleTask(title);

  const handleAddTyped = () => {
    const v = inputValue.trim();
    if (!v) return;
    onAddTask(v);
    setInputValue("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    e.stopPropagation();

    if (e.key === "Escape") {
      onClose();
      return;
    }

    // Enter behaves like every other input: commit the typed task (if any)
    // and close. Reopening with W is one keystroke and matches muscle
    // memory better than "stay open + Esc to close".
    if (e.key === "Enter") {
      e.preventDefault();
      if (inputValue.trim()) handleAddTyped();
      onClose();
      return;
    }

    // Cmd+Backspace: clear all active tasks.
    if (e.key === "Backspace" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      onClearAll();
      return;
    }

    // Number keys toggle the row at that visible position.
    //
    //   plain digit  → toggle and close (single-shot select)
    //   shift+digit  → toggle and stay open (batch-select)
    //
    // We match on `e.code` (Digit1…Digit9) rather than `e.key` so the
    // Shift-symbol mapping (!@#$%^&*( on US layouts) doesn't matter and
    // alternate keyboard layouts still work.
    const digitMatch = e.code.match(/^Digit([1-9])$/);
    if (digitMatch) {
      const idx = parseInt(digitMatch[1], 10) - 1;
      if (idx < visibleRows.length) {
        e.preventDefault();
        handleToggleByTitle(visibleRows[idx].row.title);
        if (!e.shiftKey) onClose();
      } else {
        // Still swallow the key so the symbol doesn't end up in the
        // input even when there's no row at that index.
        e.preventDefault();
      }
      return;
    }
  };

  // Number keys (and their Shift symbols) are selection accelerators;
  // strip them from any direct typing so they don't end up in the filter.
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const stripped = e.target.value.replace(/[0-9!@#$%^&*()]/g, "");
    setInputValue(stripped);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[18vh]">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={onClose}
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: -16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -16 }}
            transition={{ duration: 0.12, ease: "easeOut" }}
            className="relative w-full max-w-md mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-800">
                <div className="flex items-center">
                  <div className="w-2.5 h-2.5 rounded-full bg-indigo-500 mr-3" />
                  <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                    Working on
                  </span>
                  {currentTasks.length > 0 && (
                    <span className="ml-2 text-xs font-semibold text-indigo-500 dark:text-indigo-400 tabular-nums">
                      {currentTasks.length}
                    </span>
                  )}
                </div>
                {currentTasks.length > 0 && (
                  <button
                    onClick={onClearAll}
                    className="flex items-center gap-1 text-xs text-gray-400 hover:text-red-500 dark:text-gray-500 dark:hover:text-red-400 transition-colors"
                    title="Clear all (⌘⌫)"
                  >
                    <Trash2 size={12} />
                    Clear all
                  </button>
                )}
              </div>

              {/* Filter / freeform input */}
              <div className="px-4 pt-4 pb-2">
                <input
                  ref={inputRef}
                  type="text"
                  value={inputValue}
                  onChange={handleChange}
                  onKeyDown={handleKeyDown}
                  placeholder={
                    currentTasks.length === 0
                      ? "Type a task or pick from below..."
                      : "Filter, or type to add another..."
                  }
                  className="w-full text-base bg-transparent border-none focus:outline-none text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
                  autoFocus
                />
              </div>

              {/* Combined list (selected first, then unselected) */}
              {visibleRows.length > 0 && (
                <div className="px-2 pb-2 max-h-[420px] overflow-y-auto">
                  <div className="space-y-0.5">
                    {visibleRows.map(({ row, selected }, idx) => {
                      const num = idx < 9 ? idx + 1 : null;
                      const dividerBefore =
                        idx === selectedRows.length && selectedRows.length > 0;
                      return (
                        <React.Fragment key={row.id}>
                          {dividerBefore && (
                            <div className="my-1.5 h-px bg-gray-100 dark:bg-gray-800" />
                          )}
                          <button
                            onClick={() => handleToggleByTitle(row.title)}
                            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left text-sm transition-colors ${
                              selected
                                ? "bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300"
                                : "text-gray-800 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800"
                            }`}
                          >
                            {num !== null ? (
                              <kbd className="flex-shrink-0 w-5 h-5 rounded bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-[10px] font-mono text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-700">
                                {num}
                              </kbd>
                            ) : (
                              <span className="flex-shrink-0 w-5" />
                            )}
                            {/* Selection state: filled check on the left of
                                the title for a clear "in/out" affordance. */}
                            <span
                              className={`flex-shrink-0 w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                                selected
                                  ? "bg-indigo-500 border-indigo-500 dark:bg-indigo-400 dark:border-indigo-400"
                                  : "border-gray-300 dark:border-gray-600"
                              }`}
                            >
                              {selected && (
                                <Check className="w-3 h-3 text-white dark:text-gray-900" />
                              )}
                            </span>
                            <span className="truncate flex-1">
                              <LinkifiedTaskText text={row.title} />
                            </span>
                            {row.type !== "day" && row.type !== "free" && (
                              <span className="text-[10px] text-gray-400 dark:text-gray-500 font-medium shrink-0">
                                {row.type}
                              </span>
                            )}
                            {selected && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onRemoveTask(row.title);
                                }}
                                className="p-0.5 text-indigo-400 hover:text-red-500 dark:text-indigo-500 dark:hover:text-red-400 transition-colors"
                                title="Remove"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            )}
                          </button>
                        </React.Fragment>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Footer key hints */}
              <div className="px-4 py-2 bg-gray-50 dark:bg-gray-800/50 flex flex-wrap justify-between items-center gap-y-1 text-xs text-gray-500 dark:text-gray-400">
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="flex items-center gap-1">
                    <kbd className="px-1.5 py-0.5 rounded bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 font-mono text-[10px]">
                      1-9
                    </kbd>
                    <span>pick</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <kbd className="px-1.5 py-0.5 rounded bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 font-mono text-[10px]">
                      ⇧1-9
                    </kbd>
                    <span>multi</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <kbd className="px-1.5 py-0.5 rounded bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 font-mono text-[10px]">
                      ⌘⌫
                    </kbd>
                    <span>clear</span>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 rounded bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 font-mono text-[10px]">
                    Esc
                  </kbd>
                  <span>close</span>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default CurrentTaskPicker;
