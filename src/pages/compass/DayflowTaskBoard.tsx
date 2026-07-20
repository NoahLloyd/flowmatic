import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  DragDropContext,
  Draggable,
  Droppable,
  DropResult,
} from "@hello-pangea/dnd";
import { Check, GripVertical } from "lucide-react";
import TaskContextMenu from "../../components/task/TaskContextMenu";
import { useNavigation } from "../../hooks/useNavigation";
import { Task, TaskType } from "../../types/Task";
import { api } from "../../utils/api";
import { subscribeToTaskAdded } from "../../utils/taskEvents";

const LIST_IDS: Record<"day" | "week", string> = {
  day: "dayflow-day-tasks",
  week: "dayflow-week-tasks",
};

const TODAY_KEY = () => new Date().toDateString();
const ACTIVE_CACHE_KEY = "cachedDailyActive";
const COMPLETED_CACHE_KEY = "cachedDailyCompleted";

type BoardTaskType = "day" | "week";
type MenuState = { task: Task; position: { x: number; y: number } } | null;

const isToday = (dateInput: Date | string | null) => {
  if (!dateInput) return false;
  const date = new Date(dateInput);
  const today = new Date();
  if (isNaN(date.getTime())) return false;
  return (
    date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear()
  );
};

const readCachedTasks = (key: string): Task[] | null => {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { day: string; tasks: Task[] };
    return parsed.day === TODAY_KEY() ? parsed.tasks : null;
  } catch {
    return null;
  }
};

const writeCachedTasks = (key: string, tasks: Task[]) => {
  try {
    localStorage.setItem(key, JSON.stringify({ day: TODAY_KEY(), tasks }));
  } catch {
    // A cache write should never make task interactions fail.
  }
};

const getStoredOrder = (type: TaskType): string[] => {
  try {
    const raw = localStorage.getItem(`taskOrder_${type}`);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

const saveStoredOrder = (type: TaskType, tasks: Task[]) => {
  localStorage.setItem(
    `taskOrder_${type}`,
    JSON.stringify(tasks.map((task) => task.id)),
  );
};

const applyStoredOrder = (tasks: Task[], type: TaskType) => {
  const order = getStoredOrder(type);
  if (order.length === 0) return tasks;

  return [...tasks].sort((a, b) => {
    const indexA = order.indexOf(a.id);
    const indexB = order.indexOf(b.id);
    if (indexA === -1 && indexB === -1) return 0;
    if (indexA === -1) return 1;
    if (indexB === -1) return -1;
    return indexA - indexB;
  });
};

const typeFromDroppableId = (id: string): BoardTaskType | null => {
  if (id === LIST_IDS.day) return "day";
  if (id === LIST_IDS.week) return "week";
  return null;
};

const removeFromWorkingSet = (task: Task) => {
  let activeTitles: string[] = [];
  try {
    const raw = localStorage.getItem("currentTasks");
    if (raw) activeTitles = JSON.parse(raw) || [];
  } catch {
    // Fall through to the legacy single-task value.
  }
  if (activeTitles.length === 0) {
    const legacyTitle = localStorage.getItem("currentTask");
    if (legacyTitle) activeTitles = [legacyTitle];
  }
  if (activeTitles.includes(task.title)) {
    window.dispatchEvent(
      new CustomEvent("remove-current-task", {
        detail: { title: task.title },
      }),
    );
  }
};

const DayflowTaskBoard: React.FC = () => {
  const cachedActiveRef = useRef(readCachedTasks(ACTIVE_CACHE_KEY));
  const cachedCompletedRef = useRef(readCachedTasks(COMPLETED_CACHE_KEY));
  const [dayTasks, setDayTasks] = useState<Task[]>(cachedActiveRef.current ?? []);
  const [weekTasks, setWeekTasks] = useState<Task[]>([]);
  const [completedTasks, setCompletedTasks] = useState<Task[]>(
    cachedCompletedRef.current ?? [],
  );
  const [isLoading, setIsLoading] = useState(
    cachedActiveRef.current === null && cachedCompletedRef.current === null,
  );
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editedTitle, setEditedTitle] = useState("");
  const [menu, setMenu] = useState<MenuState>(null);
  const [taskMode, setTaskMode] = useState(false);
  const [selectedTaskIndex, setSelectedTaskIndex] = useState<number | null>(null);
  const { selected } = useNavigation();
  const previousPageRef = useRef(selected);

  const fetchTasks = useCallback(async () => {
    try {
      const [day, week] = await Promise.all([
        api.getTasksByType("day"),
        api.getTasksByType("week"),
      ]);
      const activeDay = applyStoredOrder(
        day.filter((task) => !task.completed),
        "day",
      );
      const activeWeek = applyStoredOrder(
        week.filter((task) => !task.completed),
        "week",
      );
      const completedToday = day.filter(
        (task) => task.completed && isToday(task.completedAt),
      );

      setDayTasks(activeDay);
      setWeekTasks(activeWeek);
      setCompletedTasks(completedToday);
    } catch (error) {
      console.error("Failed to fetch Compass tasks:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  useEffect(() => {
    if (selected === "Compass" && previousPageRef.current !== "Compass") {
      fetchTasks();
    }
    previousPageRef.current = selected;
  }, [fetchTasks, selected]);

  useEffect(() => {
    if (isLoading) return;
    writeCachedTasks(ACTIVE_CACHE_KEY, dayTasks);
    writeCachedTasks(COMPLETED_CACHE_KEY, completedTasks);
  }, [completedTasks, dayTasks, isLoading]);

  useEffect(() => {
    const unsubscribe = subscribeToTaskAdded((newTask) => {
      if (newTask.completed) return;
      if (newTask.type === "day") {
        setDayTasks((current) =>
          current.some((task) => task.id === newTask.id)
            ? current
            : [newTask, ...current],
        );
        const order = getStoredOrder("day");
        if (!order.includes(newTask.id)) {
          localStorage.setItem(
            "taskOrder_day",
            JSON.stringify([newTask.id, ...order]),
          );
        }
      } else if (newTask.type === "week") {
        setWeekTasks((current) =>
          current.some((task) => task.id === newTask.id)
            ? current
            : [newTask, ...current],
        );
        const order = getStoredOrder("week");
        if (!order.includes(newTask.id)) {
          localStorage.setItem(
            "taskOrder_week",
            JSON.stringify([newTask.id, ...order]),
          );
        }
      }
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    let lastCheckedDay = TODAY_KEY();
    const checkDayChange = () => {
      const currentDay = TODAY_KEY();
      if (currentDay !== lastCheckedDay) {
        lastCheckedDay = currentDay;
        fetchTasks();
      }
    };
    const handleVisibility = () => {
      if (document.visibilityState === "visible") checkDayChange();
    };

    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("focus", checkDayChange);
    const interval = window.setInterval(checkDayChange, 5 * 60 * 1000);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("focus", checkDayChange);
      window.clearInterval(interval);
    };
  }, [fetchTasks]);

  const getTasks = (type: BoardTaskType) =>
    type === "day" ? dayTasks : weekTasks;

  const setTasks = (type: BoardTaskType, tasks: Task[]) => {
    if (type === "day") setDayTasks(tasks);
    else setWeekTasks(tasks);
  };

  const startEditing = useCallback((task: Task) => {
    setMenu(null);
    setEditingTaskId(task.id);
    setEditedTitle(task.title);
  }, []);

  const handleUpdateTitle = async (task: Task, title: string) => {
    const trimmedTitle = title.trim();
    setEditingTaskId(null);
    if (!trimmedTitle || trimmedTitle === task.title) return;

    const updateTitle = (tasks: Task[]) =>
      tasks.map((item) =>
        item.id === task.id ? { ...item, title: trimmedTitle } : item,
      );
    setDayTasks(updateTitle);
    setWeekTasks(updateTitle);
    setCompletedTasks(updateTitle);

    try {
      await api.updateTask(task.id, { title: trimmedTitle });
    } catch (error) {
      console.error("Failed to update task title:", error);
      fetchTasks();
    }
  };

  const handleToggleComplete = useCallback(
    (task: Task) => {
      const completed = !task.completed;
      const updatedTask = {
        ...task,
        completed,
        completedAt: completed ? new Date() : null,
      };

      if (completed) {
        if (task.type === "day") {
          setDayTasks((current) => {
            const next = current.filter((item) => item.id !== task.id);
            saveStoredOrder("day", next);
            return next;
          });
          setCompletedTasks((current) => [...current, updatedTask]);
          removeFromWorkingSet(task);
        } else if (task.type === "week") {
          setWeekTasks((current) => {
            const next = current.filter((item) => item.id !== task.id);
            saveStoredOrder("week", next);
            return next;
          });
        }
      } else {
        setCompletedTasks((current) =>
          current.filter((item) => item.id !== task.id),
        );
        if (task.type === "day") {
          setDayTasks((current) => {
            const next = [updatedTask, ...current];
            saveStoredOrder("day", next);
            return next;
          });
        }
      }

      api
        .updateTask(task.id, {
          completed,
          completedAt: updatedTask.completedAt,
        })
        .catch((error) => {
          console.error("Failed to update task completion:", error);
          fetchTasks();
        });
    },
    [fetchTasks],
  );

  const handleMoveTask = useCallback(
    (task: Task, toType: TaskType) => {
      if (task.type === toType || task.completed) return;

      if (task.type === "day") {
        setDayTasks((current) => {
          const next = current.filter((item) => item.id !== task.id);
          saveStoredOrder("day", next);
          return next;
        });
      } else if (task.type === "week") {
        setWeekTasks((current) => {
          const next = current.filter((item) => item.id !== task.id);
          saveStoredOrder("week", next);
          return next;
        });
      }

      const movedTask = { ...task, type: toType };
      if (toType === "day") {
        setDayTasks((current) => {
          const next = [movedTask, ...current];
          saveStoredOrder("day", next);
          return next;
        });
      } else if (toType === "week") {
        setWeekTasks((current) => {
          const next = [movedTask, ...current];
          saveStoredOrder("week", next);
          return next;
        });
      }

      api.updateTask(task.id, { type: toType }).catch((error) => {
        console.error("Failed to move task:", error);
        fetchTasks();
      });
    },
    [fetchTasks],
  );

  const handleDeleteTask = useCallback(
    (task: Task) => {
      if (task.type === "day") {
        setDayTasks((current) => {
          const next = current.filter((item) => item.id !== task.id);
          saveStoredOrder("day", next);
          return next;
        });
      } else if (task.type === "week") {
        setWeekTasks((current) => {
          const next = current.filter((item) => item.id !== task.id);
          saveStoredOrder("week", next);
          return next;
        });
      }
      setCompletedTasks((current) =>
        current.filter((item) => item.id !== task.id),
      );
      removeFromWorkingSet(task);

      api.deleteTask(task.id).catch((error) => {
        console.error("Failed to delete task:", error);
        fetchTasks();
      });
    },
    [fetchTasks],
  );

  const handleDragStart = () => {
    setMenu(null);
  };

  const handleDragEnd = (result: DropResult) => {
    const { source, destination } = result;
    if (!destination) return;

    const sourceType = typeFromDroppableId(source.droppableId);
    const destinationType = typeFromDroppableId(destination.droppableId);
    if (!sourceType || !destinationType) return;
    if (
      sourceType === destinationType &&
      source.index === destination.index
    ) {
      return;
    }

    if (sourceType === destinationType) {
      const reordered = [...getTasks(sourceType)];
      const [moved] = reordered.splice(source.index, 1);
      if (!moved) return;
      reordered.splice(destination.index, 0, moved);
      setTasks(sourceType, reordered);
      saveStoredOrder(sourceType, reordered);
      return;
    }

    const sourceTasks = [...getTasks(sourceType)];
    const destinationTasks = [...getTasks(destinationType)];
    const [moved] = sourceTasks.splice(source.index, 1);
    if (!moved) return;
    const movedTask = { ...moved, type: destinationType };
    destinationTasks.splice(destination.index, 0, movedTask);

    setTasks(sourceType, sourceTasks);
    setTasks(destinationType, destinationTasks);
    saveStoredOrder(sourceType, sourceTasks);
    saveStoredOrder(destinationType, destinationTasks);

    api.updateTask(moved.id, { type: destinationType }).catch((error) => {
      console.error("Failed to move task:", error);
      fetchTasks();
    });
  };

  useEffect(() => {
    if (taskMode) document.body.dataset.taskMode = "true";
    else delete document.body.dataset.taskMode;
    return () => {
      delete document.body.dataset.taskMode;
    };
  }, [taskMode]);

  useEffect(() => {
    if (editingTaskId) {
      setTaskMode(false);
      setSelectedTaskIndex(null);
    }
  }, [editingTaskId]);

  useEffect(() => {
    if (
      taskMode &&
      selectedTaskIndex !== null &&
      selectedTaskIndex >= dayTasks.length
    ) {
      setSelectedTaskIndex(null);
    }
  }, [dayTasks.length, selectedTaskIndex, taskMode]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement ||
        document.body.dataset.taskPickerOpen === "true" ||
        document.body.dataset.quickAddOpen === "true" ||
        document.body.dataset.taskContextMenuOpen === "true"
      ) {
        return;
      }

      if (
        event.key.toLowerCase() === "u" &&
        !event.metaKey &&
        !event.ctrlKey &&
        !event.altKey &&
        !taskMode
      ) {
        event.preventDefault();
        event.stopPropagation();
        setTaskMode(true);
        setSelectedTaskIndex(null);
        return;
      }
      if (!taskMode) return;

      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        setTaskMode(false);
        setSelectedTaskIndex(null);
        return;
      }

      const number = parseInt(event.key);
      if (!isNaN(number) && number >= 0 && number <= 9) {
        event.preventDefault();
        event.stopPropagation();
        const index = number === 0 ? 9 : number - 1;
        if (index < dayTasks.length) setSelectedTaskIndex(index);
        return;
      }

      if (selectedTaskIndex !== null && selectedTaskIndex < dayTasks.length) {
        const task = dayTasks[selectedTaskIndex];
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          handleToggleComplete(task);
          setSelectedTaskIndex(null);
        } else if (event.key.toLowerCase() === "e") {
          event.preventDefault();
          startEditing(task);
        } else if (event.key.toLowerCase() === "w") {
          event.preventDefault();
          handleMoveTask(task, "week");
          setSelectedTaskIndex(null);
        } else if (event.key.toLowerCase() === "d") {
          event.preventDefault();
          handleDeleteTask(task);
          setSelectedTaskIndex(null);
        }
      }

      event.stopPropagation();
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [
    dayTasks,
    handleDeleteTask,
    handleMoveTask,
    handleToggleComplete,
    selectedTaskIndex,
    startEditing,
    taskMode,
  ]);

  const openMenu = (event: React.MouseEvent, task: Task) => {
    event.preventDefault();
    event.stopPropagation();
    setMenu({ task, position: { x: event.clientX, y: event.clientY } });
  };

  const numberLabel = (index: number) => {
    if (index < 9) return String(index + 1);
    if (index === 9) return "0";
    return null;
  };

  const renderTask = (task: Task, index: number, type: BoardTaskType) => {
    const selectedInTaskMode =
      type === "day" && taskMode && selectedTaskIndex === index;
    const label = numberLabel(index);

    return (
      <Draggable key={task.id} draggableId={task.id} index={index}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.draggableProps}
            {...provided.dragHandleProps}
            onContextMenu={(event) => openMenu(event, task)}
            className={`group flex cursor-grab items-start gap-2 rounded-lg border px-2.5 py-2 transition-[background-color,border-color,box-shadow] active:cursor-grabbing ${
              snapshot.isDragging
                ? "border-indigo-300 bg-white shadow-lg ring-1 ring-indigo-200 dark:border-indigo-700 dark:bg-gray-800 dark:ring-indigo-800"
                : selectedInTaskMode
                ? "border-indigo-300 bg-indigo-50/80 ring-1 ring-indigo-100 dark:border-indigo-700 dark:bg-indigo-950/30 dark:ring-indigo-900"
                : "border-transparent hover:border-gray-200 hover:bg-gray-50/80 dark:hover:border-gray-700 dark:hover:bg-gray-800/70"
            }`}
          >
            {selectedInTaskMode && label ? (
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-indigo-500 text-[10px] font-bold text-white">
                {label}
              </span>
            ) : (
              <button
                type="button"
                onClick={() => handleToggleComplete(task)}
                className="mt-0.5 h-5 w-5 shrink-0 cursor-pointer rounded-md border-2 border-gray-300 bg-white transition-colors hover:border-emerald-500 hover:bg-emerald-50 dark:border-gray-600 dark:bg-gray-900 dark:hover:border-emerald-500 dark:hover:bg-emerald-950/30"
                aria-label={`Complete ${task.title}`}
              />
            )}

            <div className="min-w-0 flex-1">
              {editingTaskId === task.id ? (
                <input
                  type="text"
                  value={editedTitle}
                  onChange={(event) => setEditedTitle(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      handleUpdateTitle(task, editedTitle);
                    } else if (event.key === "Escape") {
                      setEditingTaskId(null);
                    }
                  }}
                  onBlur={() => handleUpdateTitle(task, editedTitle)}
                  className="w-full border-b border-indigo-400 bg-transparent pb-0.5 text-[15px] leading-6 text-gray-900 outline-none dark:border-indigo-500 dark:text-gray-100"
                  style={{
                    fontFamily:
                      '"SF Pro Rounded", ui-rounded, -apple-system, BlinkMacSystemFont, sans-serif',
                  }}
                  autoFocus
                />
              ) : (
                <span
                  onClick={() => startEditing(task)}
                  className="block cursor-text break-words text-[15px] leading-6 text-gray-800 dark:text-gray-200"
                  style={{
                    fontFamily:
                      '"SF Pro Rounded", ui-rounded, -apple-system, BlinkMacSystemFont, sans-serif',
                  }}
                >
                  {task.title}
                </span>
              )}
            </div>

            {selectedInTaskMode ? (
              <div className="ml-auto flex shrink-0 items-center gap-1 pt-0.5">
                {["↵", "e", "w", "d"].map((key) => (
                  <kbd
                    key={key}
                    className={`rounded border px-1 py-0.5 font-mono text-[9px] ${
                      key === "d"
                        ? "border-red-200 bg-red-50 text-red-500 dark:border-red-900 dark:bg-red-950/30 dark:text-red-400"
                        : "border-gray-200 bg-white text-gray-400 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-500"
                    }`}
                  >
                    {key}
                  </kbd>
                ))}
              </div>
            ) : (
              <span
                className={`mt-0.5 rounded p-0.5 text-gray-300 transition-opacity hover:bg-gray-200 hover:text-gray-500 focus:opacity-100 focus:outline-none dark:text-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-300 ${
                  snapshot.isDragging
                    ? "opacity-100"
                    : "opacity-0 group-hover:opacity-100"
                }`}
                aria-hidden="true"
                title="Drag to reorder or move"
              >
                <GripVertical className="h-4 w-4" />
              </span>
            )}
          </div>
        )}
      </Draggable>
    );
  };

  const renderList = (type: BoardTaskType) => {
    const tasks = getTasks(type);

    return (
      <Droppable droppableId={LIST_IDS[type]}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={`space-y-1 rounded-lg p-1 transition-colors ${
              type === "week" || completedTasks.length === 0
                ? "min-h-full"
                : "min-h-[8rem]"
            } ${
              snapshot.isDraggingOver
                ? "bg-indigo-50 ring-2 ring-inset ring-indigo-200 dark:bg-indigo-950/25 dark:ring-indigo-800"
                : ""
            }`}
          >
            {tasks.map((task, index) => renderTask(task, index, type))}
            {tasks.length === 0 && (
              <div
                aria-hidden="true"
                className={`flex min-h-[8rem] flex-col items-center justify-center rounded-lg border border-dashed px-4 text-center transition-colors ${
                  snapshot.isDraggingOver
                    ? "border-indigo-300 text-indigo-600 dark:border-indigo-700 dark:text-indigo-400"
                    : "border-gray-200 text-gray-400 dark:border-gray-800 dark:text-gray-500"
                }`}
              />
            )}
            {provided.placeholder}
          </div>
        )}
      </Droppable>
    );
  };

  const BoardSkeleton = () => (
    <div className="space-y-2 p-3">
      {[1, 2, 3].map((item) => (
        <div
          key={item}
          className="h-10 animate-pulse rounded-lg bg-gray-100 dark:bg-gray-800"
        />
      ))}
    </div>
  );

  return (
    <DragDropContext onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1.35fr)_minmax(18rem,1fr)] gap-6">
        <section className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <header className="shrink-0 border-b border-gray-100 bg-gray-50/60 px-4 py-3 dark:border-gray-800 dark:bg-gray-800/30">
            <h2 className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
              Day
            </h2>
          </header>
          <div className="min-h-0 flex-1 overflow-y-auto p-2 scrollbar-hide">
            {isLoading ? <BoardSkeleton /> : renderList("day")}
            {!isLoading && completedTasks.length > 0 && (
              <div className="px-1 pb-1 pt-3">
                <div className="mx-2 mb-1.5 h-px bg-gray-100 dark:bg-gray-800" />
                <div className="space-y-1">
                  {completedTasks.map((task) => (
                    <div
                      key={task.id}
                      onContextMenu={(event) => openMenu(event, task)}
                      className="group flex items-start gap-2 rounded-lg px-2.5 py-2 transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/60"
                    >
                      <button
                        type="button"
                        onClick={() => handleToggleComplete(task)}
                        className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border border-gray-800 bg-gray-800 text-white transition-transform hover:scale-105 dark:border-gray-100 dark:bg-gray-100 dark:text-gray-900"
                        aria-label={`Mark ${task.title} incomplete`}
                      >
                        <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
                      </button>
                      {editingTaskId === task.id ? (
                        <input
                          type="text"
                          value={editedTitle}
                          onChange={(event) => setEditedTitle(event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter") {
                              handleUpdateTitle(task, editedTitle);
                            } else if (event.key === "Escape") {
                              setEditingTaskId(null);
                            }
                          }}
                          onBlur={() => handleUpdateTitle(task, editedTitle)}
                          className="min-w-0 flex-1 border-b border-gray-300 bg-transparent pb-0.5 text-[15px] leading-6 text-gray-500 outline-none dark:border-gray-700 dark:text-gray-400"
                          autoFocus
                        />
                      ) : (
                        <span
                          onClick={() => startEditing(task)}
                          className="min-w-0 flex-1 cursor-text break-words text-[15px] leading-6 text-gray-400 line-through decoration-gray-300 dark:text-gray-600 dark:decoration-gray-700"
                        >
                          {task.title}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>

        <section className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <header className="shrink-0 border-b border-gray-100 bg-gray-50/60 px-4 py-3 dark:border-gray-800 dark:bg-gray-800/30">
            <h2 className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
              Week
            </h2>
          </header>
          <div className="min-h-0 flex-1 overflow-y-auto p-2 scrollbar-hide">
            {isLoading ? <BoardSkeleton /> : renderList("week")}
          </div>
        </section>
      </div>

      {menu && (
        <TaskContextMenu
          task={menu.task}
          position={menu.position}
          onClose={() => setMenu(null)}
          onToggleComplete={handleToggleComplete}
          onEdit={startEditing}
          onMove={handleMoveTask}
          onDelete={handleDeleteTask}
        />
      )}
    </DragDropContext>
  );
};

export default DayflowTaskBoard;
