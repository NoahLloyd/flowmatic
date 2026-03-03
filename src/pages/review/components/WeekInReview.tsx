import React, { useState, useEffect } from "react";
import {
  CheckCircle2,
  Clock,
  Brain,
  Activity,
  BarChart3,
  Loader,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { api } from "../../../utils/api";
import { Task } from "../../../types/Task";
import { Session } from "../../../types/Session";
import { useAuth } from "../../../context/AuthContext";
import { AVAILABLE_SIGNALS } from "../../settings/components/SignalSettings";

type SignalKey = keyof typeof AVAILABLE_SIGNALS;

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

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      try {
        // Convert dates to ISO for date range queries
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

        if (Array.isArray(signalsRaw)) {
          const byDate = new Map<string, Record<string, number | boolean>>();
          (signalsRaw as any[]).forEach((item) => {
            if (!byDate.has(item.date)) {
              byDate.set(item.date, {});
            }
            byDate.get(item.date)![item.metric] = item.value;
          });

          const dailySignals: DaySignals[] = [];
          // Iterate through each day of the week
          const current = new Date(weekStart + "T00:00:00");
          const end = new Date(weekEnd + "T00:00:00");
          while (current <= end) {
            const dateStr = current.toISOString().split("T")[0];
            const daySignals = byDate.get(dateStr) || {};
            const completed = activeSignals.filter((key) => {
              const val = daySignals[key];
              if (val === undefined) return false;
              const config = AVAILABLE_SIGNALS[key as SignalKey];
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

  // Group tasks by type
  const tasksByType = completedTasks.reduce(
    (acc, task) => {
      const type = task.type || "day";
      if (!acc[type]) acc[type] = [];
      acc[type].push(task);
      return acc;
    },
    {} as Record<string, Task[]>
  );

  const typeLabels: Record<string, string> = {
    day: "Daily",
    week: "Weekly",
    future: "Future",
    blocked: "Blocked",
    shopping: "Shopping",
  };

  const visibleTasks = showAllTasks
    ? completedTasks
    : completedTasks.slice(0, 8);

  if (isLoading) {
    return (
      <div className="mb-8">
        <div className="flex items-center space-x-2 mb-3">
          <BarChart3 className="w-5 h-5 text-slate-600 dark:text-slate-400" />
          <h2 className="text-lg font-medium text-slate-800 dark:text-slate-100">
            Week in Review
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
        <BarChart3 className="w-5 h-5 text-slate-600 dark:text-slate-400" />
        <h2 className="text-lg font-medium text-slate-800 dark:text-slate-100">
          Week in Review
        </h2>
      </div>

      {/* Summary Stats Row */}
      <div className="grid grid-cols-4 gap-3 mb-4">
        <StatCard
          icon={<CheckCircle2 className="w-4 h-4" />}
          label="Tasks Done"
          value={String(completedTasks.length)}
          color="emerald"
        />
        <StatCard
          icon={<Clock className="w-4 h-4" />}
          label="Focus Hours"
          value={totalSessionHours.toFixed(1).replace(/\.0$/, "")}
          color="blue"
        />
        <StatCard
          icon={<Brain className="w-4 h-4" />}
          label="Avg Focus"
          value={avgFocus.toFixed(1)}
          suffix="/5"
          color="purple"
        />
        <StatCard
          icon={<Activity className="w-4 h-4" />}
          label="Avg Signals"
          value={`${avgSignalCompletion}%`}
          color="amber"
        />
      </div>

      {/* Sessions & Signals Detail */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        {/* Sessions Breakdown */}
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
          <h3 className="text-sm font-medium text-slate-600 dark:text-slate-300 mb-3">
            Sessions ({sessions.length})
          </h3>
          {sessions.length === 0 ? (
            <p className="text-sm text-slate-400 dark:text-slate-500 text-center py-4">
              No sessions this week
            </p>
          ) : (
            <div className="space-y-1.5 max-h-48 overflow-y-auto">
              {sessions.map((session) => (
                <div
                  key={session.id}
                  className="flex items-center justify-between py-1.5 px-2 rounded-md bg-slate-50 dark:bg-slate-900/40"
                >
                  <div className="flex items-center space-x-2 min-w-0 flex-1">
                    <span className="text-xs text-slate-500 dark:text-slate-400 flex-shrink-0 tabular-nums">
                      {formatDate(session.created_at)}
                    </span>
                    <span className="text-sm text-slate-700 dark:text-slate-200 truncate">
                      {session.task || session.project || "Untitled"}
                    </span>
                  </div>
                  <div className="flex items-center space-x-2 flex-shrink-0 ml-2">
                    <span className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                      {session.minutes}m
                    </span>
                    <FocusBadge focus={session.focus} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Signals Breakdown */}
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
          <h3 className="text-sm font-medium text-slate-600 dark:text-slate-300 mb-3">
            Daily Signal Completion
          </h3>
          {signalData.length === 0 ? (
            <p className="text-sm text-slate-400 dark:text-slate-500 text-center py-4">
              No signal data this week
            </p>
          ) : (
            <div className="space-y-2">
              {signalData.map((day) => (
                <div key={day.date} className="flex items-center space-x-3">
                  <span className="text-xs text-slate-500 dark:text-slate-400 w-16 flex-shrink-0 tabular-nums">
                    {formatDayLabel(day.date)}
                  </span>
                  <div className="flex-1 h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${getCompletionColor(day.completionRate)}`}
                      style={{ width: `${day.completionRate}%` }}
                    />
                  </div>
                  <span className="text-xs font-medium text-slate-600 dark:text-slate-300 w-8 text-right tabular-nums">
                    {day.completionRate}%
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Completed Tasks */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium text-slate-600 dark:text-slate-300">
            Tasks Completed ({completedTasks.length})
          </h3>
          {/* Type breakdown chips */}
          <div className="flex items-center space-x-1.5">
            {Object.entries(tasksByType).map(([type, tasks]) => (
              <span
                key={type}
                className="text-xs px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300"
              >
                {typeLabels[type] || type}: {tasks.length}
              </span>
            ))}
          </div>
        </div>

        {completedTasks.length === 0 ? (
          <p className="text-sm text-slate-400 dark:text-slate-500 text-center py-4">
            No tasks completed this week
          </p>
        ) : (
          <>
            <div className="space-y-1">
              {visibleTasks.map((task) => (
                <div
                  key={task.id}
                  className="flex items-center space-x-2 py-1.5 px-2 rounded-md"
                >
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400 flex-shrink-0" />
                  <span className="text-sm text-slate-600 dark:text-slate-300 flex-1">
                    {task.title}
                  </span>
                  <span className="text-xs text-slate-400 dark:text-slate-500 px-1.5 py-0.5 rounded bg-slate-50 dark:bg-slate-900/40">
                    {typeLabels[task.type] || task.type}
                  </span>
                </div>
              ))}
            </div>
            {completedTasks.length > 8 && (
              <button
                onClick={() => setShowAllTasks(!showAllTasks)}
                className="mt-2 w-full flex items-center justify-center space-x-1 py-1.5 text-xs text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
              >
                {showAllTasks ? (
                  <>
                    <ChevronDown className="w-3.5 h-3.5" />
                    <span>Show less</span>
                  </>
                ) : (
                  <>
                    <ChevronRight className="w-3.5 h-3.5" />
                    <span>Show all {completedTasks.length} tasks</span>
                  </>
                )}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
};

// --- Helper components ---

const StatCard: React.FC<{
  icon: React.ReactNode;
  label: string;
  value: string;
  suffix?: string;
  color: string;
}> = ({ icon, label, value, suffix, color }) => {
  const colorClasses: Record<string, string> = {
    emerald:
      "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800",
    blue: "bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800",
    purple:
      "bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 border-purple-200 dark:border-purple-800",
    amber:
      "bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800",
  };

  return (
    <div
      className={`rounded-xl border p-3 ${colorClasses[color] || colorClasses.blue}`}
    >
      <div className="flex items-center space-x-1.5 mb-1 opacity-70">
        {icon}
        <span className="text-xs font-medium">{label}</span>
      </div>
      <div className="text-xl font-bold tabular-nums">
        {value}
        {suffix && <span className="text-sm font-normal opacity-60">{suffix}</span>}
      </div>
    </div>
  );
};

const FocusBadge: React.FC<{ focus: number }> = ({ focus }) => {
  let color = "text-slate-500 bg-slate-100 dark:text-slate-400 dark:bg-slate-700";
  if (focus >= 4.5) color = "text-indigo-600 bg-indigo-100 dark:text-indigo-300 dark:bg-indigo-900/40";
  else if (focus >= 4) color = "text-green-600 bg-green-100 dark:text-green-300 dark:bg-green-900/40";
  else if (focus >= 3) color = "text-yellow-600 bg-yellow-100 dark:text-yellow-300 dark:bg-yellow-900/40";
  else if (focus >= 2) color = "text-orange-600 bg-orange-100 dark:text-orange-300 dark:bg-orange-900/40";

  return (
    <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${color} tabular-nums`}>
      {focus}
    </span>
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

function getCompletionColor(rate: number): string {
  if (rate >= 80) return "bg-emerald-500 dark:bg-emerald-400";
  if (rate >= 60) return "bg-blue-500 dark:bg-blue-400";
  if (rate >= 40) return "bg-amber-500 dark:bg-amber-400";
  if (rate >= 20) return "bg-orange-500 dark:bg-orange-400";
  return "bg-slate-300 dark:bg-slate-600";
}

export default WeekInReview;
