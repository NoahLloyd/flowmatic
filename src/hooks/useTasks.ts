import { useState } from "react";
import { Task, TaskType } from "../types/Task";
import { createTask } from "../utils/taskUtils";

export const useTasks = () => {
  const [tasks, setTasks] = useState<Task[]>([]);

  const handleAddTask = (title: string, type: TaskType) => {
    const newTask = createTask(title, type);
    setTasks([newTask, ...tasks]);
  };

  const handleToggleComplete = (id: string) => {
    setTasks(
      tasks.map((task) =>
        task.id === id
          ? {
              ...task,
              completed: !task.completed,
              completedAt: !task.completed ? new Date() : null,
            }
          : task
      )
    );
  };

  const handleDeleteTask = (id: string) => {
    setTasks(tasks.filter((task) => task.id !== id));
  };

  const handleChangeTaskType = (id: string, newType: TaskType) => {
    setTasks(
      tasks.map((task) => (task.id === id ? { ...task, type: newType } : task))
    );
  };

  return {
    tasks,
    handleAddTask,
    handleToggleComplete,
    handleDeleteTask,
    handleChangeTaskType,
  };
};
