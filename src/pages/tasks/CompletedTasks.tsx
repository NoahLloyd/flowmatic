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
  onChangeTaskType,
  onToggleComplete,
  onUpdateTitle,
}) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");

  const types: TaskType[] = ["day", "week", "future"];

  const getTagColor = (type: TaskType) => {
    switch (type) {
      case "day":
        return "bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-100";
      case "week":
        return "bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-100";
      case "future":
        return "bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-100";
      default:
        return "bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-100";
    }
  };

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

  return (
    <div className="space-y-2">
      {tasks.map((task) => (
        <div
          key={task._id}
          className="flex items-center gap-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg"
        >
          <input
            type="checkbox"
            checked={true}
            onChange={() => onToggleComplete(task._id)}
            className="w-5 h-5 rounded border-gray-300 dark:border-gray-600 text-blue-600 dark:text-blue-500 focus:ring-blue-500 dark:focus:ring-blue-400"
          />
          <div className="flex-grow">
            <div className="flex items-center gap-2">
              {editingId === task._id ? (
                <input
                  type="text"
                  value={editingTitle}
                  onChange={(e) => setEditingTitle(e.target.value)}
                  onBlur={() => handleSaveEdit(task._id)}
                  onKeyPress={(e) =>
                    e.key === "Enter" && handleSaveEdit(task._id)
                  }
                  className="border dark:border-gray-600 rounded px-2 py-1 text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 focus:outline-none focus:border-blue-500 dark:focus:border-blue-400"
                  autoFocus
                />
              ) : (
                <span
                  className="text-gray-400 dark:text-gray-500 cursor-pointer hover:text-gray-600 dark:hover:text-gray-300"
                  onClick={() => handleStartEdit(task)}
                >
                  {task.title}
                </span>
              )}
              <span
                className={`px-2 py-1 rounded-full text-xs font-medium ${getTagColor(
                  task.type
                )}`}
              >
                {task.type.charAt(0).toUpperCase() + task.type.slice(1)}
              </span>
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {formatDate(task.completedAt)}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {types
              .filter((type) => type !== task.type)
              .map((type) => (
                <button
                  key={type}
                  onClick={() => onChangeTaskType(task._id, type)}
                  className="px-2 py-1 text-sm rounded-md border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
                >
                  {type.charAt(0).toUpperCase() + type.slice(1)}
                </button>
              ))}
            <button
              onClick={() => onDelete(task._id)}
              className="p-1.5 rounded-md bg-red-50 dark:bg-red-900/30 text-red-500 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/50"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5"
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
