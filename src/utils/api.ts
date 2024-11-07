import { Session } from "src/types/Session";
import { WritingEntries } from "src/types/Writing";
import { Task } from "src/types/Task";

export const api = {
  submitSession: (data: Session) =>
    window.electron.apiRequest("POST", "/session/new", data),

  getUserSessions: (userId: string) =>
    window.electron.apiRequest("GET", `/session/user/${userId}`),

  getAllEntries: async (): Promise<WritingEntries> => {
    const userId = localStorage.getItem("name");
    return await window.electron.apiRequest("GET", "/writing/entries", {
      user_id: userId,
    });
  },

  getEntry: async (date: string): Promise<{ content: string }> => {
    const userId = localStorage.getItem("name");
    return await window.electron.apiRequest(
      "GET",
      `/writing/entry/${userId}/${date}`
    );
  },

  updateEntry: async (date: string, content: string): Promise<void> => {
    const userId = localStorage.getItem("name");
    await window.electron.apiRequest("POST", `/writing/entry/${date}`, {
      content,
      user_id: userId,
    });
  },
  getUserTasks: async (): Promise<Task[]> => {
    const userId = localStorage.getItem("name");
    return await window.electron.apiRequest("GET", "/tasks/user", {
      user_id: userId,
    });
  },

  createTask: async (taskData: Omit<Task, "id">): Promise<Task> => {
    const userId = localStorage.getItem("name");
    return await window.electron.apiRequest("POST", "/tasks/new", {
      ...taskData,
      user_id: userId,
    });
  },

  updateTask: async (taskId: string, updates: Partial<Task>): Promise<Task> => {
    const userId = localStorage.getItem("name");
    return await window.electron.apiRequest("PUT", `/tasks/${taskId}`, {
      ...updates,
      user_id: userId,
    });
  },

  deleteTask: async (taskId: string): Promise<void> => {
    const userId = localStorage.getItem("name");
    return await window.electron.apiRequest("DELETE", `/tasks/${taskId}`, {
      user_id: userId,
    });
  },
  updateSession: async (
    sessionId: string,
    data: Partial<Session>
  ): Promise<Session> => {
    return await window.electron.apiRequest(
      "PUT",
      `/session/update/${sessionId}`, // Changed from /session/update/${sessionId}
      data
    );
  },

  deleteSession: async (sessionId: string): Promise<void> => {
    return await window.electron.apiRequest(
      "DELETE",
      `/session/delete/${sessionId}`, // Changed from /session/delete/${sessionId}
      {}
    );
  },
};
