import React, { useState, useEffect, useRef } from "react";
import { TaskType } from "../../types/Task";

interface AddTaskFormProps {
  onAddTask: (title: string, type: TaskType) => void;
  currentType: TaskType;
}

const AddTaskForm: React.FC<AddTaskFormProps> = ({
  onAddTask,
  currentType,
}) => {
  const [title, setTitle] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (title.trim()) {
      onAddTask(title.trim(), currentType);
      setTitle("");
    }
  };

  // Add keyboard shortcut for focusing the input using 'a' key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Skip if already in an input field
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      ) {
        return;
      }

      // 'a' shortcut to focus on the input (no command/ctrl needed)
      if (e.key === "a") {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <form onSubmit={handleSubmit}>
      <div className="flex gap-2">
        <input
          ref={inputRef}
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.currentTarget.blur();
            }
          }}
          placeholder="Add a new task..."
          className="flex-grow p-2.5 rounded-md border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 text-sm focus:outline-none focus:ring-1 focus:ring-gray-400 dark:focus:ring-gray-500 focus:border-gray-400 dark:focus:border-gray-500"
        />
        <button
          type="submit"
          className="px-4 py-2 bg-gray-900 dark:bg-white hover:bg-gray-800 dark:hover:bg-gray-200 text-white dark:text-gray-900 text-sm rounded-md transition-colors"
        >
          Add
        </button>
      </div>
    </form>
  );
};

export default AddTaskForm;
