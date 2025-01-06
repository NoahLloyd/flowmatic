import { Task, TaskType } from "../types/Task";

export const generateId = (): string => {
  return Math.random().toString(36).substr(2, 9);
};

export const createTask = (title: string, type: TaskType): Task => {
  return {
    _id: generateId(),
    title,
    completed: false,
    completedAt: null, // Initialize as null
    type,
    createdAt: new Date(),
  };
};
