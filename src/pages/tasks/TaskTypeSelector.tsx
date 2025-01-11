import React from "react";
import { TaskType } from "../../types/Task";

interface TaskTypeSelectorProps {
  selectedType: TaskType;
  onTypeSelect: (type: TaskType) => void;
}

const TaskTypeSelector: React.FC<TaskTypeSelectorProps> = ({
  selectedType,
  onTypeSelect,
}) => {
  const types: TaskType[] = ["day", "week", "future"];

  return (
    <div className="flex gap-2 mb-6">
      {types.map((type) => (
        <button
          key={type}
          onClick={() => onTypeSelect(type)}
          className={`px-4 py-2 rounded-lg font-medium transition-colors
            ${
              selectedType === type
                ? "bg-blue-600 text-white dark:bg-blue-500"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
            }`}
        >
          {type.charAt(0).toUpperCase() + type.slice(1)}
        </button>
      ))}
    </div>
  );
};

export default TaskTypeSelector;
