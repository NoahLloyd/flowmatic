import React, { useState, useEffect } from "react";
import { Task, TaskType } from "../../types/Task";
import { api } from "../../utils/api";
import { useNavigation } from "../../hooks/useNavigation";
import {
  DragDropContext,
  Droppable,
  Draggable,
  DropResult,
} from "@hello-pangea/dnd";
import { subscribeToTaskAdded } from "../../utils/taskEvents";
import LinkifiedTaskText from "../../components/task/LinkifiedTaskText";

// CompassWeekTasks is the "This week" companion list in the Dayflow Compass
// variant. It's the BlockedTasks pattern pointed at the "week" task type, with
// the in-card header dropped (CompassDayflow renders its own column label). It
// stays self-contained so the classic Compass and its BlockedTasks are untouched.

const CompassWeekTasks: React.FC = () => {
  const [activeTasks, setActiveTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { selected } = useNavigation();

  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editedTitle, setEditedTitle] = useState("");

  const getTaskOrderFromStorage = (type: TaskType): string[] | null => {
    const storedOrder = localStorage.getItem(`taskOrder_${type}`);
    return storedOrder ? JSON.parse(storedOrder) : null;
  };

  const saveTaskOrderToStorage = (type: TaskType, order: string[]): void => {
    localStorage.setItem(`taskOrder_${type}`, JSON.stringify(order));
  };

  const fetchTasks = async () => {
    try {
      setIsLoading(true);
      const allTasks = await api.getTasksByType("week");

      let active = allTasks.filter((task) => !task.completed);

      const taskOrderWeek = getTaskOrderFromStorage("week");
      if (taskOrderWeek) {
        active = active.sort((a, b) => {
          const indexA = taskOrderWeek.indexOf(a.id);
          const indexB = taskOrderWeek.indexOf(b.id);
          if (indexA === -1 && indexB === -1) return 0;
          if (indexA === -1) return 1;
          if (indexB === -1) return -1;
          return indexA - indexB;
        });
      }

      setActiveTasks(active);
    } catch (error) {
      console.error("Failed to fetch week tasks:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, []);

  // Refetch when returning to the Compass page (the Dayflow variant is still
  // the "Compass" route).
  useEffect(() => {
    if (selected === "Compass") {
      fetchTasks();
    }
  }, [selected]);

  useEffect(() => {
    const unsubscribe = subscribeToTaskAdded((newTask) => {
      if (newTask.type === "week" && !newTask.completed) {
        setActiveTasks((prev) => {
          if (prev.some((t) => t.id === newTask.id)) {
            return prev;
          }
          return [newTask, ...prev];
        });
        const currentOrder = getTaskOrderFromStorage("week") || [];
        if (!currentOrder.includes(newTask.id)) {
          saveTaskOrderToStorage("week", [newTask.id, ...currentOrder]);
        }
      }
    });

    return unsubscribe;
  }, []);

  const handleToggleComplete = async (id: string) => {
    try {
      const task = activeTasks.find((t) => t.id === id);
      if (!task) return;

      const updates = {
        completed: true,
        completedAt: new Date(),
      };

      setActiveTasks((prev) => prev.filter((t) => t.id !== id));

      const currentOrder = getTaskOrderFromStorage("week") || [];
      saveTaskOrderToStorage(
        "week",
        currentOrder.filter((taskId) => taskId !== id),
      );

      api.updateTask(id, updates).catch((error) => {
        console.error("Failed to update task in database:", error);
        setActiveTasks((prev) => [...prev, task]);
      });
    } catch (error) {
      console.error("Failed to toggle task:", error);
    }
  };

  const handleUpdateTitle = async (id: string, newTitle: string) => {
    if (!newTitle.trim()) {
      setEditingTaskId(null);
      return;
    }

    const originalTask = activeTasks.find((t) => t.id === id);
    if (!originalTask || originalTask.title === newTitle) {
      setEditingTaskId(null);
      return;
    }

    setActiveTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, title: newTitle } : t)),
    );
    setEditingTaskId(null);

    try {
      await api.updateTask(id, { title: newTitle });
    } catch (error) {
      console.error("Failed to update task title:", error);
      setActiveTasks((prev) =>
        prev.map((t) =>
          t.id === id ? { ...t, title: originalTask.title } : t,
        ),
      );
    }
  };

  const startEditing = (task: Task) => {
    setEditingTaskId(task.id);
    setEditedTitle(task.title);
  };

  const handleDragEnd = (result: DropResult) => {
    const { source, destination } = result;

    if (
      !destination ||
      (destination.droppableId === source.droppableId &&
        destination.index === source.index)
    ) {
      return;
    }

    if (destination.droppableId !== "week-active-tasks") {
      return;
    }

    const items = Array.from(activeTasks);
    const [reorderedItem] = items.splice(source.index, 1);
    items.splice(destination.index, 0, reorderedItem);

    setActiveTasks(items);

    const newOrder = items.map((task) => task.id);
    saveTaskOrderToStorage("week", newOrder);
  };

  if (isLoading) {
    return (
      <div className="rounded-lg border border-gray-200 dark:border-gray-800 overflow-hidden h-full flex flex-col">
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

  if (activeTasks.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 dark:border-gray-800 overflow-hidden h-full flex flex-col">
        <div className="p-4 bg-white dark:bg-gray-900 text-center text-sm text-gray-500 dark:text-gray-400 flex-1">
          Nothing this week
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-800 overflow-hidden h-full flex flex-col">
      <div className="p-4 bg-white dark:bg-gray-900 flex-1 min-h-0 overflow-hidden">
        <DragDropContext onDragEnd={handleDragEnd}>
          <div className="space-y-2 h-full overflow-y-auto">
            <Droppable droppableId="week-active-tasks">
              {(provided, snapshot) => (
                <div
                  {...provided.droppableProps}
                  ref={provided.innerRef}
                  className={`space-y-2 ${
                    snapshot.isDraggingOver
                      ? "bg-gray-100 dark:bg-gray-800/50 rounded-md p-1"
                      : ""
                  }`}
                >
                  {activeTasks.map((task, index) => (
                    <Draggable key={task.id} draggableId={task.id} index={index}>
                      {(provided, snapshot) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          {...provided.dragHandleProps}
                          className={`flex items-center gap-3 py-1 ${
                            snapshot.isDragging
                              ? "bg-gray-200 dark:bg-gray-700 rounded shadow-md"
                              : ""
                          }`}
                        >
                          <div
                            onClick={() => handleToggleComplete(task.id)}
                            className="w-3.5 h-3.5 shrink-0 rounded flex items-center justify-center cursor-pointer border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800"
                          />
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
                        </div>
                      )}
                    </Draggable>
                  ))}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </div>
        </DragDropContext>
      </div>
    </div>
  );
};

export default CompassWeekTasks;
