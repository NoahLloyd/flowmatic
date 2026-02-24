import React, { useState, useEffect, useCallback } from "react";
import {
  ListTodo,
  Plus,
  ArrowRight,
  ArrowLeft,
  Trash2,
  Check,
  Loader,
  ChevronDown,
  ChevronRight,
  Calendar,
  CalendarDays,
  Hourglass,
  ShieldAlert,
} from "lucide-react";
import { api } from "../../../utils/api";
import { Task, TaskType } from "../../../types/Task";
import { useToast } from "../../../context/ToastContext";
import { dispatchTaskAdded } from "../../../utils/taskEvents";

interface WeeklyTaskPlannerProps {
  disabled?: boolean;
}

const TYPE_CONFIG: Record<
  string,
  { label: string; icon: React.ReactNode; color: string }
> = {
  week: {
    label: "Weekly",
    icon: <CalendarDays className="w-4 h-4" />,
    color:
      "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300",
  },
  day: {
    label: "Daily",
    icon: <Calendar className="w-4 h-4" />,
    color:
      "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300",
  },
  future: {
    label: "Future",
    icon: <Hourglass className="w-4 h-4" />,
    color:
      "bg-slate-50 dark:bg-slate-900/40 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300",
  },
  blocked: {
    label: "Blocked",
    icon: <ShieldAlert className="w-4 h-4" />,
    color:
      "bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800 text-orange-700 dark:text-orange-300",
  },
};

const WeeklyTaskPlanner: React.FC<WeeklyTaskPlannerProps> = ({
  disabled = false,
}) => {
  const { showToast } = useToast();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [addingToType, setAddingToType] = useState<TaskType>("week");
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(
    new Set()
  );
  const [isAdding, setIsAdding] = useState(false);

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

  const toggleSection = (type: string) => {
    setCollapsedSections((prev) => {
      const next = new Set(prev);
      if (next.has(type)) {
        next.delete(type);
      } else {
        next.add(type);
      }
      return next;
    });
  };

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
      showToast(`${TYPE_CONFIG[addingToType]?.label || addingToType} task added`, "success");
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

    // Optimistic update
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, type: newType } : t))
    );

    try {
      await api.updateTask(taskId, { type: newType });
      showToast(
        `Moved to ${TYPE_CONFIG[newType]?.label || newType}`,
        "success"
      );
    } catch (error) {
      // Rollback
      setTasks((prev) =>
        prev.map((t) => (t.id === taskId ? { ...t, type: task.type } : t))
      );
      showToast("Failed to move task", "error");
    }
  };

  const handleCompleteTask = async (taskId: string) => {
    if (disabled) return;

    // Optimistic update - remove from view
    setTasks((prev) => prev.filter((t) => t.id !== taskId));

    try {
      await api.updateTask(taskId, { completed: true });
      showToast("Task completed", "success");
    } catch (error) {
      // Reload to rollback
      loadTasks();
      showToast("Failed to complete task", "error");
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    if (disabled) return;
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;

    // Optimistic update
    setTasks((prev) => prev.filter((t) => t.id !== taskId));

    try {
      await api.deleteTask(taskId);
      showToast("Task deleted", "success");
    } catch (error) {
      // Reload to rollback
      loadTasks();
      showToast("Failed to delete task", "error");
    }
  };

  // Group tasks by type, ordered: week, day, future, blocked
  const typeOrder: TaskType[] = ["week", "day", "future", "blocked"];
  const groupedTasks: Record<string, Task[]> = {};
  typeOrder.forEach((type) => {
    const filtered = tasks.filter((t) => t.type === type);
    if (filtered.length > 0 || type === "week") {
      groupedTasks[type] = filtered;
    }
  });
  // Also include shopping if there are tasks
  const shoppingTasks = tasks.filter((t) => t.type === "shopping");
  if (shoppingTasks.length > 0) {
    groupedTasks["shopping"] = shoppingTasks;
  }

  if (isLoading) {
    return (
      <div className="mb-8">
        <div className="flex items-center space-x-2 mb-3">
          <ListTodo className="w-5 h-5 text-slate-600 dark:text-slate-400" />
          <h2 className="text-lg font-medium text-slate-800 dark:text-slate-100">
            Plan Next Week
          </h2>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-8 flex items-center justify-center">
          <Loader className="w-6 h-6 animate-spin text-slate-400" />
        </div>
      </div>
    );
  }

  return (
    <div className="mb-8">
      <div className="flex items-center space-x-2 mb-3">
        <ListTodo className="w-5 h-5 text-slate-600 dark:text-slate-400" />
        <h2 className="text-lg font-medium text-slate-800 dark:text-slate-100">
          Plan Next Week
        </h2>
        <span className="text-sm text-slate-500 dark:text-slate-400">
          {tasks.length} active {tasks.length === 1 ? "task" : "tasks"}
        </span>
      </div>

      {/* Quick Add Task */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 mb-4">
        <div className="flex items-center space-x-2">
          {/* Type selector */}
          <div className="flex items-center space-x-1">
            {(["week", "day", "future"] as TaskType[]).map((type) => (
              <button
                key={type}
                onClick={() => setAddingToType(type)}
                disabled={disabled}
                className={`px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  addingToType === type
                    ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900"
                    : "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600"
                }`}
              >
                {TYPE_CONFIG[type]?.label || type}
              </button>
            ))}
          </div>
          <input
            type="text"
            value={newTaskTitle}
            onChange={(e) => setNewTaskTitle(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAddTask()}
            placeholder={`Add ${TYPE_CONFIG[addingToType]?.label?.toLowerCase() || ""} task...`}
            disabled={disabled || isAdding}
            className="flex-1 px-3 py-2 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-700 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
          />
          <button
            onClick={handleAddTask}
            disabled={disabled || isAdding || !newTaskTitle.trim()}
            className="p-2 bg-slate-900 dark:bg-white hover:bg-slate-800 dark:hover:bg-slate-100 text-white dark:text-slate-900 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {isAdding ? (
              <Loader className="w-4 h-4 animate-spin" />
            ) : (
              <Plus className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>

      {/* Task Lists by Type */}
      <div className="space-y-3">
        {typeOrder
          .filter((type) => groupedTasks[type])
          .concat(shoppingTasks.length > 0 ? (["shopping"] as TaskType[]) : [])
          .filter((type, index, arr) => arr.indexOf(type) === index) // dedupe
          .map((type) => {
            const typeTasks = groupedTasks[type] || [];
            const config = TYPE_CONFIG[type] || {
              label: type,
              icon: null,
              color:
                "bg-slate-50 dark:bg-slate-900/40 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300",
            };
            const isCollapsed = collapsedSections.has(type);

            return (
              <div
                key={type}
                className={`rounded-xl border overflow-hidden ${config.color}`}
              >
                {/* Section Header */}
                <button
                  onClick={() => toggleSection(type)}
                  className="w-full flex items-center justify-between px-4 py-3 text-left"
                >
                  <div className="flex items-center space-x-2">
                    {isCollapsed ? (
                      <ChevronRight className="w-4 h-4 opacity-60" />
                    ) : (
                      <ChevronDown className="w-4 h-4 opacity-60" />
                    )}
                    {config.icon}
                    <span className="text-sm font-medium">
                      {config.label}
                    </span>
                  </div>
                  <span className="text-xs opacity-60 tabular-nums">
                    {typeTasks.length}
                  </span>
                </button>

                {/* Task Items */}
                {!isCollapsed && (
                  <div className="border-t border-inherit">
                    {typeTasks.length === 0 ? (
                      <div className="px-4 py-3 text-sm opacity-50 text-center">
                        No {config.label.toLowerCase()} tasks
                      </div>
                    ) : (
                      <div className="divide-y divide-inherit">
                        {typeTasks.map((task) => (
                          <TaskRow
                            key={task.id}
                            task={task}
                            currentType={type}
                            onMove={handleMoveTask}
                            onComplete={handleCompleteTask}
                            onDelete={handleDeleteTask}
                            disabled={disabled}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
      </div>
    </div>
  );
};

// --- Task Row component ---

const TaskRow: React.FC<{
  task: Task;
  currentType: string;
  onMove: (id: string, type: TaskType) => void;
  onComplete: (id: string) => void;
  onDelete: (id: string) => void;
  disabled: boolean;
}> = ({ task, currentType, onMove, onComplete, onDelete, disabled }) => {
  // Determine which move actions to show based on current type
  const moveOptions: { type: TaskType; label: string; icon: React.ReactNode }[] =
    [];

  if (currentType !== "week") {
    moveOptions.push({
      type: "week",
      label: "Week",
      icon: <ArrowRight className="w-3 h-3" />,
    });
  }
  if (currentType !== "day") {
    moveOptions.push({
      type: "day",
      label: "Day",
      icon: <ArrowRight className="w-3 h-3" />,
    });
  }
  if (currentType !== "future" && currentType !== "shopping") {
    moveOptions.push({
      type: "future",
      label: "Future",
      icon: <ArrowLeft className="w-3 h-3" />,
    });
  }

  return (
    <div className="flex items-center px-4 py-2.5 group">
      {/* Complete button */}
      <button
        onClick={() => onComplete(task.id)}
        disabled={disabled}
        className="w-5 h-5 rounded border-2 border-current opacity-30 hover:opacity-100 flex items-center justify-center mr-3 transition-opacity flex-shrink-0 disabled:cursor-not-allowed"
      >
        <Check className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
      </button>

      {/* Title */}
      <span className="text-sm flex-1 min-w-0 truncate">{task.title}</span>

      {/* Actions - visible on hover */}
      <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity ml-2 flex-shrink-0">
        {moveOptions.map((opt) => (
          <button
            key={opt.type}
            onClick={() => onMove(task.id, opt.type)}
            disabled={disabled}
            className="px-2 py-1 text-xs rounded-md bg-white/50 dark:bg-slate-800/50 hover:bg-white dark:hover:bg-slate-700 transition-colors disabled:cursor-not-allowed"
            title={`Move to ${opt.label}`}
          >
            {opt.label}
          </button>
        ))}
        <button
          onClick={() => onDelete(task.id)}
          disabled={disabled}
          className="p-1 rounded-md hover:bg-red-100 dark:hover:bg-red-900/30 text-red-500 dark:text-red-400 transition-colors disabled:cursor-not-allowed"
          title="Delete task"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};

export default WeeklyTaskPlanner;
