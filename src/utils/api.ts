interface Session {
  user_id: string;
  notes: string;
  task: string;
  project: string;
  minutes: number;
  focus: number;
  created_at?: string;
}

export const api = {
  submitSession: (data: Session) =>
    window.electron.apiRequest("POST", "/session/new", data),

  getUserSessions: (userId: string) =>
    window.electron.apiRequest("GET", `/session/user/${userId}`),
};
