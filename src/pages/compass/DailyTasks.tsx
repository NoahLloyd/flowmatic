import React, { useState, useEffect, useCallback } from "react";
import { Task, TaskType } from "../../types/Task";
import { api } from "../../utils/api";
import { useTasks } from "../../hooks/useTasks";
import { useNavigation } from "../../hooks/useNavigation";
import {
  DragDropContext,
  Droppable,
  Draggable,
  DropResult,
} from "@hello-pangea/dnd";
import {
  subscribeToTaskAdded,
  subscribeToTaskUpdated,
} from "../../utils/taskEvents";
import TaskContextMenu from "../../components/task/TaskContextMenu";
import LinkifiedTaskText from "../../components/task/LinkifiedTaskText";

// Hydrate daily task lists from a localStorage snapshot of the previous
// fetch. Eliminates the boot-time skeleton flash — if today's data is
// already cached, we render it immediately and only re-render if the
// background fetch returns something different.
const TODAY_KEY = () => new Date().toDateString();
const ACTIVE_CACHE_KEY = "cachedDailyActive";
const COMPLETED_CACHE_KEY = "cachedDailyCompleted";

const readCachedTasks = (key: string): Task[] | null => {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { day: string; tasks: Task[] };
    if (parsed.day !== TODAY_KEY()) return null;
    return parsed.tasks;
  } catch {
    return null;
  }
};

const writeCachedTasks = (key: string, tasks: Task[]) => {
  try {
    localStorage.setItem(
      key,
      JSON.stringify({ day: TODAY_KEY(), tasks })
    );
  } catch {
    /* quota error etc, ignore */
  }
};

const DailyTasks: React.FC = () => {
  const cachedActive = readCachedTasks(ACTIVE_CACHE_KEY);
  const cachedCompleted = readCachedTasks(COMPLETED_CACHE_KEY);
  const [activeTasks, setActiveTasks] = useState<Task[]>(cachedActive ?? []);
  const [completedTasks, setCompletedTasks] = useState<Task[]>(
    cachedCompleted ?? []
  );
  // Skip the skeleton if we have cached data for today — the background
  // fetch will quietly update the list if anything changed.
  const [isLoading, setIsLoading] = useState(
    cachedActive === null && cachedCompleted === null
  );
  const { selected } = useNavigation();
  const { handleDeleteTask, handleChangeTaskType } = useTasks();

  // Editing state
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editedTitle, setEditedTitle] = useState("");
  const [contextMenu, setContextMenu] = useState<{
    task: Task;
    position: { x: number; y: number };
  } | null>(null);

  // Task shortcut mode state
  const [taskMode, setTaskMode] = useState(false);
  const [selectedTaskIndex, setSelectedTaskIndex] = useState<number | null>(null);

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

  const getTaskOrderFromStorage = (type: TaskType): string[] | null => {
    const storedOrder = localStorage.getItem(`taskOrder_${type}`);
    return storedOrder ? JSON.parse(storedOrder) : null;
  };

  const saveTaskOrderToStorage = (type: TaskType, order: string[]): void => {
    localStorage.setItem(`taskOrder_${type}`, JSON.stringify(order));
  };

  const fetchTasks = async () => {
    // Only show the skeleton if we have nothing on screen — once we have
    // hydrated content, fetching runs silently in the background.
    setIsLoading((prev) =>
      activeTasks.length === 0 && completedTasks.length === 0 ? true : prev
    );
    try {
      const allTasks = await api.getTasksByType("day");

      let active = allTasks.filter((task) => !task.completed);

      const taskOrderDay = getTaskOrderFromStorage("day");
      if (taskOrderDay) {
        active = active.sort((a, b) => {
          const indexA = taskOrderDay.indexOf(a.id);
          const indexB = taskOrderDay.indexOf(b.id);
          if (indexA === -1 && indexB === -1) return 0;
          if (indexA === -1) return 1;
          if (indexB === -1) return -1;
          return indexA - indexB;
        });
      }

      const completed = allTasks.filter((task) => {
        return task.completed && isToday(task.completedAt);
      });

      setActiveTasks(active);
      setCompletedTasks(completed);
      writeCachedTasks(ACTIVE_CACHE_KEY, active);
      writeCachedTasks(COMPLETED_CACHE_KEY, completed);
    } catch (error) {
      console.error("Failed to fetch daily tasks:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, []);

  useEffect(() => {
    if (selected === "Compass") {
      fetchTasks();
    }
  }, [selected]);

  // Detect day change when app regains focus
  useEffect(() => {
    let lastCheckedDay = new Date().toDateString();

    const checkDayChange = () => {
      const today = new Date().toDateString();
      if (today !== lastCheckedDay) {
        lastCheckedDay = today;
        fetchTasks();
      }
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        checkDayChange();
      }
    };
    const onFocus = () => checkDayChange();

    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("focus", onFocus);
    const interval = setInterval(checkDayChange, 5 * 60 * 1000);

    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("focus", onFocus);
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    const unsubscribe = subscribeToTaskAdded((newTask) => {
      if (newTask.type === "day" && !newTask.completed) {
        setActiveTasks((prev) => {
          if (prev.some((t) => t.id === newTask.id)) {
            return prev;
          }
          return [newTask, ...prev];
        });
        const currentOrder = getTaskOrderFromStorage("day") || [];
        if (!currentOrder.includes(newTask.id)) {
          saveTaskOrderToStorage("day", [newTask.id, ...currentOrder]);
        }
      }
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    return subscribeToTaskUpdated((updatedTask) => {
      setActiveTasks((prev) => {
        const withoutTask = prev.filter((task) => task.id !== updatedTask.id);
        if (updatedTask.type === "day" && !updatedTask.completed) {
          return [updatedTask, ...withoutTask];
        }
        return withoutTask;
      });

      setCompletedTasks((prev) => {
        const withoutTask = prev.filter((task) => task.id !== updatedTask.id);
        if (
          updatedTask.type === "day" &&
          updatedTask.completed &&
          isToday(updatedTask.completedAt)
        ) {
          return [...withoutTask, updatedTask];
        }
        return withoutTask;
      });

      if (updatedTask.completed) {
        const currentOrder = getTaskOrderFromStorage("day") || [];
        saveTaskOrderToStorage(
          "day",
          currentOrder.filter((taskId) => taskId !== updatedTask.id)
        );
      }
    });
  }, []);

  const handleToggleComplete = useCallback(async (id: string) => {
    try {
      const task = [...activeTasks, ...completedTasks].find(
        (t) => t.id === id
      );
      if (!task) return;

      const updates = {
        completed: !task.completed,
        completedAt: !task.completed ? new Date() : null,
      };

      if (updates.completed) {
        const taskToMove = activeTasks.find((t) => t.id === id);
        if (taskToMove) {
          setActiveTasks((prev) => prev.filter((t) => t.id !== id));
          setCompletedTasks((prev) => [...prev, { ...taskToMove, ...updates }]);
          const currentOrder = getTaskOrderFromStorage("day") || [];
          saveTaskOrderToStorage(
            "day",
            currentOrder.filter((taskId) => taskId !== id)
          );
          // Drop just this title from the active "working on" set rather
          // than clearing the whole set — multi-tasking users may have
          // other tasks selected they don't want wiped.
          let activeTitles: string[] = [];
          try {
            const raw = localStorage.getItem("currentTasks");
            if (raw) activeTitles = JSON.parse(raw) || [];
          } catch {
            /* fall through */
          }
          if (activeTitles.length === 0) {
            const legacy = localStorage.getItem("currentTask");
            if (legacy) activeTitles = [legacy];
          }
          if (activeTitles.includes(taskToMove.title)) {
            window.dispatchEvent(
              new CustomEvent("remove-current-task", {
                detail: { title: taskToMove.title },
              })
            );
          }
        }
      } else {
        const taskToMove = completedTasks.find((t) => t.id === id);
        if (taskToMove) {
          setCompletedTasks((prev) => prev.filter((t) => t.id !== id));
          const updatedTask = { ...taskToMove, ...updates };
          setActiveTasks((prev) => [...prev, updatedTask]);
          const currentOrder = getTaskOrderFromStorage("day") || [];
          saveTaskOrderToStorage("day", [
            id,
            ...currentOrder.filter((taskId) => taskId !== id),
          ]);
        }
      }

      api.updateTask(id, updates).catch((error) => {
        console.error("Failed to update task in database:", error);
        // Simplified rollback: just refetch
        fetchTasks();
      });
    } catch (error) {
      console.error("Failed to toggle task:", error);
    }
  }, [activeTasks, completedTasks]);

  const getTotalCount = () => {
    return activeTasks.length + completedTasks.length;
  };

  const handleUpdateTitle = async (id: string, newTitle: string) => {
    if (!newTitle.trim()) {
      setEditingTaskId(null);
      return;
    }

    const originalTask = [...activeTasks, ...completedTasks].find(
      (t) => t.id === id
    );
    if (!originalTask || originalTask.title === newTitle) {
      setEditingTaskId(null);
      return;
    }

    setActiveTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, title: newTitle } : t))
    );
    setCompletedTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, title: newTitle } : t))
    );
    setEditingTaskId(null);

    try {
      await api.updateTask(id, { title: newTitle });
    } catch (error) {
      console.error("Failed to update task title:", error);
      setActiveTasks((prev) =>
        prev.map((t) =>
          t.id === id ? { ...t, title: originalTask.title } : t
        )
      );
      setCompletedTasks((prev) =>
        prev.map((t) =>
          t.id === id ? { ...t, title: originalTask.title } : t
        )
      );
    }
  };

  const startEditing = useCallback((task: Task) => {
    setContextMenu(null);
    setEditingTaskId(task.id);
    setEditedTitle(task.title);
  }, []);

  const openContextMenu = (event: React.MouseEvent, task: Task) => {
    event.preventDefault();
    event.stopPropagation();
    setContextMenu({
      task,
      position: { x: event.clientX, y: event.clientY },
    });
  };

  const moveTaskFromMenu = (task: Task, type: TaskType) => {
    if (task.completed || task.type === type) return;
    setActiveTasks((current) => current.filter((item) => item.id !== task.id));
    const currentOrder = getTaskOrderFromStorage("day") || [];
    saveTaskOrderToStorage(
      "day",
      currentOrder.filter((taskId) => taskId !== task.id),
    );
    handleChangeTaskType(task.id, type).then((success) => {
      if (!success) fetchTasks();
    });
  };

  const deleteTaskFromMenu = (task: Task) => {
    setActiveTasks((current) => current.filter((item) => item.id !== task.id));
    setCompletedTasks((current) =>
      current.filter((item) => item.id !== task.id),
    );
    const currentOrder = getTaskOrderFromStorage("day") || [];
    saveTaskOrderToStorage(
      "day",
      currentOrder.filter((taskId) => taskId !== task.id),
    );
    handleDeleteTask(task.id).then((success) => {
      if (!success) fetchTasks();
    });
  };

  // Sync taskMode to DOM so Compass handler can check it
  useEffect(() => {
    if (taskMode) {
      document.body.dataset.taskMode = "true";
    } else {
      delete document.body.dataset.taskMode;
    }
    return () => {
      delete document.body.dataset.taskMode;
    };
  }, [taskMode]);

  // Exit task mode when editing starts or tasks shrink
  useEffect(() => {
    if (editingTaskId) {
      setTaskMode(false);
      setSelectedTaskIndex(null);
    }
  }, [editingTaskId]);

  useEffect(() => {
    if (taskMode && selectedTaskIndex !== null && selectedTaskIndex >= activeTasks.length) {
      setSelectedTaskIndex(null);
    }
  }, [activeTasks.length, taskMode, selectedTaskIndex]);

  // Task mode keyboard handler — capture phase so it runs before Compass signal handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Skip if in an input/textarea
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      // Skip when the working-on picker is open so number keys go to it.
      if (document.body.dataset.taskPickerOpen === "true") {
        return;
      }

      // 'e' key enters task mode (edit/select tasks)
      if (e.key.toLowerCase() === "e" && !e.metaKey && !e.ctrlKey && !e.altKey && !taskMode) {
        e.preventDefault();
        e.stopPropagation();
        setTaskMode(true);
        setSelectedTaskIndex(null);
        return;
      }

      // Everything below only when task mode is active
      if (!taskMode) return;

      // Escape exits task mode
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        setTaskMode(false);
        setSelectedTaskIndex(null);
        return;
      }

      // Number keys select a task (1-9, 0=10th)
      const keyNum = parseInt(e.key);
      if (!isNaN(keyNum) && keyNum >= 0 && keyNum <= 9) {
        e.preventDefault();
        e.stopPropagation();
        const index = keyNum === 0 ? 9 : keyNum - 1;
        if (index < activeTasks.length) {
          setSelectedTaskIndex(index);
        }
        return;
      }

      // Actions on selected task
      if (selectedTaskIndex !== null && selectedTaskIndex < activeTasks.length) {
        const task = activeTasks[selectedTaskIndex];

        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          e.stopPropagation();
          handleToggleComplete(task.id);
          setSelectedTaskIndex(null);
          // Stay in task mode for rapid checking
          return;
        }

        if (e.key === "e" || e.key === "E") {
          e.preventDefault();
          e.stopPropagation();
          startEditing(task);
          // editingTaskId change will auto-exit task mode via the useEffect above
          return;
        }

        if (e.key === "d" || e.key === "D") {
          e.preventDefault();
          e.stopPropagation();
          setActiveTasks((prev) => prev.filter((t) => t.id !== task.id));
          const currentOrder = getTaskOrderFromStorage("day") || [];
          saveTaskOrderToStorage("day", currentOrder.filter((taskId) => taskId !== task.id));
          setSelectedTaskIndex(null);
          handleDeleteTask(task.id).catch(() => fetchTasks());
          return;
        }

        if (e.key === "w" || e.key === "W") {
          e.preventDefault();
          e.stopPropagation();
          setActiveTasks((prev) => prev.filter((t) => t.id !== task.id));
          const currentOrder = getTaskOrderFromStorage("day") || [];
          saveTaskOrderToStorage("day", currentOrder.filter((taskId) => taskId !== task.id));
          setSelectedTaskIndex(null);
          handleChangeTaskType(task.id, "week").catch(() => fetchTasks());
          return;
        }
      }

      // Stop propagation for any key in task mode so global shortcuts don't fire
      e.stopPropagation();
    };

    window.addEventListener("keydown", handleKeyDown, true); // capture phase
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [taskMode, selectedTaskIndex, activeTasks, handleToggleComplete, startEditing]);

  // Drag and Drop
  const handleDragEnd = (result: DropResult) => {
    const { source, destination } = result;
    if (
      !destination ||
      (destination.droppableId === source.droppableId &&
        destination.index === source.index)
    ) {
      return;
    }
    if (destination.droppableId !== "daily-active-tasks") return;

    const items = Array.from(activeTasks);
    const [reorderedItem] = items.splice(source.index, 1);
    items.splice(destination.index, 0, reorderedItem);
    setActiveTasks(items);
    saveTaskOrderToStorage("day", items.map((task) => task.id));
  };

  // Number label: 1-9, then 0 for 10th
  const getNumberLabel = (index: number): string | null => {
    if (index < 9) return String(index + 1);
    if (index === 9) return "0";
    return null;
  };

  if (isLoading) {
    return (
      <div className="rounded-lg border border-gray-200 dark:border-gray-800 overflow-hidden flex flex-col h-full">
        <div className="card-header border-b border-gray-200 dark:border-gray-800 px-5 py-3 flex items-center justify-between shrink-0">
          <h2 className="text-sm font-medium text-gray-900 dark:text-white">
            Tasks
          </h2>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            Loading...
          </span>
        </div>
        <div className="p-4 bg-white dark:bg-gray-900 flex-1">
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-7 bg-gray-100 dark:bg-gray-800 rounded-md animate-pulse"
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (activeTasks.length === 0 && completedTasks.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 dark:border-gray-800 overflow-hidden flex flex-col h-full">
        <div className="card-header border-b border-gray-200 dark:border-gray-800 px-5 py-3 flex items-center justify-between shrink-0">
          <h2 className="text-sm font-medium text-gray-900 dark:text-white">
            Tasks
          </h2>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            0 tasks
          </span>
        </div>
        <div className="p-4 bg-white dark:bg-gray-900 text-center text-sm text-gray-500 dark:text-gray-400 flex-1">
          No tasks yet
        </div>
      </div>
    );
  }

  const CompletedCheckbox = () => (
    <div className="w-3.5 h-3.5 shrink-0 rounded flex items-center justify-center cursor-pointer border border-gray-900 dark:border-white bg-gray-900 dark:bg-white">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className="h-2.5 w-2.5 text-white dark:text-gray-900"
        viewBox="0 0 20 20"
        fill="currentColor"
      >
        <path
          fillRule="evenodd"
          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
          clipRule="evenodd"
        />
      </svg>
    </div>
  );

  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-800 overflow-hidden flex flex-col h-full">
      <div className="card-header border-b border-gray-200 dark:border-gray-800 px-5 py-3 flex items-center justify-between shrink-0">
        <h2 className="text-sm font-medium text-gray-900 dark:text-white">
          Tasks
        </h2>
        <div className="flex items-center gap-2">
          {taskMode && (
            <span className="text-[10px] font-medium text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 px-1.5 py-0.5 rounded">
              SELECT
            </span>
          )}
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {getTotalCount()} task{getTotalCount() !== 1 ? "s" : ""}
          </span>
        </div>
      </div>
      <div className="p-4 bg-white dark:bg-gray-900 flex-1 min-h-0 overflow-hidden">
        <DragDropContext onDragEnd={handleDragEnd}>
          <div className="space-y-2 h-full overflow-y-auto overflow-x-hidden scrollbar-hide">
            <Droppable droppableId="daily-active-tasks">
              {(provided) => (
                <div
                  {...provided.droppableProps}
                  ref={provided.innerRef}
                  className="space-y-2"
                >
                  {activeTasks.map((task, index) => {
                    const numLabel = getNumberLabel(index);
                    const isSelected = taskMode && selectedTaskIndex === index;

                    return (
                      <Draggable
                        key={task.id}
                        draggableId={task.id}
                        index={index}
                      >
                        {(provided, snapshot) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            {...provided.dragHandleProps}
                            onContextMenu={(event) =>
                              openContextMenu(event, task)
                            }
                            className={`flex items-center gap-3 py-1 rounded-sm px-1 -mx-1 transition-colors ${
                              snapshot.isDragging
                                ? "bg-gray-200 dark:bg-gray-700 rounded shadow-md"
                                : isSelected
                                ? "bg-indigo-50 dark:bg-indigo-900/20 ring-1 ring-indigo-300 dark:ring-indigo-700"
                                : ""
                            }`}
                          >
                            {/* Number badge in task mode, checkbox otherwise */}
                            {taskMode && numLabel ? (
                              <span
                                className={`w-3.5 h-3.5 shrink-0 rounded flex items-center justify-center text-[10px] font-bold leading-none ${
                                  isSelected
                                    ? "bg-indigo-500 text-white"
                                    : "bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300"
                                }`}
                              >
                                {numLabel}
                              </span>
                            ) : taskMode && !numLabel ? (
                              <div className="w-3.5 h-3.5 shrink-0" />
                            ) : (
                              <div
                                onClick={() => handleToggleComplete(task.id)}
                                className="w-3.5 h-3.5 shrink-0 rounded flex items-center justify-center cursor-pointer border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800"
                              />
                            )}

                            {editingTaskId === task.id ? (
                              <input
                                type="text"
                                value={editedTitle}
                                onChange={(e) => setEditedTitle(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") {
                                    handleUpdateTitle(task.id, editedTitle);
                                  } else if (e.key === "Escape") {
                                    setEditingTaskId(null);
                                  }
                                }}
                                onBlur={() =>
                                  handleUpdateTitle(task.id, editedTitle)
                                }
                                className="flex-1 text-sm text-gray-800 dark:text-gray-200 bg-transparent border-b border-gray-300 dark:border-gray-600 focus:outline-none focus:border-gray-500 dark:focus:border-gray-400"
                                autoFocus
                              />
                            ) : (
                              <span
                                onClick={() => startEditing(task)}
                                className="text-sm text-gray-800 dark:text-gray-200 truncate cursor-text"
                              >
                                <LinkifiedTaskText text={task.title} />
                              </span>
                            )}

                            {/* Action hints when task is selected */}
                            {isSelected && (
                              <div className="flex items-center gap-1 shrink-0 ml-auto">
                                <kbd className="px-1 py-0.5 text-[9px] font-mono rounded bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-600">
                                  ↵
                                </kbd>
                                <kbd className="px-1 py-0.5 text-[9px] font-mono rounded bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-600">
                                  e
                                </kbd>
                                <kbd className="px-1 py-0.5 text-[9px] font-mono rounded bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-700">
                                  w
                                </kbd>
                                <kbd className="px-1 py-0.5 text-[9px] font-mono rounded bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-700">
                                  d
                                </kbd>
                              </div>
                            )}
                          </div>
                        )}
                      </Draggable>
                    );
                  })}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>

            {completedTasks.length > 0 && activeTasks.length > 0 && (
              <hr className="border-gray-200 dark:border-gray-700 my-2" />
            )}
            {completedTasks.map((task) => (
              <div
                key={task.id}
                onContextMenu={(event) => openContextMenu(event, task)}
                className="flex items-center gap-3 py-1"
              >
                <div onClick={() => handleToggleComplete(task.id)}>
                  <CompletedCheckbox />
                </div>
                {editingTaskId === task.id ? (
                  <input
                    type="text"
                    value={editedTitle}
                    onChange={(e) => setEditedTitle(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        handleUpdateTitle(task.id, editedTitle);
                      } else if (e.key === "Escape") {
                        setEditingTaskId(null);
                      }
                    }}
                    onBlur={() => handleUpdateTitle(task.id, editedTitle)}
                    className="flex-1 text-sm text-gray-500 dark:text-gray-400 bg-transparent border-b border-gray-300 dark:border-gray-600 focus:outline-none focus:border-gray-500 dark:focus:border-gray-400"
                    autoFocus
                  />
                ) : (
                  <span
                    onClick={() => startEditing(task)}
                    className="text-sm text-gray-500 dark:text-gray-400 truncate cursor-text"
                  >
                    <LinkifiedTaskText text={task.title} />
                  </span>
                )}
              </div>
            ))}
          </div>
        </DragDropContext>
      </div>
      {contextMenu && (
        <TaskContextMenu
          task={contextMenu.task}
          position={contextMenu.position}
          onClose={() => setContextMenu(null)}
          onToggleComplete={(task) => handleToggleComplete(task.id)}
          onEdit={startEditing}
          onMove={moveTaskFromMenu}
          onDelete={deleteTaskFromMenu}
        />
      )}
    </div>
  );
};

export default DailyTasks;
