import React, { useState } from "react";
import { Task, TaskType } from "../../types/Task";

interface CompletedTasksProps {
  tasks: Task[];
  onDelete: (id: string) => void;
  onChangeTaskType: (id: string, type: TaskType) => void;
  onToggleComplete: (id: string) => void;
  onUpdateTitle: (id: string, title: string) => void;
}

const CompletedTasks: React.FC<CompletedTasksProps> = ({
  tasks,
  onDelete,
  onToggleComplete,
  onUpdateTitle,
}) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");

  const formatDate = (date: Date | null | string) => {
    if (!date) return "";
    try {
      const dateObject = date instanceof Date ? date : new Date(date);
      if (isNaN(dateObject.getTime())) return "";

      return new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "numeric",
      }).format(dateObject);
    } catch (error) {
      console.error("Error formatting date:", error);
      return "";
    }
  };

  const handleStartEdit = (task: Task) => {
    setEditingId(task._id);
    setEditingTitle(task.title);
  };

  const handleSaveEdit = (id: string) => {
    onUpdateTitle(id, editingTitle);
    setEditingId(null);
  };

  // Custom checkbox for better dark mode appearance
  const CustomCheckbox = () => (
    <div
      className="w-4 h-4 shrink-0 rounded flex items-center justify-center cursor-pointer border bg-gray-900 dark:bg-white border-gray-900 dark:border-white"
      onClick={() => {}} // Just for consistency, doesn't need functionality
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className="h-3 w-3 text-white dark:text-gray-900"
        viewBox="0 0 20 20"
        fill="currentColor"
      >
        <path
          fillRule="evenodd"
          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
          clipRule="evenodd"
        />
      </svg>
    </div>
  );

  return (
    <div className="space-y-3">
      {tasks.map((task) => (
        <div
          key={task._id}
          className="flex items-center gap-4 p-4 bg-white dark:bg-gray-900 rounded-md border border-gray-200 dark:border-gray-800 transition-all"
        >
          <div className="shrink-0" onClick={() => onToggleComplete(task._id)}>
            <CustomCheckbox />
          </div>
          <div className="flex-grow min-w-0">
            {editingId === task._id ? (
              <input
                type="text"
                value={editingTitle}
                onChange={(e) => setEditingTitle(e.target.value)}
                onBlur={() => handleSaveEdit(task._id)}
                onKeyPress={(e) =>
                  e.key === "Enter" && handleSaveEdit(task._id)
                }
                className="p-2 border border-gray-200 dark:border-gray-800 rounded-md focus:outline-none focus:ring-1 focus:ring-gray-400 dark:focus:ring-gray-500 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 text-sm"
                autoFocus
              />
            ) : (
              <span
                className="text-gray-400 dark:text-gray-500 cursor-pointer hover:text-gray-600 dark:hover:text-gray-400 text-sm"
                onClick={() => handleStartEdit(task)}
              >
                {task.title}
              </span>
            )}
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <span className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
              {formatDate(task.completedAt)}
            </span>
            <button
              onClick={() => onDelete(task._id)}
              className="p-1.5 rounded-md text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-red-500 dark:hover:text-red-400 transition-colors"
              aria-label="Delete task"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-4 w-4"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};

export default CompletedTasks;
