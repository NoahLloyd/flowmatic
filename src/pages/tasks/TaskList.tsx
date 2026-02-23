import React from "react";
import { Task, TaskType } from "../../types/Task";
import TaskItem from "./TaskItem";
import { Droppable, Draggable } from "react-beautiful-dnd";

interface TaskListProps {
  tasks: Task[];
  onToggleComplete: (id: string) => void;
  onDelete: (id: string) => void;
  onChangeTaskType: (id: string, type: TaskType) => void;
  onUpdateTitle: (id: string, title: string) => void;
  droppableId: string;
}

const TaskList: React.FC<TaskListProps> = ({
  tasks,
  onToggleComplete,
  onDelete,
  onChangeTaskType,
  onUpdateTitle,
  droppableId,
}) => {
  return (
    <Droppable droppableId={droppableId}>
      {(provided, snapshot) => (
        <div
          {...provided.droppableProps}
          ref={provided.innerRef}
          className={`space-y-3 ${
            snapshot.isDraggingOver
              ? "bg-gray-100 dark:bg-gray-800/50 rounded-md"
              : ""
          }`}
        >
          {tasks.map((task, index) => (
            <TaskItem
              key={task.id}
              task={task}
              index={index}
              onToggleComplete={onToggleComplete}
              onDelete={onDelete}
              onChangeTaskType={onChangeTaskType}
              onUpdateTitle={onUpdateTitle}
            />
          ))}
          {provided.placeholder}
        </div>
      )}
    </Droppable>
  );
};

export default TaskList;
