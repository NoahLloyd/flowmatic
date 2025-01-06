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

  const handleAddTask = async (title: string, type: TaskType) => {
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
    } catch (error) {
      console.error("Failed to create task:", error);
    }
  };

  const handleToggleComplete = async (id: string) => {
    try {
      const task = tasks.find((t) => t._id === id);
      if (!task) return;

      const updates = {
        completed: !task.completed,
        completedAt: !task.completed ? new Date() : null,
      };

      await api.updateTask(id, updates);
      setTasks((prev) =>
        prev.map((task) => (task._id === id ? { ...task, ...updates } : task))
      );
    } catch (error) {
      console.error("Failed to update task:", error);
    }
  };

  const handleDeleteTask = async (id: string) => {
    try {
      await api.deleteTask(id);
      setTasks((prev) => prev.filter((task) => task._id !== id));
    } catch (error) {
      console.error("Failed to delete task:", error);
    }
  };

  const handleChangeTaskType = async (id: string, newType: TaskType) => {
    try {
      await api.updateTask(id, { type: newType });
      setTasks((prev) =>
        prev.map((task) =>
          task._id === id ? { ...task, type: newType } : task
        )
      );
    } catch (error) {
      console.error("Failed to update task type:", error);
    }
  };

  const handleUpdateTitle = async (id: string, newTitle: string) => {
    try {
      if (!newTitle.trim()) return; // Don't update if title is empty
      await api.updateTask(id, { title: newTitle });
      setTasks((prev) =>
        prev.map((task) =>
          task._id === id ? { ...task, title: newTitle } : task
        )
      );
    } catch (error) {
      console.error("Failed to update task title:", error);
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
