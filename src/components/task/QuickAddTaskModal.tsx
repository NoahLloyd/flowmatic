import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ArrowRight, CheckCircle2 } from "lucide-react";

import { TaskType } from "../../types/Task";

interface QuickAddTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddTask: (title: string, type: TaskType) => Promise<void>;
  onAddToReviewInbox: (item: string) => Promise<void>;
}

const QuickAddTaskModal: React.FC<QuickAddTaskModalProps> = ({
  isOpen,
  onClose,
  onAddTask,
  onAddToReviewInbox,
}) => {
  const [taskTitle, setTaskTitle] = useState("");
  const [step, setStep] = useState<"input" | "type">("input");
  const inputRef = useRef<HTMLInputElement>(null);
  const typeContainerRef = useRef<HTMLDivElement>(null);

  // Focus the input when the modal opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  // Focus the type selection container when switching to type selection step
  useEffect(() => {
    if (step === "type" && typeContainerRef.current) {
      typeContainerRef.current.focus();
    }
  }, [step]);

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setTaskTitle("");
      setStep("input");
    }
  }, [isOpen]);

  const handleInputKeyDown = (e: React.KeyboardEvent) => {
    // Prevent these keypress events from propagating to avoid navigation conflicts
    e.stopPropagation();

    if (e.key === "Escape") {
      onClose();
    } else if (e.key === "Enter" && taskTitle.trim()) {
      e.preventDefault();
      // Move to type selection step
      setStep("type");
    }
  };

  const handleTypeKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    // Prevent these keypress events from propagating to avoid navigation conflicts
    e.stopPropagation();

    if (e.key === "Escape") {
      // Go back to input step
      setStep("input");
    } else if (e.key.toLowerCase() === "d") {
      // Add as daily task
      onClose(); // Close immediately
      onAddTask(taskTitle, "day"); // Let it run in background
    } else if (e.key.toLowerCase() === "w") {
      // Add as weekly task
      onClose(); // Close immediately
      onAddTask(taskTitle, "week"); // Let it run in background
    } else if (e.key.toLowerCase() === "f") {
      // Add as future task
      onClose(); // Close immediately
      onAddTask(taskTitle, "future"); // Let it run in background
    } else if (e.key.toLowerCase() === "b") {
      // Add as blocked task
      onClose(); // Close immediately
      onAddTask(taskTitle, "blocked"); // Let it run in background
    } else if (e.key.toLowerCase() === "s") {
      // Add as shopping task
      onClose(); // Close immediately
      onAddTask(taskTitle, "shopping"); // Let it run in background
    } else if (e.key.toLowerCase() === "r") {
      // Add to review inbox
      onClose(); // Close immediately
      onAddToReviewInbox(taskTitle); // Let it run in background
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Overlay with blur effect */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={onClose} // Allow clicking outside to close
          />

          {/* Modal container */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.15 }}
            className="relative w-full max-w-md mx-4 overflow-hidden bg-white dark:bg-gray-900 rounded-lg shadow-xl border border-gray-200 dark:border-gray-800"
            onClick={(e) => e.stopPropagation()} // Prevent clicks inside from closing
          >
            {/* Header */}
            <div className="flex justify-between items-center p-4 border-b border-gray-200 dark:border-gray-800">
              <h2 className="text-sm font-medium text-gray-900 dark:text-white">
                {step === "input" ? "Quick Add Task" : "Select Task Type"}
              </h2>
              <button
                onClick={onClose}
                className="p-1 rounded-full text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {step === "input" ? (
              <div className="p-4">
                <input
                  ref={inputRef}
                  type="text"
                  value={taskTitle}
                  onChange={(e) => setTaskTitle(e.target.value)}
                  onKeyDown={handleInputKeyDown}
                  placeholder="What do you need to do?"
                  className="w-full p-2.5 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-md focus:outline-none focus:ring-1 focus:ring-gray-400 dark:focus:ring-gray-500 text-gray-800 dark:text-gray-200 text-sm"
                  autoFocus
                />

                <div className="flex justify-between items-center mt-3 text-xs text-gray-500 dark:text-gray-400">
                  <div className="flex items-center gap-1">
                    <kbd className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 font-mono">
                      Enter
                    </kbd>
                    <span>to continue</span>
                  </div>

                  <div className="flex items-center gap-1">
                    <kbd className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 font-mono">
                      Esc
                    </kbd>
                    <span>to cancel</span>
                  </div>
                </div>
              </div>
            ) : (
              <div
                ref={typeContainerRef}
                className="p-4 outline-none"
                onKeyDown={handleTypeKeyDown}
                tabIndex={0}
                autoFocus
                style={{ outline: "none" }} // Ensure no focus outline
              >
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                  Adding: "{taskTitle}"
                </p>

                <div className="space-y-2">
                  {/* Daily Task */}
                  <button
                    onClick={() => {
                      onClose(); // Close immediately
                      onAddTask(taskTitle, "day"); // Let it run in background
                    }}
                    className="w-full flex items-center p-3 text-sm rounded-md border border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 transition-colors"
                  >
                    <div className="flex-shrink-0 mr-3">
                      <kbd className="inline-flex items-center justify-center w-7 h-7 rounded border border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800 font-mono text-gray-800 dark:text-gray-200">
                        D
                      </kbd>
                    </div>
                    <span className="font-medium">Daily Task</span>
                  </button>

                  {/* Weekly Task */}
                  <button
                    onClick={() => {
                      onClose(); // Close immediately
                      onAddTask(taskTitle, "week"); // Let it run in background
                    }}
                    className="w-full flex items-center p-3 text-sm rounded-md border border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 transition-colors"
                  >
                    <div className="flex-shrink-0 mr-3">
                      <kbd className="inline-flex items-center justify-center w-7 h-7 rounded border border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800 font-mono text-gray-800 dark:text-gray-200">
                        W
                      </kbd>
                    </div>
                    <span className="font-medium">Weekly Task</span>
                  </button>

                  {/* Future Task */}
                  <button
                    onClick={() => {
                      onClose(); // Close immediately
                      onAddTask(taskTitle, "future"); // Let it run in background
                    }}
                    className="w-full flex items-center p-3 text-sm rounded-md border border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 transition-colors"
                  >
                    <div className="flex-shrink-0 mr-3">
                      <kbd className="inline-flex items-center justify-center w-7 h-7 rounded border border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800 font-mono text-gray-800 dark:text-gray-200">
                        F
                      </kbd>
                    </div>
                    <span className="font-medium">Future Task</span>
                  </button>

                  {/* Blocked Task */}
                  <button
                    onClick={() => {
                      onClose(); // Close immediately
                      onAddTask(taskTitle, "blocked"); // Let it run in background
                    }}
                    className="w-full flex items-center p-3 text-sm rounded-md border border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 transition-colors"
                  >
                    <div className="flex-shrink-0 mr-3">
                      <kbd className="inline-flex items-center justify-center w-7 h-7 rounded border border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800 font-mono text-gray-800 dark:text-gray-200">
                        B
                      </kbd>
                    </div>
                    <span className="font-medium">Blocked Task</span>
                  </button>

                  {/* Shopping Task */}
                  <button
                    onClick={() => {
                      onClose(); // Close immediately
                      onAddTask(taskTitle, "shopping"); // Let it run in background
                    }}
                    className="w-full flex items-center p-3 text-sm rounded-md border border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 transition-colors"
                  >
                    <div className="flex-shrink-0 mr-3">
                      <kbd className="inline-flex items-center justify-center w-7 h-7 rounded border border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800 font-mono text-gray-800 dark:text-gray-200">
                        S
                      </kbd>
                    </div>
                    <span className="font-medium">Shopping List</span>
                  </button>

                  {/* Review Inbox */}
                  <button
                    onClick={() => {
                      onClose(); // Close immediately
                      onAddToReviewInbox(taskTitle); // Let it run in background
                    }}
                    className="w-full flex items-center p-3 text-sm rounded-md border border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 transition-colors"
                  >
                    <div className="flex-shrink-0 mr-3">
                      <kbd className="inline-flex items-center justify-center w-7 h-7 rounded border border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800 font-mono text-gray-800 dark:text-gray-200">
                        R
                      </kbd>
                    </div>
                    <span className="font-medium">Review Inbox</span>
                  </button>
                </div>

                <div className="mt-3 text-xs text-gray-500 dark:text-gray-400 flex justify-between">
                  <span>Press a key to select</span>
                  <div className="flex items-center gap-1">
                    <kbd className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 font-mono">
                      Esc
                    </kbd>
                    <span>to go back</span>
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default QuickAddTaskModal;
