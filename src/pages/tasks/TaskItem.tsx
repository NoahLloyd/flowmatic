import React, { useState } from "react";
import { Task, TaskType } from "../../types/Task";

interface TaskItemProps {
  task: Task;
  onToggleComplete: (id: string) => void;
  onDelete: (id: string) => void;
  onChangeTaskType: (id: string, type: TaskType) => void;
  onUpdateTitle: (id: string, title: string) => void;
}

const TaskItem: React.FC<TaskItemProps> = ({
  task,
  onToggleComplete,
  onDelete,
  onChangeTaskType,
  onUpdateTitle,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editedTitle, setEditedTitle] = useState(task.title);
  const types: TaskType[] = ["day", "week", "future"];

  const handleSaveTitle = () => {
    if (editedTitle.trim() && editedTitle !== task.title) {
      onUpdateTitle(task._id, editedTitle);
    } else {
      setEditedTitle(task.title); // Reset to original if empty
    }
    setIsEditing(false);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSaveTitle();
    } else if (e.key === "Escape") {
      setEditedTitle(task.title);
      setIsEditing(false);
    }
  };

  return (
    <div className="flex items-center gap-4 p-4 bg-slate-50 dark:bg-slate-800 rounded-lg shadow-sm hover:shadow-md transition-shadow">
      <input
        type="checkbox"
        checked={task.completed}
        onChange={() => onToggleComplete(task._id)}
        className="w-5 h-5 rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500 dark:bg-gray-700"
      />
      <div className="flex-grow">
        {isEditing ? (
          <input
            type="text"
            value={editedTitle}
            onChange={(e) => setEditedTitle(e.target.value)}
            onBlur={handleSaveTitle}
            onKeyDown={handleKeyPress}
            className="w-full px-2 py-1 border rounded focus:outline-none focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            autoFocus
          />
        ) : (
          <span
            className={`cursor-pointer hover:text-gray-700 dark:text-gray-200 dark:hover:text-gray-300 ${
              task.completed
                ? "line-through text-gray-400 dark:text-gray-500"
                : ""
            }`}
            onClick={() => setIsEditing(true)}
          >
            {task.title}
          </span>
        )}
        {task.completedAt && (
          <div className="text-sm text-gray-500 dark:text-gray-400">
            Completed: {task.completedAt.toLocaleString()}
          </div>
        )}
      </div>
      <div className="flex items-center gap-2">
        {types
          .filter((type) => type !== task.type)
          .map((type) => (
            <button
              key={type}
              onClick={() => onChangeTaskType(task._id, type)}
              className="px-2 py-1 text-sm rounded-md border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 dark:text-gray-200 dark:bg-gray-800"
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
  );
};

export default TaskItem;
