import React, { useState, useEffect, useCallback, useRef } from "react";
import { Task, TaskType } from "../../types/Task";
import { api } from "../../utils/api";
import { ChevronDown, ChevronRight, Sun, Sparkles } from "lucide-react";
import { dispatchTaskAdded, subscribeToTaskAdded } from "../../utils/taskEvents";
import ObsidianTasksPanel, {
  ObsidianTask,
  rememberObsidianSource,
} from "../../components/obsidian/ObsidianTasksPanel";
import {
  DragDropContext,
  Droppable,
  Draggable,
  DropResult,
} from "@hello-pangea/dnd";
import LinkifiedTaskText from "../../components/task/LinkifiedTaskText";

// Only D, W, F are relevant for the morning view
const MORNING_TYPES: TaskType[] = ["day", "week", "future"];

const TYPE_LABELS: Record<string, string> = {
  day: "D",
  week: "W",
  future: "F",
};

const TYPE_TITLES: Record<string, string> = {
  day: "Move to Today",
  week: "Move to Weekly",
  future: "Move to Future",
};

const formatTodayLabel = () => {
  return new Date().toLocaleDateString(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
};

const MorningTasks: React.FC = () => {
  const [dayTasks, setDayTasks] = useState<Task[]>([]);
  const [weekTasks, setWeekTasks] = useState<Task[]>([]);
  const [futureTasks, setFutureTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Collapsible states
  const [showWeekly, setShowWeekly] = useState(true);
  const [showFuture, setShowFuture] = useState(false);
  const [showObsidian, setShowObsidian] = useState(false);

  const vaultAbsRef = useRef<string | null>(null);
  const handleObsidianImport = useCallback(
    async (obsidianTask: ObsidianTask, type: TaskType): Promise<string | null> => {
      try {
        // Pull the vault path from the latest sync so we can write back later.
        if (!vaultAbsRef.current) {
          const res = await window.electron?.obsidian?.readTasks();
          if (res?.ok) vaultAbsRef.current = res.data.vault_abs;
        }
        const created = await api.createTask({
          title: obsidianTask.display,
          type,
          completed: false,
          completedAt: null,
          createdAt: new Date(),
        });
        rememberObsidianSource(created.id, {
          vaultAbs: vaultAbsRef.current || "",
          file: obsidianTask.file,
          textHash: obsidianTask.text_hash,
        });
        const setter =
          type === "day"
            ? setDayTasks
            : type === "week"
            ? setWeekTasks
            : type === "future"
            ? setFutureTasks
            : null;
        setter?.((prev) => [created, ...prev]);
        dispatchTaskAdded(created);
        return created.id;
      } catch (e) {
        console.error("Failed to import Obsidian task:", e);
        return null;
      }
    },
    [],
  );

  // Keyboard focus state: which task is highlighted
  const [focusedTaskId, setFocusedTaskId] = useState<string | null>(null);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editedTitle, setEditedTitle] = useState("");
  const editCancelledRef = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const setterMap: Record<string, React.Dispatch<React.SetStateAction<Task[]>>> = {
    day: setDayTasks,
    week: setWeekTasks,
    future: setFutureTasks,
  };

  const getTaskOrderFromStorage = (type: TaskType): string[] | null => {
    const storedOrder = localStorage.getItem(`taskOrder_${type}`);
    return storedOrder ? JSON.parse(storedOrder) : null;
  };

  const saveTaskOrderToStorage = (type: TaskType, order: string[]): void => {
    localStorage.setItem(`taskOrder_${type}`, JSON.stringify(order));
  };

  const applyOrder = (tasks: Task[], type: TaskType): Task[] => {
    const order = getTaskOrderFromStorage(type);
    if (!order) return tasks;
    return [...tasks].sort((a, b) => {
      const indexA = order.indexOf(a.id);
      const indexB = order.indexOf(b.id);
      if (indexA === -1 && indexB === -1) return 0;
      if (indexA === -1) return 1;
      if (indexB === -1) return -1;
      return indexA - indexB;
    });
  };

  const fetchTasks = useCallback(async () => {
    try {
      setIsLoading(true);
      const [day, week, future] = await Promise.all([
        api.getTasksByType("day"),
        api.getTasksByType("week"),
        api.getTasksByType("future"),
      ]);
      setDayTasks(applyOrder(day.filter((t) => !t.completed), "day"));
      setWeekTasks(applyOrder(week.filter((t) => !t.completed), "week"));
      setFutureTasks(applyOrder(future.filter((t) => !t.completed), "future"));
    } catch (error) {
      console.error("Failed to fetch tasks for morning view:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  useEffect(() => {
    const unsubscribe = subscribeToTaskAdded((newTask) => {
      if (newTask.completed) return;
      const setter = setterMap[newTask.type];
      if (setter) {
        setter((prev) =>
          prev.some((t) => t.id === newTask.id) ? prev : [newTask, ...prev]
        );
      }
    });
    return unsubscribe;
  }, []);

  // Build a flat ordered list of all visible tasks for keyboard nav
  const buildFlatList = useCallback((): { task: Task; type: TaskType }[] => {
    const list: { task: Task; type: TaskType }[] = [];
    // Daily tasks always visible
    dayTasks.forEach((t) => list.push({ task: t, type: "day" }));
    // Weekly tasks if expanded
    if (showWeekly) {
      weekTasks.forEach((t) => list.push({ task: t, type: "week" }));
    }
    // Future tasks if expanded
    if (showFuture) {
      futureTasks.forEach((t) => list.push({ task: t, type: "future" }));
    }
    return list;
  }, [dayTasks, weekTasks, futureTasks, showWeekly, showFuture]);

  const handleToggleComplete = async (id: string, fromType: TaskType) => {
    const setter = setterMap[fromType];
    if (!setter) return;
    setter((prev) => prev.filter((t) => t.id !== id));
    // Move focus to next task if current is focused
    if (focusedTaskId === id) {
      const flat = buildFlatList();
      const idx = flat.findIndex((f) => f.task.id === id);
      if (idx >= 0 && idx < flat.length - 1) {
        setFocusedTaskId(flat[idx + 1].task.id);
      } else if (idx > 0) {
        setFocusedTaskId(flat[idx - 1].task.id);
      } else {
        setFocusedTaskId(null);
      }
    }
    try {
      await api.updateTask(id, { completed: true, completedAt: new Date() });
    } catch {
      fetchTasks();
    }
  };

  const startEditing = useCallback((task: Task) => {
    editCancelledRef.current = false;
    setFocusedTaskId(task.id);
    setEditedTitle(task.title);
    setEditingTaskId(task.id);
  }, []);

  const cancelEditing = () => {
    editCancelledRef.current = true;
    setEditingTaskId(null);
  };

  const handleUpdateTitle = async (
    task: Task,
    type: TaskType,
    title: string
  ) => {
    if (editCancelledRef.current) {
      editCancelledRef.current = false;
      return;
    }

    const trimmed = title.trim();
    setEditingTaskId(null);
    if (!trimmed || trimmed === task.title) return;

    const setter = setterMap[type];
    setter?.((prev) =>
      prev.map((item) =>
        item.id === task.id ? { ...item, title: trimmed } : item
      )
    );

    try {
      await api.updateTask(task.id, { title: trimmed });
    } catch (error) {
      console.error("Failed to rename morning task:", error);
      setter?.((prev) =>
        prev.map((item) =>
          item.id === task.id ? { ...item, title: task.title } : item
        )
      );
    }
  };

  const handleChangeType = async (task: Task, fromType: TaskType, toType: TaskType) => {
    const fromSetter = setterMap[fromType];
    const toSetter = setterMap[toType];
    if (!fromSetter || !toSetter) return;

    const movedTask = { ...task, type: toType };
    fromSetter((prev) => prev.filter((t) => t.id !== task.id));
    toSetter((prev) => [movedTask, ...prev]);

    // Update stored orders
    const fromOrder = getTaskOrderFromStorage(fromType) || [];
    saveTaskOrderToStorage(fromType, fromOrder.filter((id) => id !== task.id));
    const toOrder = getTaskOrderFromStorage(toType) || [];
    saveTaskOrderToStorage(toType, [task.id, ...toOrder]);

    try {
      await api.updateTask(task.id, { type: toType });
    } catch {
      fetchTasks();
    }
  };

  // Drag and drop handler - supports cross-list dragging
  const handleDragEnd = (result: DropResult) => {
    const { source, destination } = result;
    if (!destination) return;

    const sourceType = source.droppableId as TaskType;
    const destType = destination.droppableId as TaskType;

    const getList = (type: TaskType): Task[] => {
      if (type === "day") return dayTasks;
      if (type === "week") return weekTasks;
      return futureTasks;
    };

    if (sourceType === destType) {
      // Reorder within same list
      const items = Array.from(getList(sourceType));
      const [moved] = items.splice(source.index, 1);
      items.splice(destination.index, 0, moved);
      setterMap[sourceType]?.(items);
      saveTaskOrderToStorage(sourceType, items.map((t) => t.id));
    } else {
      // Move between lists
      const sourceItems = Array.from(getList(sourceType));
      const destItems = Array.from(getList(destType));
      const [moved] = sourceItems.splice(source.index, 1);
      const movedTask = { ...moved, type: destType };
      destItems.splice(destination.index, 0, movedTask);

      setterMap[sourceType]?.(sourceItems);
      setterMap[destType]?.(destItems);
      saveTaskOrderToStorage(sourceType, sourceItems.map((t) => t.id));
      saveTaskOrderToStorage(destType, destItems.map((t) => t.id));

      // API update
      api.updateTask(moved.id, { type: destType }).catch(() => fetchTasks());
    }
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Skip if user is typing in an input or textarea
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      // If no task is focused, arrow keys start navigation
      if (!focusedTaskId) {
        if (e.key === "ArrowDown" || e.key === "ArrowUp") {
          e.preventDefault();
          e.stopPropagation();
          const flat = buildFlatList();
          if (flat.length > 0) {
            setFocusedTaskId(e.key === "ArrowUp" ? flat[flat.length - 1].task.id : flat[0].task.id);
          }
        }
        return;
      }

      const flat = buildFlatList();
      const currentIdx = flat.findIndex((f) => f.task.id === focusedTaskId);
      if (currentIdx === -1) return;

      const current = flat[currentIdx];

      if (e.key === "ArrowDown") {
        e.preventDefault();
        e.stopPropagation();
        if (currentIdx < flat.length - 1) {
          setFocusedTaskId(flat[currentIdx + 1].task.id);
        }
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        e.stopPropagation();
        if (currentIdx > 0) {
          setFocusedTaskId(flat[currentIdx - 1].task.id);
        }
      } else if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        setFocusedTaskId(null);
      } else if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        e.stopPropagation();
        handleToggleComplete(current.task.id, current.type);
      } else if (e.key.toLowerCase() === "e") {
        e.preventDefault();
        e.stopPropagation();
        startEditing(current.task);
      } else if (e.key.toLowerCase() === "d" && current.type !== "day") {
        e.preventDefault();
        e.stopPropagation();
        handleChangeType(current.task, current.type, "day");
      } else if (e.key.toLowerCase() === "w" && current.type !== "week") {
        e.preventDefault();
        e.stopPropagation();
        handleChangeType(current.task, current.type, "week");
      } else if (e.key.toLowerCase() === "f" && current.type !== "future") {
        e.preventDefault();
        e.stopPropagation();
        handleChangeType(current.task, current.type, "future");
      } else {
        // For any other key while focused, stop propagation so global shortcuts don't fire
        e.stopPropagation();
      }
    };

    window.addEventListener("keydown", handleKeyDown, true); // capture phase
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [focusedTaskId, buildFlatList, startEditing]);

  // Clear focus when clicking outside
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setFocusedTaskId(null);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Task row component
  const TaskRow = ({
    task,
    type,
    index,
    primary = false,
  }: {
    task: Task;
    type: TaskType;
    index: number;
    primary?: boolean;
  }) => {
    const isFocused = focusedTaskId === task.id;
    const otherTypes = MORNING_TYPES.filter((t) => t !== type);

    return (
      <Draggable
        draggableId={task.id}
        index={index}
        isDragDisabled={editingTaskId === task.id}
      >
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.draggableProps}
            {...provided.dragHandleProps}
            onClick={() => setFocusedTaskId(task.id)}
            className={`group relative flex items-center gap-3 cursor-pointer rounded-md px-2 transition-colors ${
              primary ? "py-2" : "py-1.5"
            } ${
              snapshot.isDragging
                ? "bg-blue-50 dark:bg-blue-900/30 shadow-md ring-1 ring-blue-300 dark:ring-blue-700"
                : isFocused
                ? "bg-slate-100 dark:bg-slate-700/60"
                : "hover:bg-slate-50 dark:hover:bg-slate-700/30"
            }`}
          >
            {/* Focus accent — subtle left edge bar when focused */}
            {isFocused && (
              <span className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-full bg-blue-500 dark:bg-blue-400" />
            )}

            {/* Checkbox */}
            <div
              onClick={(e) => {
                e.stopPropagation();
                handleToggleComplete(task.id, type);
              }}
              role="checkbox"
              aria-checked="false"
              tabIndex={-1}
              className="w-4 h-4 shrink-0 rounded border border-slate-300 dark:border-slate-500 bg-white dark:bg-slate-800 hover:border-slate-500 dark:hover:border-slate-300 transition-colors"
            />

            {/* Title */}
            {editingTaskId === task.id ? (
              <input
                type="text"
                value={editedTitle}
                onChange={(event) => setEditedTitle(event.target.value)}
                onClick={(event) => event.stopPropagation()}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    handleUpdateTitle(task, type, editedTitle);
                  } else if (event.key === "Escape") {
                    event.preventDefault();
                    cancelEditing();
                  }
                }}
                onBlur={() => handleUpdateTitle(task, type, editedTitle)}
                className={`min-w-0 flex-1 border-b border-blue-400 bg-transparent px-0 py-0.5 outline-none ${
                  primary
                    ? "text-[15px] text-slate-800 dark:text-slate-100"
                    : "text-sm text-slate-600 dark:text-slate-300"
                }`}
                aria-label={`Rename ${task.title}`}
                autoFocus
                onFocus={(event) => {
                  const input = event.currentTarget;
                  requestAnimationFrame(() => {
                    input.select();
                    input.scrollLeft = 0;
                  });
                }}
              />
            ) : (
              <span
                className={`flex-1 min-w-0 truncate ${
                  primary
                    ? "text-[15px] text-slate-800 dark:text-slate-100"
                    : "text-sm text-slate-600 dark:text-slate-300"
                }`}
                title={`${task.title} — double-click or press E to rename`}
                onDoubleClick={(event) => {
                  event.stopPropagation();
                  startEditing(task);
                }}
              >
                <LinkifiedTaskText text={task.title} />
              </span>
            )}

            {/* Type switch — subtle badges, always present, brighter on hover/focus */}
            <div
              className={`flex items-center gap-0.5 shrink-0 transition-opacity ${
                isFocused || snapshot.isDragging
                  ? "opacity-100"
                  : "opacity-0 group-hover:opacity-100"
              }`}
            >
              {otherTypes.map((t) => (
                <button
                  key={t}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleChangeType(task, type, t);
                  }}
                  title={TYPE_TITLES[t]}
                  className="w-5 h-5 flex items-center justify-center rounded text-[10px] font-semibold text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-100 hover:bg-white dark:hover:bg-slate-600 border border-transparent hover:border-slate-200 dark:hover:border-slate-500 transition-colors"
                >
                  {TYPE_LABELS[t]}
                </button>
              ))}
            </div>
          </div>
        )}
      </Draggable>
    );
  };

  // Section header for collapsible side sections
  const SectionHeader = ({
    title,
    count,
    isExpanded,
    onToggle,
  }: {
    title: string;
    count: number;
    isExpanded: boolean;
    onToggle: () => void;
  }) => (
    <button
      onClick={onToggle}
      className="flex items-center gap-2 w-full text-left mb-1.5 group/sh"
    >
      <span className="text-slate-400 dark:text-slate-500 group-hover/sh:text-slate-600 dark:group-hover/sh:text-slate-300 transition-colors">
        {isExpanded ? (
          <ChevronDown className="w-3.5 h-3.5" />
        ) : (
          <ChevronRight className="w-3.5 h-3.5" />
        )}
      </span>
      <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 group-hover/sh:text-slate-700 dark:group-hover/sh:text-slate-200 transition-colors">
        {title}
      </span>
      <span className="text-xs text-slate-400 dark:text-slate-500 tabular-nums">
        {count}
      </span>
    </button>
  );

  const PrimaryEmptyState = () => (
    <div className="flex flex-col items-center justify-center py-10 px-6 rounded-md border border-dashed border-slate-200 dark:border-slate-700">
      <Sparkles className="w-5 h-5 text-slate-300 dark:text-slate-600 mb-2" />
      <p className="text-sm text-slate-500 dark:text-slate-400">
        Nothing planned yet
      </p>
      <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
        Drag tasks from the right or press <kbd className="px-1 py-0.5 rounded border border-slate-200 dark:border-slate-600 text-[10px] font-mono">D</kbd>
      </p>
    </div>
  );

  const SecondaryEmptyState = ({ label }: { label: string }) => (
    <p className="text-xs text-slate-400 dark:text-slate-500 italic px-2 py-1.5">
      {label}
    </p>
  );

  if (isLoading) {
    return (
      <div className="w-full h-[calc(100vh-16rem)] px-6 py-5 rounded-lg bg-white dark:bg-slate-800 shadow-sm border border-slate-100 dark:border-slate-700">
        <div className="grid grid-cols-[1.2fr_1fr] gap-10">
          {[0, 1].map((col) => (
            <div key={col} className="space-y-3">
              <div className="h-6 w-32 bg-slate-100 dark:bg-slate-700 rounded animate-pulse" />
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-7 bg-slate-100 dark:bg-slate-700 rounded animate-pulse" />
              ))}
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      className="w-full h-[calc(100vh-16rem)] px-6 py-5 rounded-lg bg-white dark:bg-slate-800 shadow-sm border border-slate-100 dark:border-slate-700 flex flex-col overflow-hidden outline-none"
    >
      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="grid grid-cols-[1.2fr_1fr] gap-10 flex-1 min-h-0 overflow-hidden">
          {/* Left column: Today (primary) */}
          <div className="flex flex-col min-w-0 min-h-0">
            <div className="flex items-baseline justify-between mb-4 shrink-0">
              <div className="flex items-center gap-2.5">
                <Sun className="w-5 h-5 text-amber-400 dark:text-amber-300" />
                <h3 className="text-xl font-semibold text-slate-800 dark:text-slate-100 leading-none">
                  Today
                </h3>
                <span className="text-sm text-slate-400 dark:text-slate-500 tabular-nums">
                  {dayTasks.length}
                </span>
              </div>
              <span className="text-xs text-slate-400 dark:text-slate-500">
                {formatTodayLabel()}
              </span>
            </div>

            <Droppable droppableId="day">
              {(provided, snapshot) => (
                <div
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                  className={`space-y-1 overflow-y-auto overflow-x-hidden flex-1 min-h-0 rounded-md transition-colors ${
                    snapshot.isDraggingOver
                      ? "bg-blue-50/50 dark:bg-blue-900/10 ring-1 ring-blue-200 dark:ring-blue-800"
                      : ""
                  }`}
                >
                  {dayTasks.length === 0 && !snapshot.isDraggingOver && (
                    <PrimaryEmptyState />
                  )}
                  {dayTasks.map((task, index) => (
                    <TaskRow
                      key={task.id}
                      task={task}
                      type="day"
                      index={index}
                      primary
                    />
                  ))}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </div>

          {/* Right column: Sources (Weekly + Future + Obsidian) */}
          <div className="flex flex-col min-w-0 min-h-0 overflow-y-auto border-l border-slate-100 dark:border-slate-700/60 pl-6">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-4 shrink-0">
              Pull from
            </p>

            <div className="flex flex-col gap-5 flex-1 min-h-0">
              {/* Weekly section */}
              <div className={showWeekly ? "flex flex-col flex-1 min-h-0 min-w-0" : ""}>
                <SectionHeader
                  title="Weekly"
                  count={weekTasks.length}
                  isExpanded={showWeekly}
                  onToggle={() => setShowWeekly(!showWeekly)}
                />
                {showWeekly && (
                  <Droppable droppableId="week">
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        className={`space-y-0.5 overflow-y-auto overflow-x-hidden flex-1 min-h-0 rounded-md transition-colors ${
                          snapshot.isDraggingOver
                            ? "bg-blue-50/50 dark:bg-blue-900/10 ring-1 ring-blue-200 dark:ring-blue-800"
                            : ""
                        }`}
                      >
                        {weekTasks.length === 0 && !snapshot.isDraggingOver && (
                          <SecondaryEmptyState label="No weekly tasks" />
                        )}
                        {weekTasks.map((task, index) => (
                          <TaskRow key={task.id} task={task} type="week" index={index} />
                        ))}
                        {provided.placeholder}
                      </div>
                    )}
                  </Droppable>
                )}
              </div>

              {/* Future section */}
              <div className={showFuture ? "flex flex-col flex-1 min-h-0 min-w-0" : ""}>
                <SectionHeader
                  title="Future"
                  count={futureTasks.length}
                  isExpanded={showFuture}
                  onToggle={() => setShowFuture(!showFuture)}
                />
                {showFuture && (
                  <Droppable droppableId="future">
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        className={`space-y-0.5 overflow-y-auto overflow-x-hidden flex-1 min-h-0 rounded-md transition-colors ${
                          snapshot.isDraggingOver
                            ? "bg-blue-50/50 dark:bg-blue-900/10 ring-1 ring-blue-200 dark:ring-blue-800"
                            : ""
                        }`}
                      >
                        {futureTasks.length === 0 && !snapshot.isDraggingOver && (
                          <SecondaryEmptyState label="No future tasks" />
                        )}
                        {futureTasks.map((task, index) => (
                          <TaskRow key={task.id} task={task} type="future" index={index} />
                        ))}
                        {provided.placeholder}
                      </div>
                    )}
                  </Droppable>
                )}
              </div>

              {/* Obsidian inbox — controlled-expand so it shares vertical
                  flex sizing with Weekly/Future identically. */}
              <div className={showObsidian ? "flex flex-col flex-1 min-h-0 min-w-0" : ""}>
                <ObsidianTasksPanel
                  defaultType="day"
                  onImport={handleObsidianImport}
                  title="Obsidian"
                  headerVariant="section"
                  expanded={showObsidian}
                  onExpandedChange={setShowObsidian}
                />
              </div>
            </div>
          </div>
        </div>
      </DragDropContext>
    </div>
  );
};

export default MorningTasks;
