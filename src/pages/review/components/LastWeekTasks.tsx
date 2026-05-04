import React, { useState, useEffect } from "react";
import { Loader, Check } from "lucide-react";
import { api } from "../../../utils/api";
import { Task } from "../../../types/Task";

interface LastWeekTasksProps {
  // The Monday of the week being reviewed (YYYY-MM-DD).
  // We show tasks from the *prior* 7 days so the reviewer can see what
  // they completed (and what slipped) heading into this review.
  weekStart: string;
}

const TYPE_LABELS: Record<string, string> = {
  day: "Daily",
  week: "Weekly",
  future: "Future",
  blocked: "Blocked",
  shopping: "Shopping",
};

const LastWeekTasks: React.FC<LastWeekTasksProps> = ({ weekStart }) => {
  const [completed, setCompleted] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setIsLoading(true);
      try {
        const start = new Date(weekStart + "T00:00:00");
        const priorMonday = new Date(start);
        priorMonday.setDate(start.getDate() - 7);
        const priorSunday = new Date(start);
        priorSunday.setDate(start.getDate() - 1);
        const startISO = priorMonday.toISOString();
        const endISO = new Date(
          priorSunday.toISOString().split("T")[0] + "T23:59:59"
        ).toISOString();
        const tasks = await api.getCompletedTasksByDateRange(startISO, endISO);
        if (!cancelled) setCompleted(tasks);
      } catch (e) {
        console.error("Failed to load last week's tasks:", e);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [weekStart]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-3">
        <Loader className="w-4 h-4 animate-spin text-slate-400" />
      </div>
    );
  }

  if (completed.length === 0) {
    return (
      <p className="text-xs text-slate-400 dark:text-slate-500 italic px-2 py-1">
        Nothing completed last week
      </p>
    );
  }

  return (
    <div className="rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 max-h-64 overflow-y-auto">
      <div className="divide-y divide-slate-100 dark:divide-slate-700/60">
        {completed.map((task) => (
          <div key={task.id} className="flex items-center gap-2.5 px-3 py-1.5">
            <Check className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 flex-shrink-0" />
            <span className="text-sm text-slate-600 dark:text-slate-300 flex-1 min-w-0 truncate">
              {task.title}
            </span>
            <span className="text-[10px] uppercase tracking-wider text-slate-400 dark:text-slate-500 flex-shrink-0">
              {TYPE_LABELS[task.type] || task.type}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default LastWeekTasks;
