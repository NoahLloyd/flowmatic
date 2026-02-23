export type TaskType = "day" | "week" | "future" | "blocked" | "shopping";

export interface Task {
  id: string;
  title: string;
  completed: boolean;
  completedAt: Date | null;
  type: TaskType;
  createdAt: Date;
}
