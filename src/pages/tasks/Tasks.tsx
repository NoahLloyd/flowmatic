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
      <div className="w-full flex items-center justify-center py-8">
        <div className="text-sm text-gray-500 dark:text-gray-400">
          Loading tasks...
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      {/* Task type selector */}
      <TaskTypeSelector
        selectedType={selectedType}
        onTypeSelect={setSelectedType}
      />

      {/* Task form with card styling */}
      <div className="rounded-lg border border-gray-200 dark:border-gray-800 p-4">
        <h2 className="text-sm font-medium text-gray-900 dark:text-white mb-3 flex items-center justify-between">
          <span>Add New Task</span>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            <kbd className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 font-mono">
              A
            </kbd>
          </span>
        </h2>
        <AddTaskForm onAddTask={onAddTask} currentType={selectedType} />
      </div>

      {/* Active tasks section */}
      <div className="rounded-lg border border-gray-200 dark:border-gray-800 overflow-hidden">
        <div className="border-b border-gray-200 dark:border-gray-800 px-4 py-2.5 flex justify-between items-center">
          <h2 className="text-sm font-medium text-gray-900 dark:text-white">
            Tasks
          </h2>
          <span className="text-xs text-gray-400 dark:text-gray-500">
            {activeTasks.length} tasks
          </span>
        </div>
        <div className="p-4">
          <TaskList
            tasks={activeTasks}
            onToggleComplete={onToggleComplete}
            onDelete={onDelete}
            onChangeTaskType={onChangeTaskType}
            onUpdateTitle={onUpdateTitle}
          />
          {activeTasks.length === 0 && (
            <div className="text-center py-4">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                No active tasks
              </p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                Add a task to get started
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Completed tasks section */}
      <div className="rounded-lg border border-gray-200 dark:border-gray-800 overflow-hidden">
        <div className="border-b border-gray-200 dark:border-gray-800 px-4 py-2.5 flex justify-between items-center">
          <h2 className="text-sm font-medium text-gray-900 dark:text-white">
            Completed Tasks
          </h2>
          <span className="text-xs text-gray-400 dark:text-gray-500">
            {completedTasks.length} tasks
          </span>
        </div>
        <div className="p-4">
          <div className="max-h-[400px] overflow-y-auto">
            <CompletedTasks
              tasks={completedTasks}
              onDelete={onDelete}
              onChangeTaskType={onChangeTaskType}
              onToggleComplete={onToggleComplete}
              onUpdateTitle={onUpdateTitle}
            />
            {completedTasks.length === 0 && (
              <div className="text-center py-4">
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  No completed tasks
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Tasks;
