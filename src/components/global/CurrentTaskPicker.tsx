import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { api } from "../../utils/api";
import { X } from "lucide-react";

interface CurrentTaskPickerProps {
  isOpen: boolean;
  onClose: () => void;
  currentTask: string;
  onSetCurrentTask: (task: string) => void;
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
    // Ignore invalid JSON in localStorage
    return tasks;
  }
};

const CurrentTaskPicker: React.FC<CurrentTaskPickerProps> = ({
  isOpen,
  onClose,
  currentTask,
  onSetCurrentTask,
}) => {
  const [inputValue, setInputValue] = useState("");
  const [tasks, setTasks] = useState<PickerTask[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  // Fetch all task types when opened
  useEffect(() => {
    if (!isOpen) return;

    setInputValue("");

    Promise.all(TASK_TYPES.map((type) => api.getTasksByType(type)))
      .then((results) => {
        const allTasks: PickerTask[] = [];

        results.forEach((typeTasks, typeIdx) => {
          const type = TASK_TYPES[typeIdx];
          let active: PickerTask[] = typeTasks
            .filter((t) => !t.completed)
            .map((t) => ({ id: t.id, title: t.title, type: type as string }));

          // Apply stored order for this type
          active = sortByStoredOrder(active, type);
          allTasks.push(...active);
        });

        setTasks(allTasks);
      })
      .catch(() => { /* ignore */ });
  }, [isOpen]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  const selectTask = (title: string) => {
    onSetCurrentTask(title);
    onClose();
  };

  const clearTask = () => {
    onSetCurrentTask("");
    onClose();
  };

  // Filter tasks based on input
  const filteredTasks = inputValue
    ? tasks.filter((t) =>
        t.title.toLowerCase().includes(inputValue.toLowerCase())
      )
    : tasks;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    e.stopPropagation();

    if (e.key === "Escape") {
      onClose();
      return;
    }

    if (e.key === "Enter" && inputValue.trim()) {
      e.preventDefault();
      selectTask(inputValue.trim());
      return;
    }

    // Number keys always select from the visible filtered list
    const num = parseInt(e.key);
    if (!isNaN(num) && num >= 1 && num <= 9) {
      const idx = num - 1;
      if (idx < filteredTasks.length) {
        e.preventDefault();
        selectTask(filteredTasks[idx].title);
      }
    }
  };

  // Intercept number input so digits don't appear in the text field
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    // Strip any digit characters — number keys are used for selection
    const stripped = val.replace(/[0-9]/g, "");
    setInputValue(stripped);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[18vh]">
          {/* Overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: -20 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
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
                </div>
                {currentTask && (
                  <button
                    onClick={clearTask}
                    className="flex items-center gap-1 text-xs text-gray-400 hover:text-red-500 dark:text-gray-500 dark:hover:text-red-400 transition-colors"
                  >
                    <X size={12} />
                    Clear
                  </button>
                )}
              </div>

              {/* Input */}
              <div className="p-4 pb-2">
                <input
                  ref={inputRef}
                  type="text"
                  value={inputValue}
                  onChange={handleChange}
                  onKeyDown={handleKeyDown}
                  placeholder={
                    currentTask
                      ? currentTask
                      : "Type a task or pick from below..."
                  }
                  className="w-full text-base bg-transparent border-none focus:outline-none text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
                  autoFocus
                />
              </div>

              {/* Task list */}
              {filteredTasks.length > 0 && (
                <div className="px-2 pb-2 max-h-[400px] overflow-y-auto">
                  <div className="space-y-0.5">
                    {filteredTasks.map((task, idx) => {
                      const num = idx < 9 ? idx + 1 : null;
                      const isCurrentlySelected = currentTask === task.title;

                      return (
                        <button
                          key={task.id}
                          onClick={() => selectTask(task.title)}
                          className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left text-sm transition-colors ${
                            isCurrentlySelected
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
                          <span className="truncate">{task.title}</span>
                          {task.type !== "day" && (
                            <span className="ml-auto text-[10px] text-gray-400 dark:text-gray-500 font-medium shrink-0">
                              {task.type}
                            </span>
                          )}
                          {isCurrentlySelected && (
                            <span className={`${task.type !== "day" ? "" : "ml-auto"} text-[10px] text-indigo-500 dark:text-indigo-400 font-medium shrink-0`}>
                              current
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Footer */}
              <div className="px-4 py-2 bg-gray-50 dark:bg-gray-800/50 flex justify-between items-center text-xs text-gray-500 dark:text-gray-400">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1">
                    <kbd className="px-1.5 py-0.5 rounded bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 font-mono text-[10px]">
                      1-9
                    </kbd>
                    <span>select</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <kbd className="px-1.5 py-0.5 rounded bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 font-mono text-[10px]">
                      Enter
                    </kbd>
                    <span>confirm</span>
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
