import React from "react";
import { Task } from "../../types/Task";
import TaskItem from "./TaskItem";

interface TaskListProps {
  tasks: Task[];
  onToggleComplete: (id: string) => void;
  onDelete: (id: string) => void;
}

interface TaskListProps {
  tasks: Task[];
  onToggleComplete: (id: string) => void;
  onDelete: (id: string) => void;
  onChangeTaskType: (id: string, type: "day" | "week" | "future") => void;
}

const TaskList: React.FC<TaskListProps> = ({
  tasks,
  onToggleComplete,
  onDelete,
  onChangeTaskType,
}) => {
  return (
    <div className="space-y-2">
      {tasks.map((task) => (
        <TaskItem
          key={task.id}
          task={task}
          onToggleComplete={onToggleComplete}
          onDelete={onDelete}
          onChangeTaskType={onChangeTaskType}
        />
      ))}
      {tasks.length === 0 && (
        <p className="text-center text-gray-500 py-4">No tasks yet</p>
      )}
    </div>
  );
};

export default TaskList;
