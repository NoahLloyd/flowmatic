import React, { useState, useEffect, useCallback } from "react";
import {
  Plus,
  Trash2,
  Check,
  Loader,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { api } from "../../../utils/api";
import { Task, TaskType } from "../../../types/Task";
import { useToast } from "../../../context/ToastContext";
import { dispatchTaskAdded } from "../../../utils/taskEvents";

interface WeeklyTaskPlannerProps {
  disabled?: boolean;
}

const TYPE_LABELS: Record<string, string> = {
  week: "Weekly",
  day: "Daily",
  future: "Future",
  blocked: "Blocked",
  shopping: "Shopping",
};

const WeeklyTaskPlanner: React.FC<WeeklyTaskPlannerProps> = ({
  disabled = false,
}) => {
  const { showToast } = useToast();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [addingToType, setAddingToType] = useState<TaskType>("week");
  const [isAdding, setIsAdding] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const loadTasks = useCallback(async () => {
    setIsLoading(true);
    try {
      const activeTasks = await api.getActiveTasks();
      setTasks(activeTasks);
    } catch (error) {
      console.error("Failed to load tasks:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  const handleAddTask = async () => {
    if (!newTaskTitle.trim() || disabled) return;
    setIsAdding(true);
    try {
      const task = await api.createTask({
        title: newTaskTitle.trim(),
        type: addingToType,
        completed: false,
        completedAt: null,
        createdAt: new Date(),
      });
      setTasks((prev) => [task, ...prev]);
      setNewTaskTitle("");
      dispatchTaskAdded(task);
      showToast(`Task added`, "success");
    } catch (error) {
      console.error("Failed to add task:", error);
      showToast("Failed to add task", "error");
    } finally {
      setIsAdding(false);
    }
  };

  const handleMoveTask = async (taskId: string, newType: TaskType) => {
    if (disabled) return;
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;

    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, type: newType } : t))
    );

    try {
      await api.updateTask(taskId, { type: newType });
    } catch (error) {
      setTasks((prev) =>
        prev.map((t) => (t.id === taskId ? { ...t, type: task.type } : t))
      );
      showToast("Failed to move task", "error");
    }
  };

  const handleCompleteTask = async (taskId: string) => {
    if (disabled) return;
    setTasks((prev) => prev.filter((t) => t.id !== taskId));

    try {
      await api.updateTask(taskId, { completed: true });
    } catch (error) {
      loadTasks();
      showToast("Failed to complete task", "error");
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    if (disabled) return;
    setTasks((prev) => prev.filter((t) => t.id !== taskId));

    try {
      await api.deleteTask(taskId);
    } catch (error) {
      loadTasks();
      showToast("Failed to delete task", "error");
    }
  };

  // Group tasks by type
  const typeOrder: TaskType[] = ["week", "day", "future", "blocked"];
  const grouped: Record<string, Task[]> = {};
  for (const type of typeOrder) {
    const filtered = tasks.filter((t) => t.type === type);
    if (filtered.length > 0) grouped[type] = filtered;
  }
  const shopping = tasks.filter((t) => t.type === "shopping");
  if (shopping.length > 0) grouped["shopping"] = shopping;

  const totalTasks = tasks.length;

  if (isLoading) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-6 flex items-center justify-center">
        <Loader className="w-5 h-5 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Quick add */}
      <div className="flex items-center gap-2">
        <div className="flex items-center border border-slate-200 dark:border-slate-700 rounded-md overflow-hidden">
          {(["week", "day", "future"] as TaskType[]).map((type) => (
            <button
              key={type}
              onClick={() => setAddingToType(type)}
              disabled={disabled}
              className={`px-2.5 py-1.5 text-xs transition-colors ${
                addingToType === type
                  ? "bg-slate-800 dark:bg-slate-200 text-white dark:text-slate-900"
                  : "text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
              }`}
            >
              {TYPE_LABELS[type]?.[0]}
            </button>
          ))}
        </div>
        <input
          type="text"
          value={newTaskTitle}
          onChange={(e) => setNewTaskTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleAddTask();
            if (e.key === "Escape") (e.target as HTMLInputElement).blur();
          }}
          placeholder="Add task..."
          disabled={disabled || isAdding}
          className="flex-1 px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md text-sm text-slate-700 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-400"
        />
        <button
          onClick={handleAddTask}
          disabled={disabled || isAdding || !newTaskTitle.trim()}
          className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors disabled:opacity-30"
        >
          {isAdding ? (
            <Loader className="w-4 h-4 animate-spin" />
          ) : (
            <Plus className="w-4 h-4" />
          )}
        </button>
      </div>

      {/* Task list - expandable */}
      {totalTasks > 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
          <button
            onClick={() => setExpanded(!expanded)}
            className="w-full flex items-center justify-between px-4 py-2.5 text-left"
          >
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              {totalTasks} active {totalTasks === 1 ? "task" : "tasks"}
            </span>
            {expanded ? (
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
            )}
          </button>

          {expanded && (
            <div className="border-t border-slate-100 dark:border-slate-700">
              {Object.entries(grouped).map(([type, typeTasks]) => (
                <div key={type}>
                  {/* Type header */}
                  <div className="px-4 py-1.5 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-700">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                      {TYPE_LABELS[type] || type} ({typeTasks.length})
                    </span>
                  </div>

                  {/* Tasks */}
                  <div className="divide-y divide-slate-50 dark:divide-slate-800">
                    {typeTasks.map((task) => (
                      <div
                        key={task.id}
                        className="flex items-center px-4 py-2 group"
                      >
                        <button
                          onClick={() => handleCompleteTask(task.id)}
                          disabled={disabled}
                          className="w-4 h-4 rounded border border-slate-300 dark:border-slate-600 flex items-center justify-center mr-3 flex-shrink-0 text-slate-300 dark:text-slate-600 hover:border-slate-500 dark:hover:border-slate-400 hover:text-slate-500 dark:hover:text-slate-400 transition-colors disabled:cursor-not-allowed"
                        >
                          <Check className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </button>

                        <span className="text-sm text-slate-700 dark:text-slate-200 flex-1 min-w-0 truncate">
                          {task.title}
                        </span>

                        {/* Move actions */}
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity ml-2 flex-shrink-0">
                          {type !== "week" && (
                            <button
                              onClick={() => handleMoveTask(task.id, "week")}
                              disabled={disabled}
                              className="text-[10px] px-1.5 py-0.5 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                              title="Move to Weekly"
                            >
                              W
                            </button>
                          )}
                          {type !== "day" && (
                            <button
                              onClick={() => handleMoveTask(task.id, "day")}
                              disabled={disabled}
                              className="text-[10px] px-1.5 py-0.5 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                              title="Move to Daily"
                            >
                              D
                            </button>
                          )}
                          {type !== "future" && type !== "shopping" && (
                            <button
                              onClick={() => handleMoveTask(task.id, "future")}
                              disabled={disabled}
                              className="text-[10px] px-1.5 py-0.5 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                              title="Move to Future"
                            >
                              F
                            </button>
                          )}
                          <button
                            onClick={() => handleDeleteTask(task.id)}
                            disabled={disabled}
                            className="p-0.5 text-slate-300 dark:text-slate-600 hover:text-red-400 dark:hover:text-red-400 transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default WeeklyTaskPlanner;
