import React from "react";
import { Task, TaskType } from "../../types/Task";

interface TaskItemProps {
  task: Task;
  onToggleComplete: (id: string) => void;
  onDelete: (id: string) => void;
  onChangeTaskType: (id: string, type: TaskType) => void;
}

const TaskItem: React.FC<TaskItemProps> = ({
  task,
  onToggleComplete,
  onDelete,
  onChangeTaskType,
}) => {
  const types: TaskType[] = ["day", "week", "future"];

  return (
    <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-lg shadow-sm hover:shadow-md transition-shadow">
      <input
        type="checkbox"
        checked={task.completed}
        onChange={() => onToggleComplete(task.id)}
        className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
      />
      <div className="flex-grow">
        <span className={task.completed ? "line-through text-gray-400" : ""}>
          {task.title}
        </span>
        {task.completedAt && (
          <div className="text-sm text-gray-500">
            Completed: {task.completedAt.toLocaleString()}
          </div>
        )}
      </div>
      <div className="flex items-center gap-2">
        <select
          value={task.type}
          onChange={(e) =>
            onChangeTaskType(task.id, e.target.value as TaskType)
          }
          className="text-sm rounded-md border-gray-300 focus:border-blue-500 focus:ring-blue-500"
        >
          {types.map((type) => (
            <option key={type} value={type}>
              {type.charAt(0).toUpperCase() + type.slice(1)}
            </option>
          ))}
        </select>
        <button
          onClick={() => onDelete(task.id)}
          className="text-red-500 hover:text-red-700"
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
