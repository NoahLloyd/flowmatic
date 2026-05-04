import React, { useState, useEffect, useCallback, useRef } from "react";
import { Plus, Trash2, Check, Loader } from "lucide-react";
import { api } from "../../../utils/api";
import { Task, TaskType } from "../../../types/Task";
import { useToast } from "../../../context/ToastContext";
import {
  dispatchTaskAdded,
  subscribeToTaskAdded,
} from "../../../utils/taskEvents";
import ObsidianTasksPanel, {
  ObsidianTask,
  rememberObsidianSource,
} from "../../../components/obsidian/ObsidianTasksPanel";

interface InlineTaskListProps {
  type: TaskType;
  emptyText?: string;
  addPlaceholder?: string;
  disabled?: boolean;
}

// Buckets the user can move a task between from this row. Mirrors the
// morning view so the affordance is consistent.
const MOVE_TYPES: TaskType[] = ["day", "week", "future"];
const TYPE_LABELS: Record<string, string> = {
  day: "D",
  week: "W",
  future: "F",
};
const TYPE_TITLES: Record<string, string> = {
  day: "Move to Daily",
  week: "Move to Weekly",
  future: "Move to Future",
};

/**
 * Compact inline list of active tasks of a single type, with quick-add,
 * type-change, and Obsidian import. Used inside the Review checklist so
 * the relevant task list lives next to the to-do that prompts the user
 * to review/edit it.
 */
const InlineTaskList: React.FC<InlineTaskListProps> = ({
  type,
  emptyText = "No tasks",
  addPlaceholder = "Add task...",
  disabled = false,
}) => {
  const { showToast } = useToast();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [newTitle, setNewTitle] = useState("");
  const [isAdding, setIsAdding] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const all = await api.getTasksByType(type);
      setTasks(all.filter((t) => !t.completed));
    } catch (e) {
      console.error(`Failed to load ${type} tasks:`, e);
    } finally {
      setIsLoading(false);
    }
  }, [type]);

  useEffect(() => {
    load();
  }, [load]);

  // Keep in sync with task additions from elsewhere (e.g. quick-add shortcut)
  useEffect(() => {
    return subscribeToTaskAdded((task) => {
      if (task.type !== type || task.completed) return;
      setTasks((prev) =>
        prev.some((t) => t.id === task.id) ? prev : [task, ...prev]
      );
    });
  }, [type]);

  const handleAdd = async () => {
    if (!newTitle.trim() || disabled) return;
    setIsAdding(true);
    try {
      const task = await api.createTask({
        title: newTitle.trim(),
        type,
        completed: false,
        completedAt: null,
        createdAt: new Date(),
      });
      setTasks((prev) => [task, ...prev]);
      setNewTitle("");
      dispatchTaskAdded(task);
    } catch (e) {
      console.error("Failed to add task:", e);
      showToast("Failed to add task", "error");
    } finally {
      setIsAdding(false);
    }
  };

  const handleComplete = async (id: string) => {
    if (disabled) return;
    setTasks((prev) => prev.filter((t) => t.id !== id));
    try {
      await api.updateTask(id, { completed: true, completedAt: new Date() });
    } catch (e) {
      load();
      showToast("Failed to complete task", "error");
    }
  };

  const handleDelete = async (id: string) => {
    if (disabled) return;
    setTasks((prev) => prev.filter((t) => t.id !== id));
    try {
      await api.deleteTask(id);
    } catch (e) {
      load();
      showToast("Failed to delete task", "error");
    }
  };

  const handleChangeType = async (id: string, newType: TaskType) => {
    if (disabled || newType === type) return;
    // Optimistic remove from this list (it'll show up in the matching list).
    setTasks((prev) => prev.filter((t) => t.id !== id));
    try {
      await api.updateTask(id, { type: newType });
    } catch (e) {
      load();
      showToast("Failed to move task", "error");
    }
  };

  // Cache vault path so Obsidian-imported tasks remember their source
  // for write-back on completion.
  const vaultAbsRef = useRef<string | null>(null);
  const handleObsidianImport = async (
    obsidianTask: ObsidianTask,
    importType: TaskType
  ): Promise<string | null> => {
    try {
      if (!vaultAbsRef.current) {
        const res = await window.electron?.obsidian?.readTasks();
        if (res?.ok) vaultAbsRef.current = res.data.vault_abs;
      }
      const created = await api.createTask({
        title: obsidianTask.display,
        type: importType,
        completed: false,
        completedAt: null,
        createdAt: new Date(),
      });
      rememberObsidianSource(created.id, {
        vaultAbs: vaultAbsRef.current || "",
        file: obsidianTask.file,
        textHash: obsidianTask.text_hash,
      });
      // Only show in this list if it matches our type filter.
      if (importType === type) {
        setTasks((prev) => [created, ...prev]);
      }
      dispatchTaskAdded(created);
      showToast("Imported from Obsidian", "success");
      return created.id;
    } catch (e) {
      console.error("Obsidian import failed:", e);
      showToast("Import failed", "error");
      return null;
    }
  };

  return (
    <div className="space-y-3">
      <ObsidianTasksPanel
        defaultType={type}
        onImport={handleObsidianImport}
        initiallyExpanded={false}
        headerVariant="section"
        title="From Obsidian"
      />

      <div className="flex items-center gap-2">
        <input
          type="text"
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleAdd();
            if (e.key === "Escape") (e.target as HTMLInputElement).blur();
          }}
          placeholder={addPlaceholder}
          disabled={disabled || isAdding}
          className="flex-1 px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md text-sm text-slate-700 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-400"
        />
        <button
          onClick={handleAdd}
          disabled={disabled || isAdding || !newTitle.trim()}
          className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors disabled:opacity-30"
          aria-label="Add task"
        >
          {isAdding ? (
            <Loader className="w-4 h-4 animate-spin" />
          ) : (
            <Plus className="w-4 h-4" />
          )}
        </button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-3">
          <Loader className="w-4 h-4 animate-spin text-slate-400" />
        </div>
      ) : tasks.length === 0 ? (
        <p className="text-xs text-slate-400 dark:text-slate-500 italic px-2 py-1">
          {emptyText}
        </p>
      ) : (
        <div className="divide-y divide-slate-100 dark:divide-slate-700/60 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
          {tasks.map((task) => {
            const otherTypes = MOVE_TYPES.filter((t) => t !== type);
            return (
              <div
                key={task.id}
                className="flex items-center px-3 py-1.5 group"
              >
                <button
                  onClick={() => handleComplete(task.id)}
                  disabled={disabled}
                  className="w-4 h-4 rounded border border-slate-300 dark:border-slate-600 flex items-center justify-center mr-2.5 flex-shrink-0 text-slate-300 dark:text-slate-600 hover:border-slate-500 dark:hover:border-slate-400 hover:text-slate-500 dark:hover:text-slate-400 transition-colors disabled:cursor-not-allowed"
                  aria-label="Complete task"
                >
                  <Check className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>
                <span className="text-sm text-slate-700 dark:text-slate-200 flex-1 min-w-0 truncate">
                  {task.title}
                </span>
                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity ml-2 flex-shrink-0">
                  {otherTypes.map((t) => (
                    <button
                      key={t}
                      onClick={() => handleChangeType(task.id, t)}
                      disabled={disabled}
                      title={TYPE_TITLES[t]}
                      className="w-5 h-5 flex items-center justify-center rounded text-[10px] font-semibold text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-600 border border-transparent hover:border-slate-200 dark:hover:border-slate-500 transition-colors disabled:cursor-not-allowed"
                    >
                      {TYPE_LABELS[t]}
                    </button>
                  ))}
                  <button
                    onClick={() => handleDelete(task.id)}
                    disabled={disabled}
                    className="p-0.5 ml-0.5 text-slate-300 dark:text-slate-600 hover:text-red-400 dark:hover:text-red-400 transition-colors"
                    title="Delete"
                    aria-label="Delete task"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default InlineTaskList;
