export type TaskType = "day" | "week" | "future" | "blocked";

export interface Task {
  _id: string;
  title: string;
  completed: boolean;
  completedAt: Date | null;
  type: TaskType;
  createdAt: Date;
}
