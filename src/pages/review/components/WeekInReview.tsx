import React, { useState, useEffect } from "react";
import {
  Loader,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { api } from "../../../utils/api";
import { Task } from "../../../types/Task";
import { Session } from "../../../types/Session";
import { useAuth } from "../../../context/AuthContext";
import { AVAILABLE_SIGNALS, getAllSignals, SignalConfig } from "../../settings/components/SignalSettings";

interface WeekInReviewProps {
  weekStart: string; // YYYY-MM-DD
  weekEnd: string;   // YYYY-MM-DD
}

interface DaySignals {
  date: string;
  signals: Record<string, number | boolean>;
  completionRate: number;
}

const WeekInReview: React.FC<WeekInReviewProps> = ({ weekStart, weekEnd }) => {
  const { user } = useAuth();

  const [completedTasks, setCompletedTasks] = useState<Task[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [signalData, setSignalData] = useState<DaySignals[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAllTasks, setShowAllTasks] = useState(false);
  const [showSessions, setShowSessions] = useState(false);

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      try {
        const startISO = new Date(weekStart + "T00:00:00").toISOString();
        const endISO = new Date(weekEnd + "T23:59:59").toISOString();

        const [tasks, sessionsData, signalsRaw] = await Promise.all([
          api.getCompletedTasksByDateRange(startISO, endISO),
          api.getSessionsByDateRange(startISO, endISO),
          api.getSignalRange(weekStart, weekEnd),
        ]);

        setCompletedTasks(tasks);
        setSessions(sessionsData);

        // Process signals into daily breakdown
        const activeSignals: string[] =
          user?.preferences?.activeSignals || [];
        const signalGoals: Record<string, number> =
          user?.preferences?.signalGoals || {};
        const allSignals = getAllSignals(
          user?.preferences?.customSignals as Record<string, SignalConfig> | undefined
        );

        if (Array.isArray(signalsRaw)) {
          const byDate = new Map<string, Record<string, number | boolean>>();
          (signalsRaw as any[]).forEach((item) => {
            if (!byDate.has(item.date)) {
              byDate.set(item.date, {});
            }
            byDate.get(item.date)![item.metric] = item.value;
          });

          const dailySignals: DaySignals[] = [];
          const current = new Date(weekStart + "T00:00:00");
          const end = new Date(weekEnd + "T00:00:00");
          while (current <= end) {
            const dateStr = current.toISOString().split("T")[0];
            const daySignals = byDate.get(dateStr) || {};
            const completed = activeSignals.filter((key) => {
              const val = daySignals[key];
              if (val === undefined) return false;
              const config = allSignals[key];
              if (!config) return false;
              if (config.type === "binary") return val === true;
              if (config.type === "scale") return typeof val === "number" && val >= 4;
              if (config.hasGoal && signalGoals[key]) {
                return typeof val === "number" && val >= signalGoals[key];
              }
              return typeof val === "number" && val > 0;
            });
            const rate =
              activeSignals.length > 0
                ? Math.round((completed.length / activeSignals.length) * 100)
                : 0;

            dailySignals.push({
              date: dateStr,
              signals: daySignals,
              completionRate: rate,
            });
            current.setDate(current.getDate() + 1);
          }
          setSignalData(dailySignals);
        }
      } catch (error) {
        console.error("Failed to load week in review data:", error);
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [weekStart, weekEnd, user]);

  // --- Calculations ---
  const totalSessionMinutes = sessions.reduce(
    (sum, s) => sum + (s.minutes || 0),
    0
  );
  const totalSessionHours = totalSessionMinutes / 60;
  const avgFocus =
    sessions.length > 0
      ? sessions.reduce((sum, s) => sum + (s.focus || 0), 0) / sessions.length
      : 0;
  const avgSignalCompletion =
    signalData.length > 0
      ? Math.round(
          signalData.reduce((sum, d) => sum + d.completionRate, 0) /
            signalData.length
        )
      : 0;

  const typeLabels: Record<string, string> = {
    day: "Daily",
    week: "Weekly",
    future: "Future",
    blocked: "Blocked",
    shopping: "Shopping",
  };

  const visibleTasks = showAllTasks
    ? completedTasks
    : completedTasks.slice(0, 5);

  if (isLoading) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-8 flex items-center justify-center">
        <Loader className="w-5 h-5 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Summary row */}
      <div className="flex items-center gap-6 text-sm text-slate-600 dark:text-slate-300">
        <span>
          <span className="font-medium tabular-nums">{completedTasks.length}</span>
          <span className="text-slate-400 dark:text-slate-500 ml-1">tasks</span>
        </span>
        <span>
          <span className="font-medium tabular-nums">{totalSessionHours.toFixed(1).replace(/\.0$/, "")}h</span>
          <span className="text-slate-400 dark:text-slate-500 ml-1">focus</span>
        </span>
        <span>
          <span className="font-medium tabular-nums">{avgFocus.toFixed(1)}</span>
          <span className="text-slate-400 dark:text-slate-500 ml-1">/5 avg</span>
        </span>
        <span>
          <span className="font-medium tabular-nums">{avgSignalCompletion}%</span>
          <span className="text-slate-400 dark:text-slate-500 ml-1">signals</span>
        </span>
      </div>

      {/* Daily signals */}
      {signalData.length > 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-4">
          <div className="space-y-1.5">
            {signalData.map((day) => (
              <div key={day.date} className="flex items-center gap-3">
                <span className="text-xs text-slate-400 dark:text-slate-500 w-14 flex-shrink-0 tabular-nums">
                  {formatDayLabel(day.date)}
                </span>
                <div className="flex-1 h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full bg-slate-400 dark:bg-slate-500 transition-all"
                    style={{ width: `${day.completionRate}%` }}
                  />
                </div>
                <span className="text-xs text-slate-400 dark:text-slate-500 w-7 text-right tabular-nums">
                  {day.completionRate}%
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Sessions - expandable */}
      {sessions.length > 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
          <button
            onClick={() => setShowSessions(!showSessions)}
            className="w-full flex items-center justify-between px-4 py-2.5 text-left"
          >
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Sessions ({sessions.length})
            </span>
            {showSessions ? (
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
            )}
          </button>
          {showSessions && (
            <div className="border-t border-slate-100 dark:border-slate-700 px-4 py-2 space-y-1 max-h-48 overflow-y-auto">
              {sessions.map((session) => (
                <div
                  key={session.id}
                  className="flex items-center justify-between py-1"
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <span className="text-xs text-slate-400 dark:text-slate-500 flex-shrink-0 tabular-nums">
                      {formatDate(session.created_at)}
                    </span>
                    <span className="text-xs text-slate-600 dark:text-slate-300 truncate">
                      {session.task || session.project || "Untitled"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                    <span className="text-xs text-slate-400 dark:text-slate-500 tabular-nums">
                      {session.minutes}m
                    </span>
                    <span className="text-xs text-slate-400 dark:text-slate-500 tabular-nums w-4 text-right">
                      {session.focus}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Completed Tasks - expandable */}
      {completedTasks.length > 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
          <button
            onClick={() => setShowAllTasks(!showAllTasks)}
            className="w-full flex items-center justify-between px-4 py-2.5 text-left"
          >
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Tasks Completed ({completedTasks.length})
            </span>
            {showAllTasks ? (
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
            )}
          </button>
          {showAllTasks && (
            <div className="border-t border-slate-100 dark:border-slate-700 px-4 py-2 space-y-1 max-h-64 overflow-y-auto">
              {completedTasks.map((task) => (
                <div
                  key={task.id}
                  className="flex items-center gap-2 py-1"
                >
                  <span className="text-xs text-slate-600 dark:text-slate-300 flex-1">
                    {task.title}
                  </span>
                  <span className="text-[10px] text-slate-400 dark:text-slate-500">
                    {typeLabels[task.type] || task.type}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatDayLabel(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { weekday: "short", day: "numeric" });
}

export default WeekInReview;
