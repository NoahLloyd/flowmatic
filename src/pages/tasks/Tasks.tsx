import React, { useState } from "react";
import { Task, TaskType } from "../../types/Task";
import TaskList from "./TaskList";
import AddTaskForm from "./AddTaskForm";
import TaskTypeSelector from "./TaskTypeSelector";
import CompletedTasks from "./CompletedTasks";

interface TasksProps {
  tasks: Task[];
  onAddTask: (title: string, type: TaskType) => void;
  onToggleComplete: (id: string) => void;
  onDelete: (id: string) => void;
  onChangeTaskType: (id: string, newType: TaskType) => void;
}

const Tasks: React.FC<TasksProps> = ({
  tasks,
  onAddTask,
  onToggleComplete,
  onDelete,
  onChangeTaskType,
}) => {
  const [selectedType, setSelectedType] = useState<TaskType>("day");

  const activeTasks = tasks.filter(
    (task) => !task.completed && task.type === selectedType
  );
  const completedTasks = tasks
    .filter((task) => task.completed)
    .sort(
      (a, b) =>
        (b.completedAt?.getTime() || 0) - (a.completedAt?.getTime() || 0)
    );

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
      />
      <h2 className="mt-8 mb-2 text-xl font-semibold text-slate-700">
        Completed Tasks
      </h2>
      <div className="max-h-[400px] overflow-y-auto">
        <CompletedTasks
          tasks={completedTasks}
          onDelete={onDelete}
          onChangeTaskType={onChangeTaskType}
        />
      </div>
    </div>
  );
};

export default Tasks;
