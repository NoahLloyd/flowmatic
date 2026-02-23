import React, { useState } from "react";
import { Task, TaskType } from "../../types/Task";
import { Draggable } from "react-beautiful-dnd";

interface TaskItemProps {
  task: Task;
  index: number;
  onToggleComplete: (id: string) => void;
  onDelete: (id: string) => void;
  onChangeTaskType: (id: string, type: TaskType) => void;
  onUpdateTitle: (id: string, title: string) => void;
}

const TaskItem: React.FC<TaskItemProps> = ({
  task,
  index,
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
      onUpdateTitle(task.id, editedTitle);
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

  // Custom checkbox for better dark mode appearance
  const CustomCheckbox = () => (
    <div
      onClick={() => onToggleComplete(task.id)}
      className={`w-4 h-4 shrink-0 rounded flex items-center justify-center cursor-pointer border ${
        task.completed
          ? "bg-gray-900 dark:bg-white border-gray-900 dark:border-white"
          : "border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800"
      }`}
    >
      {task.completed && (
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
      )}
    </div>
  );

  return (
    <Draggable key={task.id} draggableId={task.id} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          className={`flex items-center gap-4 p-4 bg-white dark:bg-gray-900 rounded-md border border-gray-200 dark:border-gray-800 transition-all hover:border-gray-300 dark:hover:border-gray-700 ${
            snapshot.isDragging
              ? "shadow-lg ring-2 ring-blue-500 dark:ring-blue-400"
              : ""
          }`}
        >
          <CustomCheckbox />
          <div className="flex-grow min-w-0">
            {isEditing ? (
              <input
                type="text"
                value={editedTitle}
                onChange={(e) => setEditedTitle(e.target.value)}
                onBlur={handleSaveTitle}
                onKeyDown={handleKeyPress}
                className="w-full p-2 border border-gray-200 dark:border-gray-800 rounded-md focus:outline-none focus:ring-1 focus:ring-gray-400 dark:focus:ring-gray-500 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 text-sm"
                autoFocus
              />
            ) : (
              <span
                className={`cursor-pointer text-gray-800 dark:text-gray-200 text-sm ${
                  task.completed ? "text-gray-400 dark:text-gray-500" : ""
                }`}
                onClick={() => setIsEditing(true)}
              >
                {task.title}
              </span>
            )}
            {task.completedAt && (
              <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Completed: {new Date(task.completedAt).toLocaleString()}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {types
              .filter((type) => type !== task.type)
              .map((type) => (
                <button
                  key={type}
                  onClick={() => onChangeTaskType(task.id, type)}
                  className="px-2 py-1 text-xs rounded-md border border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300"
                >
                  {type.charAt(0).toUpperCase() + type.slice(1)}
                </button>
              ))}
            <button
              onClick={() => onDelete(task.id)}
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
      )}
    </Draggable>
  );
};

export default TaskItem;
