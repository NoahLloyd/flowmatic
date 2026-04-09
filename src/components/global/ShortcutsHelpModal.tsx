import React, { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";

interface ShortcutsHelpModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentPage: string;
}

interface ShortcutEntry {
  key: string;
  label: string;
}

interface ShortcutSection {
  title: string;
  shortcuts: ShortcutEntry[];
}

const ShortcutsHelpModal: React.FC<ShortcutsHelpModalProps> = ({
  isOpen,
  onClose,
  currentPage,
}) => {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" || e.key === "?") {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [isOpen, onClose]);

  const globalSections: ShortcutSection[] = [
    {
      title: "Navigation",
      shortcuts: [
        { key: "C", label: "Go to Compass" },
        { key: "T", label: "Go to Tasks" },
        { key: "M", label: "Go to Morning" },
        { key: "R", label: "Go to Review" },
        { key: "N", label: "Go to Notes" },
        { key: "I", label: "Go to Insights" },
        { key: "S", label: "Go to Settings" },
      ],
    },
    {
      title: "Quick Actions",
      shortcuts: [
        { key: "A", label: "Quick add task" },
        { key: "O", label: "Quick add note" },
        { key: "W / ⌥W", label: "Set current task" },
        { key: "⌥F", label: "Finish session (global)" },
        { key: "?", label: "Show this help" },
      ],
    },
    {
      title: "Scrolling & Layout",
      shortcuts: [
        { key: "J", label: "Scroll down" },
        { key: "K", label: "Scroll up" },
        { key: "\\", label: "Toggle focus mode" },
      ],
    },
  ];

  const compassSection: ShortcutSection[] = [
    {
      title: "Timer",
      shortcuts: [
        { key: "Space", label: "Start / pause timer" },
        { key: "+", label: "Add 1 minute" },
        { key: "-", label: "Subtract 1 minute" },
        { key: "=", label: "Add 10 minutes" },
        { key: "_", label: "Subtract 10 minutes" },
        { key: "0", label: "Reset timer" },
        { key: "F", label: "Finish session / record" },
      ],
    },
    {
      title: "Signals",
      shortcuts: [
        { key: "1-9", label: "Select signal by number" },
      ],
    },
    {
      title: "Task Mode (on Compass)",
      shortcuts: [
        { key: "U", label: "Enter task mode" },
        { key: "1-9", label: "Select task by number" },
        { key: "Enter / Space", label: "Toggle task complete" },
        { key: "E", label: "Edit selected task" },
        { key: "D", label: "Delete selected task" },
        { key: "W", label: "Set as current working task" },
        { key: "Esc", label: "Exit task mode" },
      ],
    },
  ];

  const tasksSection: ShortcutSection[] = [
    {
      title: "Tasks Page",
      shortcuts: [
        { key: "A", label: "Focus add task input" },
        { key: "1-5", label: "Select task type (day/week/future/blocked/shopping)" },
      ],
    },
  ];

  const quickAddSection: ShortcutSection[] = [
    {
      title: "Quick Add Task (type selector)",
      shortcuts: [
        { key: "D", label: "Daily task" },
        { key: "W", label: "Weekly task" },
        { key: "F", label: "Future task" },
        { key: "B", label: "Blocked task" },
        { key: "S", label: "Shopping list" },
        { key: "R", label: "Review inbox" },
        { key: "Esc", label: "Go back" },
      ],
    },
  ];

  const notesSection: ShortcutSection[] = [
    {
      title: "Notes Page",
      shortcuts: [
        { key: "Cmd + Enter", label: "Save note" },
      ],
    },
  ];

  const globalShortcutsSection: ShortcutSection[] = [
    {
      title: "Global (works even when app is minimized)",
      shortcuts: [
        { key: "Alt + T", label: "Quick add daily task" },
        { key: "Alt + N", label: "Quick add note" },
        { key: "Hyper + Space", label: "Toggle timer" },
      ],
    },
  ];

  // Build the page-specific sections
  const pageSections: ShortcutSection[] = [];
  if (currentPage === "Compass") {
    pageSections.push(...compassSection);
  } else if (currentPage === "Tasks") {
    pageSections.push(...tasksSection);
  } else if (currentPage === "Notes") {
    pageSections.push(...notesSection);
  }
  pageSections.push(...quickAddSection);

  const allSections = [
    ...globalSections,
    ...pageSections,
    ...globalShortcutsSection,
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={onClose}
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.15 }}
            className="relative w-full max-w-2xl mx-4 max-h-[80vh] overflow-hidden bg-white dark:bg-gray-900 rounded-lg shadow-xl border border-gray-200 dark:border-gray-800 flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex justify-between items-center p-4 border-b border-gray-200 dark:border-gray-800 flex-shrink-0">
              <div>
                <h2 className="text-sm font-medium text-gray-900 dark:text-white">
                  Keyboard Shortcuts
                </h2>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  Showing shortcuts for{" "}
                  <span className="font-medium text-gray-700 dark:text-gray-300">
                    {currentPage}
                  </span>
                </p>
              </div>
              <button
                onClick={onClose}
                className="p-1 rounded-full text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Content */}
            <div className="overflow-y-auto p-4">
              <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                {allSections.map((section) => (
                  <div key={section.title}>
                    <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
                      {section.title}
                    </h3>
                    <div className="space-y-1.5">
                      {section.shortcuts.map((shortcut) => (
                        <div
                          key={shortcut.key + shortcut.label}
                          className="flex items-center justify-between"
                        >
                          <span className="text-sm text-gray-700 dark:text-gray-300">
                            {shortcut.label}
                          </span>
                          <div className="flex items-center gap-1 ml-3 flex-shrink-0">
                            {shortcut.key.split(" + ").map((k, i) => (
                              <span key={i} className="flex items-center gap-1">
                                {i > 0 && (
                                  <span className="text-gray-400 text-xs">+</span>
                                )}
                                <kbd className="px-1.5 py-0.5 min-w-[1.5rem] text-center rounded bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 font-mono text-xs text-gray-700 dark:text-gray-300">
                                  {k}
                                </kbd>
                              </span>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Footer */}
            <div className="flex justify-between items-center px-4 py-3 border-t border-gray-200 dark:border-gray-800 flex-shrink-0">
              <span className="text-xs text-gray-400 dark:text-gray-500">
                Press <kbd className="px-1 py-0.5 rounded bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 font-mono text-xs">?</kbd> or <kbd className="px-1 py-0.5 rounded bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 font-mono text-xs">Esc</kbd> to close
              </span>
              <span className="text-xs text-gray-400 dark:text-gray-500">
                Shortcuts are disabled when typing in inputs
              </span>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default ShortcutsHelpModal;
