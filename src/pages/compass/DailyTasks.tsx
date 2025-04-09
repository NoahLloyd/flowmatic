import React, { useState, useEffect } from "react";
import { Task } from "../../types/Task";
import { api } from "../../utils/api";
import { useNavigation } from "../../hooks/useNavigation";

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

  // Fetch daily tasks
  const fetchTasks = async () => {
    try {
      setIsLoading(true);
      const allTasks = await api.getUserTasks();

      console.log("All tasks loaded:", allTasks.length);

      // Filter active daily tasks
      const active = allTasks.filter(
        (task) => task.type === "day" && !task.completed
      );

      console.log("Active daily tasks:", active.length);

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
        }
      } else {
        // Task was unmarked (moved back to active)
        const taskToMove = completedTasks.find((t) => t._id === id);
        if (taskToMove) {
          setCompletedTasks((prev) => prev.filter((t) => t._id !== id));
          setActiveTasks((prev) => [...prev, { ...taskToMove, ...updates }]);
        }
      }

      // Then update in the database
      api
        .updateTask(id, updates)
        .then(() => {
          // After successful update, refresh tasks to ensure everything is in sync
          // This helps capture other changes that might have happened
          fetchTasks();
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
        <div className="space-y-2 max-h-40 overflow-y-auto">
          {/* Active tasks */}
          {activeTasks.map((task) => (
            <div key={task._id} className="flex items-center gap-3 py-1">
              <div
                onClick={() => handleToggleComplete(task._id)}
                className="w-3.5 h-3.5 shrink-0 rounded flex items-center justify-center cursor-pointer border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800"
              />
              <span className="text-sm text-gray-800 dark:text-gray-200 truncate">
                {task.title}
              </span>
            </div>
          ))}

          {/* Completed tasks */}
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
      </div>
    </div>
  );
};

export default DailyTasks;
