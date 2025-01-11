import { Session } from "src/types/Session";
import { WritingEntries } from "src/types/Writing";
import { Task } from "src/types/Task";
import { User } from "src/types/User";

const withAuth = () => ({
  headers: {
    "Content-Type": "application/json",
    Authorization: localStorage.getItem("token")
      ? `Bearer ${localStorage.getItem("token")}`
      : undefined,
  },
});

export const api = {
  // Auth endpoints
  login: async (email: string, password: string) =>
    window.electron.apiRequest("POST", "/auth/login", {
      body: { email, password },
      headers: { "Content-Type": "application/json" },
    }),

  register: async (name: string, email: string, password: string) =>
    window.electron.apiRequest("POST", "/auth/register", {
      body: { name, email, password },
      headers: { "Content-Type": "application/json" },
    }),

  getCurrentUser: async () =>
    window.electron.apiRequest("GET", "/auth/me", withAuth()),

  // Session endpoints
  getUserSessions: async () =>
    window.electron.apiRequest("GET", "/session/user", withAuth()),

  submitSession: async (data: Session) =>
    window.electron.apiRequest("POST", "/session/new", {
      body: data,
      ...withAuth(),
    }),

  updateSession: async (sessionId: string, data: Partial<Session>) =>
    window.electron.apiRequest("PUT", `/session/update/${sessionId}`, {
      body: data,
      ...withAuth(),
    }),

  deleteSession: async (sessionId: string) =>
    window.electron.apiRequest(
      "DELETE",
      `/session/delete/${sessionId}`,
      withAuth()
    ),

  // Task endpoints
  getUserTasks: async (): Promise<Task[]> =>
    window.electron.apiRequest("GET", "/tasks/user", withAuth()),

  createTask: async (taskData: Omit<Task, "_id">): Promise<Task> =>
    window.electron.apiRequest("POST", "/tasks/new", {
      body: taskData,
      ...withAuth(),
    }),

  updateTask: async (taskId: string, updates: Partial<Task>): Promise<Task> =>
    window.electron.apiRequest("PUT", `/tasks/${taskId}`, {
      body: updates,
      ...withAuth(),
    }),

  deleteTask: async (taskId: string): Promise<void> =>
    window.electron.apiRequest("DELETE", `/tasks/${taskId}`, withAuth()),

  // Writing endpoints
  getAllEntries: async (): Promise<WritingEntries> =>
    window.electron.apiRequest("GET", "/writing/entries", withAuth()),

  getEntry: async (date: string): Promise<{ content: string }> =>
    window.electron.apiRequest("GET", `/writing/entry/${date}`, withAuth()),

  updateEntry: async (date: string, content: string): Promise<void> =>
    window.electron.apiRequest("POST", `/writing/entry/${date}`, {
      body: { content },
      ...withAuth(),
    }),

  getDailySignals: async (date: string): Promise<Record<string, any>> =>
    window.electron.apiRequest("GET", `/signals/daily/${date}`, withAuth()),

  recordSignal: async (
    date: string,
    metric: string,
    value: number | boolean
  ): Promise<void> =>
    window.electron.apiRequest("POST", "/signals/record", {
      body: { date, metric, value },
      ...withAuth(),
    }),

  getSignalRange: async (
    startDate: string,
    endDate: string
  ): Promise<Record<string, any>> =>
    window.electron.apiRequest(
      "GET",
      `/signals/range?start_date=${startDate}&end_date=${endDate}`,
      withAuth()
    ),

  // User preferences
  updateUserPreferences: async (
    userId: string,
    preferences: Record<string, any>
  ): Promise<User> =>
    window.electron.apiRequest("PUT", `/user/${userId}/preferences`, {
      body: { preferences },
      ...withAuth(),
    }),
};
