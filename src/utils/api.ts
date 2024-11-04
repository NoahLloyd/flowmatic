import { Session } from "src/types/Session";
import { WritingEntries } from "src/types/Writing";

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
};
