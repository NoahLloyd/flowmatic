import React from "react";

interface CompassCurrentTasksProps {
  tasks: string[];
  onRemoveTask: (title: string) => void;
}

const CompassCurrentTasks: React.FC<CompassCurrentTasksProps> = ({
  tasks,
  onRemoveTask,
}) => {
  const isSingle = tasks.length === 1;

  return (
    <div className="flex flex-col gap-1.5">
      {tasks.map((title, idx) => (
        <div
          key={title + idx}
          onClick={() => onRemoveTask(title)}
          title="Remove task"
          className={`group flex items-center gap-3 rounded-lg bg-indigo-50 dark:bg-indigo-900/30 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 cursor-pointer transition-colors ${
            isSingle ? "px-5 py-3" : "px-3.5 py-2"
          }`}
        >
          {!isSingle && (
            <span
              className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                idx === 0
                  ? "bg-indigo-500 dark:bg-indigo-400"
                  : "bg-indigo-300/60 dark:bg-indigo-500/40"
              }`}
            />
          )}
          <span
            className={`flex-1 font-normal text-gray-900 dark:text-white truncate ${
              isSingle ? "text-3xl leading-tight" : "text-base"
            }`}
          >
            {title}
          </span>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onRemoveTask(title);
            }}
            className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 dark:text-gray-500 dark:hover:text-red-400 text-xs transition-opacity"
            title="Remove"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
};

export default CompassCurrentTasks;
