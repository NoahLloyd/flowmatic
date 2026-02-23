import React, { useState, useEffect } from "react";
import { Task, TaskType } from "../../types/Task";
import { api } from "../../utils/api";
import { useNavigation } from "../../hooks/useNavigation";
import {
  DragDropContext,
  Droppable,
  Draggable,
  DropResult,
} from "react-beautiful-dnd";
import { subscribeToTaskAdded } from "../../utils/taskEvents";

const BlockedTasks: React.FC = () => {
  const [activeTasks, setActiveTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { selected } = useNavigation();
  
  // Editing state
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editedTitle, setEditedTitle] = useState("");

  // Function to get task order from localStorage for a specific type
  const getTaskOrderFromStorage = (type: TaskType): string[] | null => {
    const storedOrder = localStorage.getItem(`taskOrder_${type}`);
    return storedOrder ? JSON.parse(storedOrder) : null;
  };

  // Function to save task order to localStorage for a specific type
  const saveTaskOrderToStorage = (type: TaskType, order: string[]): void => {
    localStorage.setItem(`taskOrder_${type}`, JSON.stringify(order));
  };

  // Fetch blocked tasks
  const fetchTasks = async () => {
    try {
      setIsLoading(true);
      const allTasks = await api.getTasksByType("blocked");

      // Filter active blocked tasks (already filtered by type server-side)
      let active = allTasks.filter(
        (task) => !task.completed
      );

      // Apply stored order
      const taskOrderBlocked = getTaskOrderFromStorage("blocked");
      if (taskOrderBlocked) {
        active = active.sort((a, b) => {
          const indexA = taskOrderBlocked.indexOf(a.id);
          const indexB = taskOrderBlocked.indexOf(b.id);
          if (indexA === -1 && indexB === -1) return 0;
          if (indexA === -1) return 1;
          if (indexB === -1) return -1;
          return indexA - indexB;
        });
      }

      setActiveTasks(active);
    } catch (error) {
      console.error("Failed to fetch blocked tasks:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Initial fetch on component mount
  useEffect(() => {
    fetchTasks();
  }, []);

  // Refetch tasks when navigating back to the Compass page
  useEffect(() => {
    if (selected === "Compass") {
      fetchTasks();
    }
  }, [selected]);

  // Listen for tasks added via quick add modals
  useEffect(() => {
    const unsubscribe = subscribeToTaskAdded((newTask) => {
      // Only add if it's a blocked task
      if (newTask.type === "blocked" && !newTask.completed) {
        setActiveTasks((prev) => {
          // Check if task already exists (avoid duplicates)
          if (prev.some((t) => t.id === newTask.id)) {
            return prev;
          }
          return [newTask, ...prev];
        });
        // Add to stored order
        const currentOrder = getTaskOrderFromStorage("blocked") || [];
        if (!currentOrder.includes(newTask.id)) {
          saveTaskOrderToStorage("blocked", [newTask.id, ...currentOrder]);
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

      // Optimistically update the UI
      setActiveTasks((prev) => prev.filter((t) => t.id !== id));
      
      // Remove from stored order
      const currentOrder = getTaskOrderFromStorage("blocked") || [];
      saveTaskOrderToStorage(
        "blocked",
        currentOrder.filter((taskId) => taskId !== id)
      );

      // Then update in the database
      api.updateTask(id, updates).catch((error) => {
        console.error("Failed to update task in database:", error);
        // If the API call fails, revert the optimistic update
        setActiveTasks((prev) => [...prev, task]);
      });
    } catch (error) {
      console.error("Failed to toggle task:", error);
    }
  };

  // Handle updating task title
  const handleUpdateTitle = async (id: string, newTitle: string) => {
    if (!newTitle.trim()) {
      setEditingTaskId(null);
      return;
    }

    const originalTask = activeTasks.find(t => t.id === id);
    if (!originalTask || originalTask.title === newTitle) {
      setEditingTaskId(null);
      return;
    }

    // Optimistic update
    setActiveTasks(prev => prev.map(t => t.id === id ? { ...t, title: newTitle } : t));
    setEditingTaskId(null);

    try {
      await api.updateTask(id, { title: newTitle });
    } catch (error) {
      console.error("Failed to update task title:", error);
      // Rollback on failure
      setActiveTasks(prev => prev.map(t => t.id === id ? { ...t, title: originalTask.title } : t));
    }
  };

  const startEditing = (task: Task) => {
    setEditingTaskId(task.id);
    setEditedTitle(task.title);
  };

  // Drag and Drop Handler
  const handleDragEnd = (result: DropResult) => {
    const { source, destination } = result;

    // Dropped outside the list or no movement
    if (
      !destination ||
      (destination.droppableId === source.droppableId &&
        destination.index === source.index)
    ) {
      return;
    }

    // Ensure drop happened within the blocked list
    if (destination.droppableId !== "blocked-active-tasks") {
      return;
    }

    // Reorder the activeTasks list
    const items = Array.from(activeTasks);
    const [reorderedItem] = items.splice(source.index, 1);
    items.splice(destination.index, 0, reorderedItem);

    // Update the state
    setActiveTasks(items);

    // Save the new order to localStorage
    const newOrder = items.map((task) => task.id);
    saveTaskOrderToStorage("blocked", newOrder);
  };

  if (isLoading) {
    return (
      <div className="rounded-lg border border-gray-200 dark:border-gray-800 overflow-hidden h-full flex flex-col">
        <div className="border-b border-gray-200 dark:border-gray-800 px-5 py-3 flex items-center justify-between shrink-0">
          <h2 className="text-sm font-medium text-gray-900 dark:text-white">
            Blocked
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

  if (activeTasks.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 dark:border-gray-800 overflow-hidden h-full flex flex-col">
        <div className="border-b border-gray-200 dark:border-gray-800 px-5 py-3 flex items-center justify-between shrink-0">
          <h2 className="text-sm font-medium text-gray-900 dark:text-white">
            Blocked
          </h2>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            0 tasks
          </span>
        </div>
        <div className="p-4 bg-white dark:bg-gray-900 text-center text-sm text-gray-500 dark:text-gray-400 flex-1">
          No blocked tasks
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-800 overflow-hidden h-full flex flex-col">
      <div className="border-b border-gray-200 dark:border-gray-800 px-5 py-3 flex items-center justify-between shrink-0">
        <h2 className="text-sm font-medium text-gray-900 dark:text-white">
          Blocked
        </h2>
        <span className="text-xs text-gray-500 dark:text-gray-400">
          {activeTasks.length} task{activeTasks.length !== 1 ? "s" : ""}
        </span>
      </div>
      <div className="p-4 bg-white dark:bg-gray-900 flex-1 min-h-0 overflow-hidden">
        <DragDropContext onDragEnd={handleDragEnd}>
          <div className="space-y-2 h-full overflow-y-auto">
            <Droppable droppableId="blocked-active-tasks">
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
                              onBlur={() => handleUpdateTitle(task.id, editedTitle)}
                              className="flex-1 text-sm text-gray-800 dark:text-gray-200 bg-transparent border-b border-gray-300 dark:border-gray-600 focus:outline-none focus:border-gray-500 dark:focus:border-gray-400"
                              autoFocus
                            />
                          ) : (
                            <span
                              onClick={() => startEditing(task)}
                              className="text-sm text-gray-800 dark:text-gray-200 truncate cursor-text"
                            >
                              {task.title}
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

export default BlockedTasks;

