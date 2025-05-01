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

const DailyTasks: React.FC = () => {
  const [activeTasks, setActiveTasks] = useState<Task[]>([]);
  const [completedTasks, setCompletedTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { selected, setSelected } = useNavigation();

  // Improved helper to check if a date is today (more robust)
  const isToday = (dateInput: Date | string | null) => {
    if (!dateInput) return false;

    const date = new Date(dateInput);
    const today = new Date();

    // Check if date is valid
    if (isNaN(date.getTime())) return false;

    return (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    );
  };

  // Function to get task order from localStorage for a specific type
  const getTaskOrderFromStorage = (type: TaskType): string[] | null => {
    const storedOrder = localStorage.getItem(`taskOrder_${type}`);
    return storedOrder ? JSON.parse(storedOrder) : null;
  };

  // Function to save task order to localStorage for a specific type
  const saveTaskOrderToStorage = (type: TaskType, order: string[]): void => {
    localStorage.setItem(`taskOrder_${type}`, JSON.stringify(order));
  };

  // Fetch daily tasks
  const fetchTasks = async () => {
    try {
      setIsLoading(true);
      const allTasks = await api.getUserTasks();

      console.log("All tasks loaded:", allTasks.length);

      // Filter active daily tasks
      let active = allTasks.filter(
        (task) => task.type === "day" && !task.completed
      );

      // Apply stored order
      const taskOrderDay = getTaskOrderFromStorage("day");
      if (taskOrderDay) {
        active = active.sort((a, b) => {
          const indexA = taskOrderDay.indexOf(a._id);
          const indexB = taskOrderDay.indexOf(b._id);
          if (indexA === -1 && indexB === -1) return 0;
          if (indexA === -1) return 1;
          if (indexB === -1) return -1;
          return indexA - indexB;
        });
      }

      console.log("Active daily tasks (sorted):", active.length);

      // Filter completed tasks from today - with improved handling
      const completed = allTasks.filter((task) => {
        const isCompletedToday =
          task.type === "day" && task.completed && isToday(task.completedAt);

        if (task.completed && task.type === "day") {
          console.log(
            "Completed task:",
            task.title,
            "completedAt:",
            task.completedAt,
            "isToday:",
            isToday(task.completedAt)
          );
        }

        return isCompletedToday;
      });

      console.log("Completed today tasks:", completed.length);

      setActiveTasks(active);
      setCompletedTasks(completed);
    } catch (error) {
      console.error("Failed to fetch daily tasks:", error);
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

  const handleToggleComplete = async (id: string) => {
    try {
      // Find the task in either active or completed arrays
      const task = [...activeTasks, ...completedTasks].find(
        (t) => t._id === id
      );
      if (!task) return;

      const updates = {
        completed: !task.completed,
        completedAt: !task.completed ? new Date() : null,
      };

      // Optimistically update the UI first
      if (updates.completed) {
        // Task was marked complete
        const taskToMove = activeTasks.find((t) => t._id === id);
        if (taskToMove) {
          setActiveTasks((prev) => prev.filter((t) => t._id !== id));
          setCompletedTasks((prev) => [...prev, { ...taskToMove, ...updates }]);
          // Remove from stored order
          const currentOrder = getTaskOrderFromStorage("day") || [];
          saveTaskOrderToStorage(
            "day",
            currentOrder.filter((taskId) => taskId !== id)
          );
        }
      } else {
        // Task was unmarked (moved back to active)
        const taskToMove = completedTasks.find((t) => t._id === id);
        if (taskToMove) {
          setCompletedTasks((prev) => prev.filter((t) => t._id !== id));
          const updatedTask = { ...taskToMove, ...updates };
          setActiveTasks((prev) => [...prev, updatedTask]); // Add to end for now, order applied on next fetch or drag
          // Add back to the beginning of the stored order
          const currentOrder = getTaskOrderFromStorage("day") || [];
          saveTaskOrderToStorage("day", [
            id,
            ...currentOrder.filter((taskId) => taskId !== id),
          ]); // Ensure no duplicates
        }
      }

      // Then update in the database
      api
        .updateTask(id, updates)
        .then(() => {
          // After successful update, refresh tasks to ensure everything is in sync
          // This helps capture other changes that might have happened
          // fetchTasks(); // REMOVED: Rely on optimistic update
        })
        .catch((error) => {
          console.error("Failed to update task in database:", error);
          // If the API call fails, revert the optimistic update
          if (updates.completed) {
            // Revert completed task back to active
            const taskToRevert = completedTasks.find((t) => t._id === id);
            if (taskToRevert) {
              setCompletedTasks((prev) => prev.filter((t) => t._id !== id));
              setActiveTasks((prev) => [
                ...prev,
                { ...taskToRevert, completed: false, completedAt: null },
              ]);
            }
          } else {
            // Revert active task back to completed
            const taskToRevert = activeTasks.find((t) => t._id === id);
            if (taskToRevert) {
              setActiveTasks((prev) => prev.filter((t) => t._id !== id));
              setCompletedTasks((prev) => [
                ...prev,
                {
                  ...taskToRevert,
                  completed: true,
                  completedAt: task.completedAt,
                },
              ]);
            }
          }
        });
    } catch (error) {
      console.error("Failed to toggle task:", error);
    }
  };

  const getTotalCount = () => {
    return activeTasks.length + completedTasks.length;
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

    // Ensure drop happened within the active list
    if (destination.droppableId !== "daily-active-tasks") {
      console.warn("Drag and drop outside the active list is not supported.");
      return;
    }

    // Reorder the activeTasks list
    const items = Array.from(activeTasks);
    const [reorderedItem] = items.splice(source.index, 1);
    items.splice(destination.index, 0, reorderedItem);

    // Update the state
    setActiveTasks(items);

    // Save the new order to localStorage
    const newOrder = items.map((task) => task._id);
    saveTaskOrderToStorage("day", newOrder);
  };

  if (isLoading) {
    return (
      <div className="rounded-lg border border-gray-200 dark:border-gray-800 overflow-hidden">
        <div className="border-b border-gray-200 dark:border-gray-800 px-5 py-3 flex items-center justify-between">
          <h2 className="text-sm font-medium text-gray-900 dark:text-white">
            Tasks
          </h2>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            Loading...
          </span>
        </div>
        <div className="p-4 bg-white dark:bg-gray-900">
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
      <div className="rounded-lg border border-gray-200 dark:border-gray-800 overflow-hidden">
        <div className="border-b border-gray-200 dark:border-gray-800 px-5 py-3 flex items-center justify-between">
          <h2 className="text-sm font-medium text-gray-900 dark:text-white">
            Tasks
          </h2>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            0 tasks
          </span>
        </div>
        <div className="p-4 bg-white dark:bg-gray-900 text-center text-sm text-gray-500 dark:text-gray-400">
          No tasks yet
        </div>
      </div>
    );
  }

  // Custom checkbox for completed task
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
    <div className="rounded-lg border border-gray-200 dark:border-gray-800 overflow-hidden">
      <div className="border-b border-gray-200 dark:border-gray-800 px-5 py-3 flex items-center justify-between">
        <h2 className="text-sm font-medium text-gray-900 dark:text-white">
          Tasks
        </h2>
        <span className="text-xs text-gray-500 dark:text-gray-400">
          {getTotalCount()} task{getTotalCount() !== 1 ? "s" : ""}
        </span>
      </div>
      <div className="p-4 bg-white dark:bg-gray-900">
        <DragDropContext onDragEnd={handleDragEnd}>
          <div className="space-y-2 max-h-[179px] overflow-y-auto">
            <Droppable droppableId="daily-active-tasks">
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
                      key={task._id}
                      draggableId={task._id}
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
                            onClick={() => handleToggleComplete(task._id)}
                            className="w-3.5 h-3.5 shrink-0 rounded flex items-center justify-center cursor-pointer border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800"
                          />
                          <span className="text-sm text-gray-800 dark:text-gray-200 truncate">
                            {task.title}
                          </span>
                        </div>
                      )}
                    </Draggable>
                  ))}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>

            {completedTasks.length > 0 && activeTasks.length > 0 && (
              <hr className="border-gray-200 dark:border-gray-700 my-2" />
            )}
            {completedTasks.map((task) => (
              <div key={task._id} className="flex items-center gap-3 py-1">
                <div onClick={() => handleToggleComplete(task._id)}>
                  <CompletedCheckbox />
                </div>
                <span className="text-sm text-gray-500 dark:text-gray-400 truncate">
                  {task.title}
                </span>
              </div>
            ))}
          </div>
        </DragDropContext>
      </div>
    </div>
  );
};

export default DailyTasks;
