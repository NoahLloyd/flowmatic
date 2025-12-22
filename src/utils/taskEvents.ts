import { Task } from "../types/Task";

// Custom event names
export const TASK_ADDED_EVENT = "task-added";

// Type for the task added event detail
export interface TaskAddedEventDetail {
  task: Task;
}

// Helper function to dispatch task added event
export const dispatchTaskAdded = (task: Task) => {
  const event = new CustomEvent<TaskAddedEventDetail>(TASK_ADDED_EVENT, {
    detail: { task },
  });
  window.dispatchEvent(event);
};

// Helper function to subscribe to task added events
export const subscribeToTaskAdded = (
  callback: (task: Task) => void
): (() => void) => {
  const handler = (event: Event) => {
    const customEvent = event as CustomEvent<TaskAddedEventDetail>;
    callback(customEvent.detail.task);
  };
  
  window.addEventListener(TASK_ADDED_EVENT, handler);
  
  // Return unsubscribe function
  return () => {
    window.removeEventListener(TASK_ADDED_EVENT, handler);
  };
};

