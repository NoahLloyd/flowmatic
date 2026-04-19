import React, { useEffect } from "react";
import { TaskType } from "../../types/Task";

export type TaskTab = TaskType | "obsidian";

interface TaskTypeSelectorProps {
  selectedType: TaskTab;
  onTypeSelect: (type: TaskTab) => void;
}

const TaskTypeSelector: React.FC<TaskTypeSelectorProps> = ({
  selectedType,
  onTypeSelect,
}) => {
  const types: TaskTab[] = [
    "day",
    "week",
    "future",
    "blocked",
    "shopping",
    "obsidian",
  ];

  const shortcuts: Record<TaskTab, string> = {
    day: "1",
    week: "2",
    future: "3",
    blocked: "4",
    shopping: "5",
    obsidian: "6",
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      ) {
        return;
      }

      switch (e.key) {
        case "1":
          onTypeSelect("day");
          break;
        case "2":
          onTypeSelect("week");
          break;
        case "3":
          onTypeSelect("future");
          break;
        case "4":
          onTypeSelect("blocked");
          break;
        case "5":
          onTypeSelect("shopping");
          break;
        case "6":
          onTypeSelect("obsidian");
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onTypeSelect]);

  return (
    <div className="flex gap-2 py-2">
      {types.map((type) => (
        <button
          key={type}
          onClick={() => onTypeSelect(type)}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center justify-between gap-2
            ${
              selectedType === type
                ? "bg-gray-900 text-white dark:bg-white dark:text-gray-900"
                : "bg-white text-gray-700 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700"
            }`}
        >
          <span>{type.charAt(0).toUpperCase() + type.slice(1)}</span>
          <kbd
            className={`px-1 py-0.5 text-xs rounded ${
              selectedType === type
                ? "bg-gray-800 text-gray-300 dark:bg-gray-200 dark:text-gray-800"
                : "bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400"
            } font-mono`}
          >
            {shortcuts[type]}
          </kbd>
        </button>
      ))}
    </div>
  );
};

export default TaskTypeSelector;
