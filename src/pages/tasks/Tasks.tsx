import React, { useState } from "react";
import { Task, TaskType } from "../../types/Task";
import TaskList from "./TaskList";
import AddTaskForm from "./AddTaskForm";
import TaskTypeSelector from "./TaskTypeSelector";
import CompletedTasks from "./CompletedTasks";

interface TasksProps {
  tasks: Task[];
  isLoading: boolean;
  onAddTask: (title: string, type: TaskType) => void;
  onToggleComplete: (id: string) => void;
  onDelete: (id: string) => void;
  onChangeTaskType: (id: string, newType: TaskType) => void;
  onUpdateTitle: (id: string, title: string) => void;
}

const Tasks: React.FC<TasksProps> = ({
  tasks,
  isLoading,
  onAddTask,
  onToggleComplete,
  onDelete,
  onChangeTaskType,
  onUpdateTitle,
}) => {
  const [selectedType, setSelectedType] = useState<TaskType>("day");

  const activeTasks = tasks.filter(
    (task) => !task.completed && task.type === selectedType
  );
  const completedTasks = tasks
    .filter((task) => task.completed)
    .sort((a, b) => {
      const bTime = b.completedAt instanceof Date ? b.completedAt.getTime() : 0;
      const aTime = a.completedAt instanceof Date ? a.completedAt.getTime() : 0;
      return bTime - aTime;
    });

  if (isLoading) {
    return (
      <div className="w-full text-center dark:text-slate-300">
        Loading tasks...
      </div>
    );
  }

  return (
    <div className="w-full">
      <TaskTypeSelector
        selectedType={selectedType}
        onTypeSelect={setSelectedType}
      />

      <AddTaskForm onAddTask={onAddTask} currentType={selectedType} />

      <TaskList
        tasks={activeTasks}
        onToggleComplete={onToggleComplete}
        onDelete={onDelete}
        onChangeTaskType={onChangeTaskType}
        onUpdateTitle={onUpdateTitle}
      />
      <h2 className="mt-8 mb-2 text-xl font-semibold text-slate-700 dark:text-slate-200">
        Completed Tasks
      </h2>
      <div className="max-h-[400px] overflow-y-auto">
        <CompletedTasks
          tasks={completedTasks}
          onDelete={onDelete}
          onChangeTaskType={onChangeTaskType}
          onToggleComplete={onToggleComplete}
          onUpdateTitle={onUpdateTitle}
        />
      </div>
    </div>
  );
};

export default Tasks;
