import { Task, TaskType } from "../types/Task";
import { api } from "../utils/api";

export const useTasks = () => {
  // Note: This hook is used at PageContent level only for action handlers.
  // Each page (Tasks, DailyTasks, BlockedTasks) fetches its own task data.
  // No need to auto-fetch all tasks here — just provide API wrappers.

  const handleAddTask = async (title: string, type: TaskType): Promise<Task | null> => {
    try {
      const taskData: Omit<Task, "id"> = {
        title,
        type,
        completed: false,
        completedAt: null,
        createdAt: new Date(),
      };

      const newTask = await api.createTask(taskData);
      return newTask;
    } catch (error) {
      console.error("Failed to create task:", error);
      return null;
    }
  };

  const handleToggleComplete = async (id: string, completed?: boolean): Promise<boolean> => {
    try {
      if (completed === undefined) {
        console.error("handleToggleComplete requires explicit completed status");
        return false;
      }

      const updates = {
        completed,
        completedAt: completed ? new Date() : null,
      };

      await api.updateTask(id, updates);
      return true;
    } catch (error) {
      console.error("Failed to update task:", error);
      return false;
    }
  };

  const handleDeleteTask = async (id: string): Promise<boolean> => {
    try {
      await api.deleteTask(id);
      return true;
    } catch (error) {
      console.error("Failed to delete task:", error);
      return false;
    }
  };

  const handleChangeTaskType = async (id: string, newType: TaskType): Promise<boolean> => {
    try {
      await api.updateTask(id, { type: newType });
      return true;
    } catch (error) {
      console.error("Failed to update task type:", error);
      return false;
    }
  };

  const handleUpdateTitle = async (id: string, newTitle: string): Promise<boolean> => {
    try {
      if (!newTitle.trim()) return false;
      await api.updateTask(id, { title: newTitle });
      return true;
    } catch (error) {
      console.error("Failed to update task title:", error);
      return false;
    }
  };

  return {
    handleAddTask,
    handleToggleComplete,
    handleDeleteTask,
    handleChangeTaskType,
    handleUpdateTitle,
  };
};
