import React, { useState, useRef, useEffect, useCallback } from "react";
import { Task, TaskType } from "../../types/Task";
import TaskList from "./TaskList";
import AddTaskForm from "./AddTaskForm";
import TaskTypeSelector from "./TaskTypeSelector";
import CompletedTasks from "./CompletedTasks";
import { api } from "../../utils/api";
import { useNavigation } from "../../hooks/useNavigation";

/**
 * Ideal API Endpoints for Tasks:
 *
 * 1. GET /tasks
 *    - Fetch all active tasks and limited completed tasks (e.g., 50 most recent)
 *    - Query params: completedLimit (number of completed tasks to return)
 *
 * 2. GET /tasks/completed
 *    - Fetch only completed tasks with pagination
 *    - Query params:
 *      - page (page number)
 *      - limit (items per page)
 *      - sort (asc/desc by completedAt)
 *      - type (filter by task type: day/week/future)
 *      - search (search term for titles)
 *
 * 3. GET /tasks/active
 *    - Fetch only active tasks with filtering
 *    - Query params:
 *      - type (day/week/future)
 *      - search (search term for titles)
 *
 * These endpoints would drastically reduce data transfer and improve performance
 * especially for users with many completed tasks.
 */

// Function to fetch tasks with optional limit for completed tasks
const fetchTasks = async (fetchAll = false): Promise<Task[]> => {
  try {
    // For now, we'll always fetch all tasks from the backend
    // and handle filtering on the client side
    const allTasks = await api.getUserTasks();

    // If fetchAll is true, return all tasks
    if (fetchAll) {
      return allTasks;
    }

    // Otherwise, return all active tasks and only the 50 most recent completed tasks
    const activeTasks = allTasks.filter((task) => !task.completed);
    const completedTasks = allTasks
      .filter((task) => task.completed)
      .sort((a, b) => {
        const bTime =
          b.completedAt instanceof Date ? b.completedAt.getTime() : 0;
        const aTime =
          a.completedAt instanceof Date ? a.completedAt.getTime() : 0;
        return bTime - aTime;
      })
      .slice(0, 50);

    return [...activeTasks, ...completedTasks];
  } catch (error) {
    console.error("Error fetching tasks:", error);
    return [];
  }
};

interface TasksProps {
  onAddTask: (title: string, type: TaskType) => void;
  onToggleComplete: (id: string) => void;
  onDelete: (id: string) => void;
  onChangeTaskType: (id: string, newType: TaskType) => void;
  onUpdateTitle: (id: string, title: string) => void;
}

const Tasks: React.FC<TasksProps> = ({
  onAddTask,
  onToggleComplete,
  onDelete,
  onChangeTaskType,
  onUpdateTitle,
}) => {
  // Navigation state to detect when the Tasks page is opened
  const { selected } = useNavigation();

  // Task state
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedType, setSelectedType] = useState<TaskType>("day");

  // Search state
  const [activeSearchQuery, setActiveSearchQuery] = useState("");
  const [completedSearchQuery, setCompletedSearchQuery] = useState("");

  // Completed tasks display state
  const [completedSortDesc, setCompletedSortDesc] = useState(true);
  const [completedFilter, setCompletedFilter] = useState<TaskType | "all">(
    "all"
  );
  const [loadAllCompleted, setLoadAllCompleted] = useState(false);
  const completedListRef = useRef<HTMLDivElement>(null);
  const [tasksLoaded, setTasksLoaded] = useState(false);

  // Use this to track when to reload tasks
  const [actionCounter, setActionCounter] = useState(0);
  const incrementActionCounter = () => setActionCounter((prev) => prev + 1);

  // Fetch tasks with limits for completed tasks - only for initial load and explicit refreshes
  const loadTasks = useCallback(async (fetchAll = false) => {
    setIsLoading(true);
    try {
      console.log("Loading tasks from server...");
      const result = await fetchTasks(fetchAll);
      console.log(`Loaded ${result.length} tasks`);
      setTasks(result);
      setTasksLoaded(true);
    } catch (error) {
      console.error("Failed to fetch tasks:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Load tasks immediately on component mount only
  useEffect(() => {
    console.log("Tasks component mounted, loading tasks...");
    loadTasks(false);
  }, [loadTasks]);

  // Load all tasks when search is performed
  useEffect(() => {
    if (completedSearchQuery && tasksLoaded && !loadAllCompleted) {
      setLoadAllCompleted(true);
      loadTasks(true);
    }
  }, [completedSearchQuery, loadTasks, tasksLoaded, loadAllCompleted]);

  // Handle scroll to load more
  useEffect(() => {
    if (!completedListRef.current || loadAllCompleted || !tasksLoaded) return;

    const container = completedListRef.current;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      // Check if scrolled to bottom
      if (scrollHeight - scrollTop - clientHeight < 50 && !loadAllCompleted) {
        setLoadAllCompleted(true);
        loadTasks(true);
      }
    };

    container.addEventListener("scroll", handleScroll);
    return () => container.removeEventListener("scroll", handleScroll);
  }, [loadAllCompleted, loadTasks, tasksLoaded]);

  // Toggle the sort order for completed tasks
  const handleToggleSort = () => {
    setCompletedSortDesc((prev) => !prev);
  };

  // Wrap the handler functions to update local state after actions
  const handleAddTaskAndUpdateLocal = async (title: string, type: TaskType) => {
    try {
      // Create task object similar to what the API would return
      const newTask: Partial<Task> = {
        title,
        type,
        completed: false,
        completedAt: null,
        createdAt: new Date(),
      };

      // Call the parent handler which will make the API call
      await onAddTask(title, type);

      // Simulate the server response by adding a temporary ID
      // This will be replaced when we reload the page
      const tempId = `temp-${Date.now()}`;
      const tempTask = { ...newTask, _id: tempId } as Task;

      // Update local state immediately
      setTasks((prev) => [tempTask, ...prev]);
    } catch (error) {
      console.error("Failed to add task:", error);
      // In case of error, reload from server
      loadTasks(loadAllCompleted);
    }
  };

  const handleToggleCompleteAndUpdateLocal = (id: string) => {
    // Update local state immediately
    setTasks((prev) =>
      prev.map((task) => {
        if (task._id === id) {
          const completed = !task.completed;
          return {
            ...task,
            completed,
            completedAt: completed ? new Date() : null,
          };
        }
        return task;
      })
    );

    // Call the parent handler which will make the API call
    onToggleComplete(id);
  };

  const handleDeleteAndUpdateLocal = (id: string) => {
    // Update local state immediately
    setTasks((prev) => prev.filter((task) => task._id !== id));

    // Call the parent handler which will make the API call
    onDelete(id);
  };

  const handleChangeTaskTypeAndUpdateLocal = (
    id: string,
    newType: TaskType
  ) => {
    // Update local state immediately
    setTasks((prev) =>
      prev.map((task) => {
        if (task._id === id) {
          return { ...task, type: newType };
        }
        return task;
      })
    );

    // Call the parent handler which will make the API call
    onChangeTaskType(id, newType);
  };

  const handleUpdateTitleAndUpdateLocal = (id: string, title: string) => {
    // Update local state immediately
    setTasks((prev) =>
      prev.map((task) => {
        if (task._id === id) {
          return { ...task, title };
        }
        return task;
      })
    );

    // Call the parent handler which will make the API call
    onUpdateTitle(id, title);
  };

  // Filter active tasks by selected type and search
  const activeTasks = tasks
    .filter((task) => !task.completed && task.type === selectedType)
    .filter((task) => {
      if (activeSearchQuery) {
        return task.title
          .toLowerCase()
          .includes(activeSearchQuery.toLowerCase());
      }
      return true;
    });

  // Filter completed tasks
  const filteredCompletedTasks = tasks
    .filter((task) => task.completed)
    .filter((task) => {
      // Apply type filter
      if (completedFilter !== "all") {
        return task.type === completedFilter;
      }
      return true;
    })
    .filter((task) => {
      // Apply search filter
      if (completedSearchQuery) {
        return task.title
          .toLowerCase()
          .includes(completedSearchQuery.toLowerCase());
      }
      return true;
    });

  // Apply sorting to filtered completed tasks
  const sortedCompletedTasks = [...filteredCompletedTasks].sort((a, b) => {
    // Get the timestamps safely, using 0 as fallback if date is invalid
    const bTime =
      b.completedAt instanceof Date
        ? b.completedAt.getTime()
        : b.completedAt
        ? new Date(b.completedAt).getTime()
        : 0;

    const aTime =
      a.completedAt instanceof Date
        ? a.completedAt.getTime()
        : a.completedAt
        ? new Date(a.completedAt).getTime()
        : 0;

    // Apply the sort direction based on completedSortDesc state
    return completedSortDesc ? bTime - aTime : aTime - bTime;
  });

  // Skeleton loader for tasks
  const TasksSkeleton = () => (
    <div className="space-y-4">
      {[...Array(5)].map((_, i) => (
        <div
          key={i}
          className="flex items-center border border-gray-200 dark:border-gray-800 rounded-lg p-3 animate-pulse"
        >
          <div className="h-4 w-4 bg-gray-200 dark:bg-gray-700 rounded-sm mr-3"></div>
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-full max-w-xs"></div>
          <div className="ml-auto flex space-x-2">
            <div className="h-6 w-6 bg-gray-200 dark:bg-gray-700 rounded"></div>
            <div className="h-6 w-6 bg-gray-200 dark:bg-gray-700 rounded"></div>
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12">
      {/* Task type selector */}
      <div className="mb-2">
        <TaskTypeSelector
          selectedType={selectedType}
          onTypeSelect={setSelectedType}
        />
      </div>

      {/* Task form with card styling */}
      <div className="rounded-lg border border-gray-200 dark:border-gray-800 p-5 bg-white dark:bg-gray-900 shadow-sm">
        <h2 className="text-sm font-medium text-gray-900 dark:text-white mb-3 flex items-center justify-between">
          <span>Add New Task</span>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            <kbd className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 font-mono">
              A
            </kbd>
          </span>
        </h2>
        <AddTaskForm
          onAddTask={handleAddTaskAndUpdateLocal}
          currentType={selectedType}
        />
      </div>

      {/* Active tasks section */}
      <div className="rounded-lg border border-gray-200 dark:border-gray-800 overflow-hidden bg-white dark:bg-gray-900 shadow-sm">
        <div className="border-b border-gray-200 dark:border-gray-800 px-5 py-3 flex justify-between items-center bg-gray-50 dark:bg-gray-800/40">
          <h2 className="text-sm font-medium text-gray-900 dark:text-white">
            {selectedType === "day"
              ? "Today's Tasks"
              : selectedType === "week"
              ? "This Week's Tasks"
              : "Future Tasks"}
          </h2>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {isLoading
              ? "Loading..."
              : `${activeTasks.length} ${
                  activeTasks.length === 1 ? "task" : "tasks"
                }`}
          </span>
        </div>

        {/* Active tasks search bar */}
        <div className="px-5 py-3 border-b border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/30">
          <div className="relative">
            <input
              type="text"
              placeholder={`Search ${
                selectedType === "day"
                  ? "today's"
                  : selectedType === "week"
                  ? "this week's"
                  : "future"
              } tasks...`}
              value={activeSearchQuery}
              onChange={(e) => {
                setActiveSearchQuery(e.target.value);
              }}
              className="w-full pl-9 pr-3 py-2 text-sm rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:focus:ring-blue-400 transition-all"
            />
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-gray-500"
            >
              <path
                fillRule="evenodd"
                d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z"
                clipRule="evenodd"
              />
            </svg>
          </div>
        </div>

        <div className="p-5">
          {isLoading ? (
            <TasksSkeleton />
          ) : (
            <>
              <TaskList
                tasks={activeTasks}
                onToggleComplete={handleToggleCompleteAndUpdateLocal}
                onDelete={handleDeleteAndUpdateLocal}
                onChangeTaskType={handleChangeTaskTypeAndUpdateLocal}
                onUpdateTitle={handleUpdateTitleAndUpdateLocal}
              />
              {activeTasks.length === 0 && (
                <div className="text-center py-8">
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    No active tasks
                  </p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                    {activeSearchQuery
                      ? "Try a different search term"
                      : "Add a task to get started"}
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Completed tasks section */}
      <div className="rounded-lg border border-gray-200 dark:border-gray-800 overflow-hidden bg-white dark:bg-gray-900 shadow-sm">
        <div className="border-b border-gray-200 dark:border-gray-800 px-5 py-3 flex justify-between items-center bg-gray-50 dark:bg-gray-800/40">
          <h2 className="text-sm font-medium text-gray-900 dark:text-white">
            Completed Tasks
          </h2>
          <div className="flex items-center gap-3">
            <button
              onClick={handleToggleSort}
              className="text-xs flex items-center text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
            >
              <span>{completedSortDesc ? "Newest" : "Oldest"}</span>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
                className={`w-3.5 h-3.5 ml-1 transition-transform ${
                  completedSortDesc ? "" : "transform rotate-180"
                }`}
              >
                <path
                  fillRule="evenodd"
                  d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
            {!isLoading && (
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {sortedCompletedTasks.length}{" "}
                {!loadAllCompleted && filteredCompletedTasks.length > 50
                  ? `/ ${filteredCompletedTasks.length}`
                  : ""}{" "}
                {sortedCompletedTasks.length === 1 ? "task" : "tasks"}
              </span>
            )}
          </div>
        </div>

        <div className="px-5 py-3 border-b border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/30">
          <div className="flex flex-wrap items-center gap-3">
            {/* Search input */}
            <div className="relative flex-grow w-full">
              <div className="flex items-center gap-3">
                <input
                  type="text"
                  placeholder="Search completed tasks..."
                  value={completedSearchQuery}
                  onChange={(e) => {
                    setCompletedSearchQuery(e.target.value);
                  }}
                  className="w-full pl-9 pr-3 py-2 text-sm rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:focus:ring-blue-400 transition-all"
                />
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-gray-500"
                >
                  <path
                    fillRule="evenodd"
                    d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z"
                    clipRule="evenodd"
                  />
                </svg>

                {/* Filter buttons */}
                <div className="flex gap-1 text-xs flex-shrink-0">
                  <button
                    onClick={() => {
                      setCompletedFilter("all");
                    }}
                    className={`px-3 py-2 rounded-md font-medium transition-colors ${
                      completedFilter === "all"
                        ? "bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 shadow-sm"
                        : "bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/70 border border-gray-200 dark:border-gray-700"
                    }`}
                  >
                    All
                  </button>
                  <button
                    onClick={() => {
                      setCompletedFilter("day");
                    }}
                    className={`px-3 py-2 rounded-md font-medium transition-colors ${
                      completedFilter === "day"
                        ? "bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 shadow-sm"
                        : "bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/70 border border-gray-200 dark:border-gray-700"
                    }`}
                  >
                    Day
                  </button>
                  <button
                    onClick={() => {
                      setCompletedFilter("week");
                    }}
                    className={`px-3 py-2 rounded-md font-medium transition-colors ${
                      completedFilter === "week"
                        ? "bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 shadow-sm"
                        : "bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/70 border border-gray-200 dark:border-gray-700"
                    }`}
                  >
                    Week
                  </button>
                  <button
                    onClick={() => {
                      setCompletedFilter("future");
                    }}
                    className={`px-3 py-2 rounded-md font-medium transition-colors ${
                      completedFilter === "future"
                        ? "bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 shadow-sm"
                        : "bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/70 border border-gray-200 dark:border-gray-700"
                    }`}
                  >
                    Future
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="p-5">
          <div
            className="max-h-[450px] overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600"
            ref={completedListRef}
          >
            {isLoading ? (
              <TasksSkeleton />
            ) : (
              <>
                <CompletedTasks
                  tasks={sortedCompletedTasks}
                  onDelete={handleDeleteAndUpdateLocal}
                  onChangeTaskType={handleChangeTaskTypeAndUpdateLocal}
                  onToggleComplete={handleToggleCompleteAndUpdateLocal}
                  onUpdateTitle={handleUpdateTitleAndUpdateLocal}
                />
                {sortedCompletedTasks.length === 0 && (
                  <div className="text-center py-8">
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      No completed tasks
                    </p>
                    {completedSearchQuery && (
                      <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                        Try a different search term
                      </p>
                    )}
                  </div>
                )}
              </>
            )}

            {!loadAllCompleted &&
              !isLoading &&
              !completedSearchQuery &&
              filteredCompletedTasks.length > 50 && (
                <div className="text-center py-4 mt-2">
                  <button
                    onClick={() => {
                      setLoadAllCompleted(true);
                      loadTasks(true);
                    }}
                    className="px-4 py-2 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600 rounded-md transition-colors shadow-sm flex items-center mx-auto"
                  >
                    <span>
                      Load all {filteredCompletedTasks.length - 50} more tasks
                    </span>
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                      className="w-3.5 h-3.5 ml-2"
                    >
                      <path
                        fillRule="evenodd"
                        d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </button>
                </div>
              )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Tasks;
