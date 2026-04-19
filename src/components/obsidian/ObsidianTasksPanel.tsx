import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Plus, FileText } from "lucide-react";
import { TaskType } from "../../types/Task";

export interface ObsidianTask {
  file: string;
  line: number;
  indent: number;
  raw_text: string;
  text_hash: string;
  display: string;
  tags: string[];
  due_date: string | null;
  scheduled_date: string | null;
  priority: string | null;
}

export interface ObsidianImportContext {
  vaultAbs: string;
  file: string;
  textHash: string;
}

const OBSIDIAN_SOURCE_KEY = "obsidianTaskSources";

export type ObsidianSourceMap = Record<string, ObsidianImportContext>;

export const readObsidianSourceMap = (): ObsidianSourceMap => {
  try {
    const raw = localStorage.getItem(OBSIDIAN_SOURCE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
};

export const writeObsidianSourceMap = (map: ObsidianSourceMap): void => {
  localStorage.setItem(OBSIDIAN_SOURCE_KEY, JSON.stringify(map));
};

export const rememberObsidianSource = (
  taskId: string,
  ctx: ObsidianImportContext,
): void => {
  const map = readObsidianSourceMap();
  map[taskId] = ctx;
  writeObsidianSourceMap(map);
};

interface Props {
  defaultType: TaskType; // "day" on morning, "week" in review
  onImport: (task: ObsidianTask, type: TaskType) => Promise<string | null>;
  allowedTypes?: TaskType[]; // which buckets to offer; defaults to ["day","week","future"]
  title?: string;
  initiallyExpanded?: boolean;
}

const PRIORITY_MARK: Record<string, string> = {
  highest: "🔺",
  high: "⏫",
  medium: "🔼",
  low: "🔽",
  lowest: "⏬",
};

const TYPE_LABEL: Record<string, string> = { day: "D", week: "W", future: "F" };

const ObsidianTasksPanel: React.FC<Props> = ({
  defaultType,
  onImport,
  allowedTypes = ["day", "week", "future"],
  title = "From Obsidian",
  initiallyExpanded = true,
}) => {
  const [tasks, setTasks] = useState<ObsidianTask[]>([]);
  const [importedHashes, setImportedHashes] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState(initiallyExpanded);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    const api = window.electron?.obsidian;
    if (!api?.readTasks) {
      setError("Obsidian integration unavailable");
      setLoading(false);
      return;
    }
    const res = await api.readTasks();
    if ("error" in res) {
      setError(res.error);
      setLoading(false);
      return;
    }
    setTasks(res.data.tasks);
    setError(null);
    setLoading(false);

    // Anything already in the source map is "imported" and should be hidden.
    const map = readObsidianSourceMap();
    const hashes = new Set(Object.values(map).map((v) => v.textHash));
    setImportedHashes(hashes);
  }, []);

  useEffect(() => {
    load();
    const onFocus = () => load();
    window.addEventListener("focus", onFocus);
    const id = setInterval(load, 5 * 60 * 1000);
    return () => {
      window.removeEventListener("focus", onFocus);
      clearInterval(id);
    };
  }, [load]);

  const visible = useMemo(
    () => tasks.filter((t) => !importedHashes.has(t.text_hash)),
    [tasks, importedHashes],
  );

  const handleImport = async (task: ObsidianTask, type: TaskType) => {
    if (pending.has(task.text_hash)) return;
    setPending((p) => new Set(p).add(task.text_hash));
    try {
      const newTaskId = await onImport(task, type);
      if (newTaskId) {
        setImportedHashes((prev) => new Set(prev).add(task.text_hash));
      }
    } finally {
      setPending((p) => {
        const n = new Set(p);
        n.delete(task.text_hash);
        return n;
      });
    }
  };

  if (loading) {
    return (
      <div className="text-xs text-gray-400 italic py-1">
        Loading Obsidian tasks…
      </div>
    );
  }
  if (error) {
    return (
      <div className="text-xs text-gray-400 italic py-1">{error}</div>
    );
  }

  return (
    <div className="flex flex-col min-h-0">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors mb-1.5 shrink-0"
      >
        {expanded ? (
          <ChevronDown className="w-3.5 h-3.5" />
        ) : (
          <ChevronRight className="w-3.5 h-3.5" />
        )}
        <FileText className="w-3.5 h-3.5" />
        <span>{title}</span>
        <span className="text-xs text-gray-400 dark:text-gray-500 font-normal">
          {visible.length}
        </span>
      </button>

      {expanded && (
        <div className="space-y-0.5 overflow-y-auto flex-1 min-h-0 pl-1">
          {visible.length === 0 ? (
            <p className="text-xs text-gray-400 dark:text-gray-500 italic py-1 pl-1">
              All caught up
            </p>
          ) : (
            visible.map((t) => {
              const isPending = pending.has(t.text_hash);
              const otherTypes = allowedTypes.filter((x) => x !== defaultType);
              return (
                <div
                  key={t.text_hash}
                  className="group flex items-center gap-2 py-1 px-1 -mx-1 rounded-sm hover:bg-gray-50 dark:hover:bg-gray-700/30"
                  title={`${t.file}:${t.line + 1}`}
                >
                  {t.priority && PRIORITY_MARK[t.priority] && (
                    <span className="text-[10px] shrink-0">
                      {PRIORITY_MARK[t.priority]}
                    </span>
                  )}
                  <span className="text-sm text-gray-700 dark:text-gray-300 flex-1 min-w-0 overflow-hidden whitespace-nowrap">
                    {t.display}
                  </span>
                  {t.due_date && (
                    <span className="text-[10px] text-amber-600 dark:text-amber-400 shrink-0">
                      {t.due_date.slice(5)}
                    </span>
                  )}
                  <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => handleImport(t, defaultType)}
                      disabled={isPending}
                      className="p-0.5 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 disabled:opacity-30"
                      title={`Add to ${defaultType}`}
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                    {otherTypes.map((t2) => (
                      <button
                        key={t2}
                        onClick={() => handleImport(t, t2)}
                        disabled={isPending}
                        className="w-5 h-5 flex items-center justify-center rounded text-[10px] font-bold text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors disabled:opacity-30"
                        title={`Add to ${t2}`}
                      >
                        {TYPE_LABEL[t2]}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};

export default ObsidianTasksPanel;
