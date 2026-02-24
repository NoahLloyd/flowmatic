import React, { useState, useEffect, useCallback, useRef } from "react";
import { Task, TaskType } from "../../types/Task";
import { api } from "../../utils/api";
import { ChevronDown, ChevronRight } from "lucide-react";
import { subscribeToTaskAdded } from "../../utils/taskEvents";
import {
  DragDropContext,
  Droppable,
  Draggable,
  DropResult,
} from "react-beautiful-dnd";

// Only D, W, F are relevant for the morning view
const MORNING_TYPES: TaskType[] = ["day", "week", "future"];

const TYPE_LABELS: Record<string, string> = {
  day: "D",
  week: "W",
  future: "F",
};

const MorningTasks: React.FC = () => {
  const [dayTasks, setDayTasks] = useState<Task[]>([]);
  const [weekTasks, setWeekTasks] = useState<Task[]>([]);
  const [futureTasks, setFutureTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Collapsible states
  const [showWeekly, setShowWeekly] = useState(true);
  const [showFuture, setShowFuture] = useState(false);

  // Keyboard focus state: which task is highlighted
  const [focusedTaskId, setFocusedTaskId] = useState<string | null>(null);
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
  }, [focusedTaskId, buildFlatList]);

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
  }: {
    task: Task;
    type: TaskType;
    index: number;
  }) => {
    const isFocused = focusedTaskId === task.id;
    const otherTypes = MORNING_TYPES.filter((t) => t !== type);

    return (
      <Draggable draggableId={task.id} index={index}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.draggableProps}
            {...provided.dragHandleProps}
            onClick={() => setFocusedTaskId(task.id)}
            className={`flex items-center gap-2.5 py-1 relative cursor-pointer rounded-sm px-1 -mx-1 transition-colors ${
              snapshot.isDragging
                ? "bg-blue-50 dark:bg-blue-900/30 shadow-md ring-1 ring-blue-300 dark:ring-blue-700"
                : isFocused
                ? "bg-gray-100 dark:bg-gray-700/50"
                : "hover:bg-gray-50 dark:hover:bg-gray-700/30"
            }`}
          >
            {/* Checkbox */}
            <div
              onClick={(e) => {
                e.stopPropagation();
                handleToggleComplete(task.id, type);
              }}
              className="w-3.5 h-3.5 shrink-0 rounded flex items-center justify-center cursor-pointer border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 hover:border-gray-400 dark:hover:border-gray-500"
            />

            {/* Title - full width, overflow hidden with no ellipsis */}
            <span className="text-sm text-gray-700 dark:text-gray-300 flex-1 min-w-0 overflow-hidden whitespace-nowrap">
              {task.title}
            </span>

            {/* Type switch buttons - overlaid on the right, over the text */}
            {(isFocused || snapshot.isDragging) && (
              <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-0.5 bg-gray-100/90 dark:bg-gray-700/90 rounded px-0.5 py-0.5 backdrop-blur-sm">
                {otherTypes.map((t) => (
                  <button
                    key={t}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleChangeType(task, type, t);
                    }}
                    className="w-5 h-5 flex items-center justify-center rounded text-[10px] font-bold text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-white dark:hover:bg-gray-600 transition-colors"
                  >
                    {TYPE_LABELS[t]}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </Draggable>
    );
  };

  // Section header for collapsible sections
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
      className="flex items-center gap-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors mb-1.5 shrink-0"
    >
      {isExpanded ? (
        <ChevronDown className="w-3.5 h-3.5" />
      ) : (
        <ChevronRight className="w-3.5 h-3.5" />
      )}
      <span>{title}</span>
      <span className="text-xs text-gray-400 dark:text-gray-500 font-normal">
        {count}
      </span>
    </button>
  );

  const EmptyState = () => (
    <p className="text-xs text-gray-400 dark:text-gray-500 italic py-1 pl-1">
      No tasks
    </p>
  );

  if (isLoading) {
    return (
      <div className="w-full h-[calc(100vh-16rem)] p-6 rounded-lg bg-white dark:bg-slate-800 shadow-sm border border-slate-100 dark:border-slate-700">
        <div className="grid grid-cols-2 gap-8">
          {[0, 1].map((col) => (
            <div key={col} className="space-y-3">
              <div className="h-5 w-24 bg-gray-100 dark:bg-gray-700 rounded animate-pulse" />
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-6 bg-gray-100 dark:bg-gray-700 rounded animate-pulse" />
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
      className="w-full h-[calc(100vh-16rem)] p-6 rounded-lg bg-white dark:bg-slate-800 shadow-sm border border-slate-100 dark:border-slate-700 flex flex-col overflow-hidden outline-none"
    >
      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="grid grid-cols-2 gap-8 flex-1 min-h-0 overflow-hidden">
          {/* Left column: Daily */}
          <div className="flex flex-col min-w-0 min-h-0">
            <div className="flex items-center justify-between mb-3 shrink-0">
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Daily
              </h3>
              <span className="text-xs text-gray-400 dark:text-gray-500">
                {dayTasks.length}
              </span>
            </div>
            <Droppable droppableId="day">
              {(provided, snapshot) => (
                <div
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                  className={`space-y-0.5 overflow-y-auto flex-1 min-h-0 rounded-md transition-colors ${
                    snapshot.isDraggingOver ? "bg-blue-50/50 dark:bg-blue-900/10" : ""
                  }`}
                >
                  {dayTasks.length === 0 && !snapshot.isDraggingOver && <EmptyState />}
                  {dayTasks.map((task, index) => (
                    <TaskRow key={task.id} task={task} type="day" index={index} />
                  ))}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </div>

          {/* Right column: Weekly + Future */}
          <div className="flex flex-col min-h-0 overflow-y-auto gap-3">
            {/* Weekly section */}
            <div className={showWeekly ? "flex flex-col flex-1 min-h-0" : ""}>
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
                      className={`space-y-0.5 overflow-y-auto flex-1 min-h-0 pl-1 rounded-md transition-colors ${
                        snapshot.isDraggingOver ? "bg-blue-50/50 dark:bg-blue-900/10" : ""
                      }`}
                    >
                      {weekTasks.length === 0 && !snapshot.isDraggingOver && <EmptyState />}
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
            <div className={showFuture ? "flex flex-col flex-1 min-h-0" : ""}>
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
                      className={`space-y-0.5 overflow-y-auto flex-1 min-h-0 pl-1 rounded-md transition-colors ${
                        snapshot.isDraggingOver ? "bg-blue-50/50 dark:bg-blue-900/10" : ""
                      }`}
                    >
                      {futureTasks.length === 0 && !snapshot.isDraggingOver && <EmptyState />}
                      {futureTasks.map((task, index) => (
                        <TaskRow key={task.id} task={task} type="future" index={index} />
                      ))}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              )}
            </div>
          </div>
        </div>
      </DragDropContext>
    </div>
  );
};

export default MorningTasks;
