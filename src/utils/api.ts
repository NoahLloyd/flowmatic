import { Session } from "src/types/Session";
import { MorningEntries } from "src/types/Morning";
import { Task } from "src/types/Task";
import { User } from "src/types/User";
import { Document } from "src/types/Document";
import { WeeklyReview, ReviewStreak } from "src/types/Review";

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

  // Add new method for fetching any user's sessions
  getUserSessionsById: async (userId: string) =>
    window.electron.apiRequest("GET", `/session/user/${userId}`, withAuth()),

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

  // Morning endpoints
  getAllEntries: async (): Promise<MorningEntries> =>
    window.electron.apiRequest("GET", "/writing/entries", withAuth()),

  getEntry: async (
    date: string
  ): Promise<{ content: string; activityContent?: any }> => {
    const response = await window.electron.apiRequest(
      "GET",
      `/writing/entry/${date}`,
      withAuth()
    );
    console.log("API getEntry raw response:", response);
    return response;
  },

  updateEntry: async (
    date: string,
    content: string,
    activityContent?: any
  ): Promise<void> => {
    const requestBody = {
      content,
      activityContent: activityContent || {}, // Ensure activityContent is never undefined
    };

    console.log("updateEntry request body:", requestBody);

    const response = await window.electron.apiRequest(
      "POST",
      `/writing/entry/${date}`,
      {
        body: requestBody,
        ...withAuth(),
      }
    );

    console.log("updateEntry response:", response);
    return response;
  },

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

  getAllSignalHistory: async (
    startDate: string,
    endDate: string
  ): Promise<Record<string, any>> => {
    console.log(
      `API Request: Fetching all signal history from ${startDate} to ${endDate}`
    );
    try {
      const response = await window.electron.apiRequest(
        "GET",
        `/signals/history?start_date=${startDate}&end_date=${endDate}`,
        withAuth()
      );
      console.log("API Response: getAllSignalHistory raw data:", response);
      return response;
    } catch (error) {
      console.error("API Error in getAllSignalHistory:", error);
      throw error;
    }
  },

  // User preferences
  updateUserPreferences: async (
    userId: string,
    preferences: Record<string, any>
  ): Promise<User> =>
    window.electron.apiRequest("PUT", `/auth/${userId}/preferences`, {
      body: preferences,
      ...withAuth(),
    }),

  // Notes endpoints
  getNotes: async () => window.electron.apiRequest("GET", "/notes", withAuth()),

  createNote: async (noteData: { content: string; tags: string[] }) =>
    window.electron.apiRequest("POST", "/notes", {
      body: noteData,
      ...withAuth(),
    }),

  updateNote: async (
    noteId: string,
    updates: {
      content?: string;
      is_processed?: boolean;
      tags?: string[];
    }
  ) =>
    window.electron.apiRequest("PUT", `/notes/${noteId}`, {
      body: updates,
      ...withAuth(),
    }),

  deleteNote: async (noteId: string) =>
    window.electron.apiRequest("DELETE", `/notes/${noteId}`, withAuth()),

  // Document endpoints
  getUserDocuments: async (): Promise<Document[]> => {
    const response = await window.electron.apiRequest(
      "GET",
      "/documents",
      withAuth()
    );
    return response;
  },

  getDocumentById: async (documentId: string): Promise<Document> => {
    const response = await window.electron.apiRequest(
      "GET",
      `/documents/${documentId}`,
      withAuth()
    );
    return response;
  },

  createDocument: async (documentData: {
    title: string;
    content: string;
    publication_status?: "unpublished" | "hidden" | "live";
  }): Promise<Document> =>
    window.electron.apiRequest("POST", "/documents", {
      body: documentData,
      ...withAuth(),
    }),

  updateDocument: async (
    documentId: string,
    updates: {
      title?: string;
      content?: string;
      publication_status?: "unpublished" | "hidden" | "live";
    }
  ): Promise<Document> =>
    window.electron.apiRequest("PUT", `/documents/${documentId}`, {
      body: updates,
      ...withAuth(),
    }),

  updateDocumentPublicationStatus: async (
    documentId: string,
    publication_status: "unpublished" | "hidden" | "live"
  ): Promise<Document> =>
    window.electron.apiRequest("PUT", `/documents/${documentId}/publication`, {
      body: { publication_status },
      ...withAuth(),
    }),

  deleteDocument: async (documentId: string): Promise<void> =>
    window.electron.apiRequest(
      "DELETE",
      `/documents/${documentId}`,
      withAuth()
    ),

  // Weekly Review endpoints
  getWeeklyReview: async (weekStart: string): Promise<WeeklyReview | null> => {
    try {
      const response = await window.electron.apiRequest(
        "GET",
        `/reviews/week/${weekStart}`,
        withAuth()
      );
      return response;
    } catch (error) {
      // Return null if no review exists for this week
      return null;
    }
  },

  saveWeeklyReview: async (review: Omit<WeeklyReview, 'id' | 'user_id' | 'created_at' | 'updated_at'>): Promise<WeeklyReview> =>
    window.electron.apiRequest("POST", "/reviews", {
      body: review,
      ...withAuth(),
    }),

  completeWeeklyReview: async (weekStart: string): Promise<WeeklyReview> =>
    window.electron.apiRequest("POST", `/reviews/week/${weekStart}/complete`, {
      ...withAuth(),
    }),

  getReviewStreak: async (): Promise<ReviewStreak> => {
    try {
      const response = await window.electron.apiRequest(
        "GET",
        "/reviews/streak",
        withAuth()
      );
      return response;
    } catch (error) {
      // Return default streak if endpoint doesn't exist yet
      return { current_streak: 0, longest_streak: 0 };
    }
  },

  getAllReviews: async (): Promise<WeeklyReview[]> => {
    try {
      const response = await window.electron.apiRequest(
        "GET",
        "/reviews",
        withAuth()
      );
      return response;
    } catch (error) {
      return [];
    }
  },

  // Add item to current week's review inbox
  addToReviewInbox: async (item: string, timezone: string = Intl.DateTimeFormat().resolvedOptions().timeZone): Promise<boolean> => {
    try {
      // Calculate current week start (Wednesday)
      const now = new Date();
      const dateInTZ = new Date(now.toLocaleString("en-US", { timeZone: timezone }));
      const day = dateInTZ.getDay();
      let daysToSubtract;
      if (day >= 3) {
        daysToSubtract = day - 3;
      } else {
        daysToSubtract = day + 4;
      }
      const wednesday = new Date(dateInTZ);
      wednesday.setDate(dateInTZ.getDate() - daysToSubtract);
      const weekStart = wednesday.toISOString().split("T")[0];
      
      // Calculate week end (Tuesday)
      const tuesday = new Date(wednesday);
      tuesday.setDate(wednesday.getDate() + 6);
      const weekEnd = tuesday.toISOString().split("T")[0];

      // Get existing review or create new one
      let review = await api.getWeeklyReview(weekStart);
      
      const inboxItems = review?.inbox_items || [];
      inboxItems.push(item);

      // Save the review with the new inbox item
      await api.saveWeeklyReview({
        week_start: weekStart,
        week_end: weekEnd,
        checklist: review?.checklist || [],
        questions: review?.questions || [],
        is_completed: review?.is_completed || false,
        inbox_items: inboxItems,
      });

      return true;
    } catch (error) {
      console.error("Failed to add to review inbox:", error);
      return false;
    }
  },
};
