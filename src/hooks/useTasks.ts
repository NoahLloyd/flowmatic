import { useState, useEffect } from "react";
import { Task, TaskType } from "../types/Task";
import { api } from "../utils/api";

export const useTasks = () => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchTasks = async () => {
    try {
      setIsLoading(true);
      const fetchedTasks = await api.getUserTasks();
      setTasks(fetchedTasks);
    } catch (error) {
      console.error("Failed to fetch tasks:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, []);

  const handleAddTask = async (title: string, type: TaskType): Promise<Task | null> => {
    try {
      const taskData: Omit<Task, "_id"> = {
        title,
        type,
        completed: false,
        completedAt: null,
        createdAt: new Date(),
      };

      const newTask = await api.createTask(taskData);
      setTasks((prev) => [newTask, ...prev]);
      return newTask;
    } catch (error) {
      console.error("Failed to create task:", error);
      return null;
    }
  };

  const handleToggleComplete = async (id: string, completed?: boolean): Promise<boolean> => {
    try {
      // If completed status is passed directly, use it; otherwise look up the task
      let newCompletedStatus: boolean;
      
      if (completed !== undefined) {
        // Caller is telling us what the new status should be
        newCompletedStatus = completed;
      } else {
        // Fallback: look up in local state (may be out of sync)
      const task = tasks.find((t) => t._id === id);
        if (!task) {
          console.error("Task not found in useTasks state:", id);
          return false;
        }
        newCompletedStatus = !task.completed;
      }

      const updates = {
        completed: newCompletedStatus,
        completedAt: newCompletedStatus ? new Date() : null,
      };

      await api.updateTask(id, updates);
      setTasks((prev) =>
        prev.map((task) => (task._id === id ? { ...task, ...updates } : task))
      );
      return true;
    } catch (error) {
      console.error("Failed to update task:", error);
      return false;
    }
  };

  const handleDeleteTask = async (id: string): Promise<boolean> => {
    try {
      await api.deleteTask(id);
      setTasks((prev) => prev.filter((task) => task._id !== id));
      return true;
    } catch (error) {
      console.error("Failed to delete task:", error);
      return false;
    }
  };

  const handleChangeTaskType = async (id: string, newType: TaskType): Promise<boolean> => {
    try {
      await api.updateTask(id, { type: newType });
      setTasks((prev) =>
        prev.map((task) =>
          task._id === id ? { ...task, type: newType } : task
        )
      );
      return true;
    } catch (error) {
      console.error("Failed to update task type:", error);
      return false;
    }
  };

  const handleUpdateTitle = async (id: string, newTitle: string): Promise<boolean> => {
    try {
      if (!newTitle.trim()) return false; // Don't update if title is empty
      await api.updateTask(id, { title: newTitle });
      setTasks((prev) =>
        prev.map((task) =>
          task._id === id ? { ...task, title: newTitle } : task
        )
      );
      return true;
    } catch (error) {
      console.error("Failed to update task title:", error);
      return false;
    }
  };

  return {
    tasks,
    isLoading,
    handleAddTask,
    handleToggleComplete,
    handleDeleteTask,
    handleChangeTaskType,
    handleUpdateTitle,
  };
};
