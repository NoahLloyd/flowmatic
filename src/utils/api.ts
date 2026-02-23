import { Session } from "src/types/Session";
import { MorningEntries, MorningEntry } from "src/types/Morning";
import { Task } from "src/types/Task";
import { User } from "src/types/User";
import { Document } from "src/types/Document";
import { WeeklyReview, ReviewStreak } from "src/types/Review";
import { supabase, getCurrentUserId } from "./supabase";

// ── helpers ──────────────────────────────────────────────────

/** Calculate writing streak from entries (ported from backend) */
function calculateWritingStreak(entries: MorningEntry[]): number {
  // Filter entries with at least 1000 characters in activityContent.writing
  const validEntries = entries.filter((entry) => {
    const writing =
      (entry.activityContent as Record<string, any>)?.writing || "";
    return writing.length >= 1000;
  });

  if (validEntries.length === 0) return 0;

  // Get dates and sort descending
  const entryDates = validEntries
    .map((e) => e.date)
    .sort()
    .reverse();

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let streak = 0;
  let lastDate: Date | null = null;

  for (const dateStr of entryDates) {
    const date = new Date(dateStr + "T00:00:00");
    if (lastDate === null) {
      if (date > today) continue;
      const diffDays = Math.floor(
        (today.getTime() - date.getTime()) / (1000 * 60 * 60 * 24)
      );
      if (diffDays <= 1) {
        streak = 1;
        lastDate = date;
      } else {
        break;
      }
    } else {
      const diffDays = Math.floor(
        (lastDate.getTime() - date.getTime()) / (1000 * 60 * 60 * 24)
      );
      if (diffDays === 1) {
        streak++;
        lastDate = date;
      } else {
        break;
      }
    }
  }

  return streak;
}

/** Calculate review streak from completed week starts (ported from backend) */
function calculateReviewStreak(completedWeekStarts: string[]): ReviewStreak {
  if (!completedWeekStarts || completedWeekStarts.length === 0) {
    return { current_streak: 0, longest_streak: 0 };
  }

  const parsed = completedWeekStarts
    .filter((ws) => ws)
    .map((ws) => new Date(ws + "T00:00:00"))
    .sort((a, b) => b.getTime() - a.getTime());

  if (parsed.length === 0) {
    return { current_streak: 0, longest_streak: 0 };
  }

  const lastCompletedWeek = parsed[0].toISOString().split("T")[0];

  // Calculate expected previous week start
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dayOfWeek = today.getDay();
  // Wednesday = 3 (JS getDay: 0=Sun, 1=Mon, ..., 3=Wed)
  const offset = ((dayOfWeek - 3) + 7) % 7;
  const currentWeekStart = new Date(today);
  currentWeekStart.setDate(today.getDate() - offset);
  const expectedPrev = new Date(currentWeekStart);
  expectedPrev.setDate(currentWeekStart.getDate() - 7);
  const grace = new Date(expectedPrev);
  grace.setDate(expectedPrev.getDate() - 7);

  // Current streak
  let currentStreak = 0;
  const firstCompletedTime = parsed[0].getTime();
  if (
    firstCompletedTime === expectedPrev.getTime() ||
    firstCompletedTime === grace.getTime()
  ) {
    const parsedSet = new Set(parsed.map((d) => d.getTime()));
    let cursor = parsed[0].getTime();
    while (parsedSet.has(cursor)) {
      currentStreak++;
      cursor -= 7 * 24 * 60 * 60 * 1000;
    }
  }

  // Longest streak
  const sortedAsc = [...parsed].sort((a, b) => a.getTime() - b.getTime());
  let longestStreak = 1;
  let run = 1;
  for (let i = 1; i < sortedAsc.length; i++) {
    const diff = sortedAsc[i].getTime() - sortedAsc[i - 1].getTime();
    if (diff === 7 * 24 * 60 * 60 * 1000) {
      run++;
    } else {
      run = 1;
    }
    if (run > longestStreak) longestStreak = run;
  }

  return {
    current_streak: currentStreak,
    longest_streak: longestStreak,
    last_completed_week: lastCompletedWeek,
  };
}

// ── API object ───────────────────────────────────────────────

export const api = {
  // ─── Auth ────────────────────────────────────────────────

  login: async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;

    // Fetch profile
    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", data.user.id)
      .single();

    return {
      access_token: data.session.access_token,
      token_type: "bearer",
      user: {
        id: data.user.id,
        name: profile?.name || "",
        email: data.user.email || "",
        picture_url: profile?.picture_url,
        preferences: profile?.preferences || {},
        created_at: profile?.created_at,
        updated_at: profile?.updated_at,
      },
    };
  },

  register: async (name: string, email: string, password: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name } },
    });
    if (error) throw error;
    if (!data.session) throw new Error("No session returned from signup");

    // Profile is auto-created by the DB trigger
    return {
      access_token: data.session.access_token,
      token_type: "bearer",
      user: {
        id: data.user!.id,
        name,
        email,
        preferences: {},
      },
    };
  },

  getCurrentUser: async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.user) throw new Error("Not authenticated");

    const user = session.user;
    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    return {
      id: user.id,
      name: profile?.name || "",
      email: user.email || "",
      picture_url: profile?.picture_url,
      preferences: profile?.preferences || {},
      created_at: profile?.created_at,
      updated_at: profile?.updated_at,
    };
  },

  // ─── Sessions ────────────────────────────────────────────

  getUserSessions: async () => {
    const userId = await getCurrentUserId();
    const { data, error } = await supabase
      .from("sessions")
      .select("*")
      .eq("user_id", userId)
      .limit(10000);
    if (error) throw error;
    return data || [];
  },

  getUserSessionsById: async (userId: string) => {
    const { data, error } = await supabase
      .from("sessions")
      .select("*")
      .eq("user_id", userId)
      .limit(10000);
    if (error) throw error;
    return data || [];
  },

  submitSession: async (sessionData: Session) => {
    const userId = await getCurrentUserId();
    const { data, error } = await supabase
      .from("sessions")
      .insert({
        user_id: userId,
        notes: sessionData.notes || "",
        task: sessionData.task || "",
        project: sessionData.project || "",
        minutes: sessionData.minutes,
        focus: sessionData.focus,
        created_at: sessionData.created_at || new Date().toISOString(),
      })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  updateSession: async (sessionId: string, updates: Partial<Session>) => {
    const { id, user_id, ...safeUpdates } = updates as any;
    const { data, error } = await supabase
      .from("sessions")
      .update(safeUpdates)
      .eq("id", sessionId)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  /** Fetch sessions within a date range (ISO 8601 strings, inclusive) */
  getSessionsByDateRange: async (
    startISO: string,
    endISO: string
  ): Promise<Session[]> => {
    const userId = await getCurrentUserId();
    const { data, error } = await supabase
      .from("sessions")
      .select("*")
      .eq("user_id", userId)
      .gte("created_at", startISO)
      .lte("created_at", endISO)
      .limit(10000);
    if (error) throw error;
    return (data || []) as Session[];
  },

  /** Fetch total session hours since a given start date (lightweight: only fetches minutes column) */
  getSessionHoursSince: async (startISO: string): Promise<number> => {
    const userId = await getCurrentUserId();
    const { data, error } = await supabase
      .from("sessions")
      .select("minutes")
      .eq("user_id", userId)
      .gte("created_at", startISO)
      .limit(10000);
    if (error) throw error;
    const totalMinutes = (data || []).reduce(
      (sum: number, s: any) => sum + (s.minutes || 0),
      0
    );
    return totalMinutes / 60;
  },

  deleteSession: async (sessionId: string) => {
    const { error } = await supabase
      .from("sessions")
      .delete()
      .eq("id", sessionId);
    if (error) throw error;
    return { message: "Session deleted successfully" };
  },

  // ─── Tasks ───────────────────────────────────────────────

  getUserTasks: async (): Promise<Task[]> => {
    const userId = await getCurrentUserId();
    const { data, error } = await supabase
      .from("tasks")
      .select("*")
      .eq("user_id", userId)
      .limit(10000);
    if (error) throw error;
    return (data || []).map((t: any) => ({
      ...t,
      completedAt: t.completed_at,
      createdAt: t.created_at,
    }));
  },

  /** Fetch tasks filtered by type (server-side) */
  getTasksByType: async (type: string): Promise<Task[]> => {
    const userId = await getCurrentUserId();
    const { data, error } = await supabase
      .from("tasks")
      .select("*")
      .eq("user_id", userId)
      .eq("type", type)
      .limit(10000);
    if (error) throw error;
    return (data || []).map((t: any) => ({
      ...t,
      completedAt: t.completed_at,
      createdAt: t.created_at,
    }));
  },

  createTask: async (taskData: Omit<Task, "id">): Promise<Task> => {
    const userId = await getCurrentUserId();
    const { data, error } = await supabase
      .from("tasks")
      .insert({
        user_id: userId,
        title: taskData.title,
        type: taskData.type,
        completed: taskData.completed || false,
        completed_at: taskData.completedAt || null,
      })
      .select()
      .single();
    if (error) throw error;
    return {
      ...data,
      completedAt: data.completed_at,
      createdAt: data.created_at,
    };
  },

  updateTask: async (
    taskId: string,
    updates: Partial<Task>
  ): Promise<Task> => {
    const dbUpdates: Record<string, any> = {};
    if (updates.title !== undefined) dbUpdates.title = updates.title;
    if (updates.type !== undefined) dbUpdates.type = updates.type;
    if (updates.completed !== undefined) {
      dbUpdates.completed = updates.completed;
      dbUpdates.completed_at = updates.completed
        ? new Date().toISOString()
        : null;
    }

    const { data, error } = await supabase
      .from("tasks")
      .update(dbUpdates)
      .eq("id", taskId)
      .select()
      .single();
    if (error) throw error;
    return {
      ...data,
      completedAt: data.completed_at,
      createdAt: data.created_at,
    };
  },

  deleteTask: async (taskId: string): Promise<void> => {
    const { error } = await supabase
      .from("tasks")
      .delete()
      .eq("id", taskId);
    if (error) throw error;
  },

  // ─── Morning / Writing ──────────────────────────────────

  getAllEntries: async (): Promise<MorningEntries> => {
    const userId = await getCurrentUserId();
    const { data, error } = await supabase
      .from("writings")
      .select("*")
      .eq("user_id", userId)
      .limit(10000);
    if (error) throw error;

    const entries: MorningEntry[] = (data || []).map((w: any) => ({
      date: w.date,
      content: "",
      user_id: w.user_id,
      activityContent: w.activity_content || {},
    }));

    const streak = calculateWritingStreak(entries);
    return { entries, streak };
  },

  getEntry: async (
    date: string
  ): Promise<{ content: string; activityContent?: any }> => {
    const userId = await getCurrentUserId();
    const { data, error } = await supabase
      .from("writings")
      .select("*")
      .eq("user_id", userId)
      .eq("date", date)
      .maybeSingle();
    if (error) throw error;

    if (!data) {
      return { content: "", activityContent: {} };
    }
    return {
      content: "",
      activityContent: data.activity_content || {},
    };
  },

  updateEntry: async (
    date: string,
    content: string,
    activityContent?: any
  ): Promise<void> => {
    const userId = await getCurrentUserId();
    const { error } = await supabase.from("writings").upsert(
      {
        user_id: userId,
        date,
        activity_content: activityContent || {},
      },
      { onConflict: "user_id,date" }
    );
    if (error) throw error;
  },

  // ─── Signals ─────────────────────────────────────────────

  getDailySignals: async (date: string): Promise<Record<string, any>> => {
    const userId = await getCurrentUserId();
    const { data, error } = await supabase
      .from("signals")
      .select("*")
      .eq("user_id", userId)
      .eq("date", date);
    if (error) throw error;

    // Transform to key-value format
    const signalDict: Record<string, any> = {};
    (data || []).forEach((s: any) => {
      signalDict[s.metric] = s.value;
    });
    return signalDict;
  },

  recordSignal: async (
    date: string,
    metric: string,
    value: number | boolean
  ): Promise<void> => {
    const userId = await getCurrentUserId();
    const { error } = await supabase.from("signals").upsert(
      {
        user_id: userId,
        date,
        metric,
        value,
      },
      { onConflict: "user_id,date,metric" }
    );
    if (error) throw error;
  },

  getSignalRange: async (
    startDate: string,
    endDate: string
  ): Promise<Record<string, any>> => {
    const userId = await getCurrentUserId();
    const { data, error } = await supabase
      .from("signals")
      .select("*")
      .eq("user_id", userId)
      .gte("date", startDate)
      .lte("date", endDate);
    if (error) throw error;
    return data || [];
  },

  getAllSignalHistory: async (
    startDate: string,
    endDate: string
  ): Promise<Record<string, any>> => {
    const userId = await getCurrentUserId();
    const { data, error } = await supabase
      .from("signals")
      .select("*")
      .eq("user_id", userId)
      .gte("date", startDate)
      .lte("date", endDate);
    if (error) throw error;
    return data || [];
  },

  // ─── User preferences ───────────────────────────────────

  updateUserPreferences: async (
    userId: string,
    preferences: Record<string, any>
  ): Promise<User> => {
    // First get existing preferences to merge
    const { data: profile } = await supabase
      .from("profiles")
      .select("preferences")
      .eq("id", userId)
      .single();

    const existingPrefs = profile?.preferences || {};
    const mergedPrefs = { ...existingPrefs, ...preferences };

    const { data, error } = await supabase
      .from("profiles")
      .update({ preferences: mergedPrefs })
      .eq("id", userId)
      .select()
      .single();
    if (error) throw error;

    return {
      id: data.id,
      name: data.name,
      email: data.email,
      picture_url: data.picture_url,
      preferences: data.preferences,
      created_at: data.created_at,
      updated_at: data.updated_at,
    };
  },

  // ─── Notes ───────────────────────────────────────────────

  getNotes: async () => {
    const userId = await getCurrentUserId();
    const { data, error } = await supabase
      .from("notes")
      .select("*")
      .eq("user_id", userId);
    if (error) throw error;
    return data || [];
  },

  createNote: async (noteData: { content: string; tags: string[] }) => {
    const userId = await getCurrentUserId();
    const { data, error } = await supabase
      .from("notes")
      .insert({
        user_id: userId,
        content: noteData.content,
        tags: noteData.tags,
      })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  updateNote: async (
    noteId: string,
    updates: {
      content?: string;
      is_processed?: boolean;
      tags?: string[];
    }
  ) => {
    const { data, error } = await supabase
      .from("notes")
      .update(updates)
      .eq("id", noteId)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  deleteNote: async (noteId: string) => {
    const { error } = await supabase
      .from("notes")
      .delete()
      .eq("id", noteId);
    if (error) throw error;
    return { message: "Note deleted successfully" };
  },

  // ─── Documents ───────────────────────────────────────────

  getUserDocuments: async (): Promise<Document[]> => {
    const userId = await getCurrentUserId();
    const { data, error } = await supabase
      .from("documents")
      .select("*")
      .eq("user_id", userId);
    if (error) throw error;
    return (data || []) as Document[];
  },

  getDocumentById: async (documentId: string): Promise<Document> => {
    const { data, error } = await supabase
      .from("documents")
      .select("*")
      .eq("id", documentId)
      .single();
    if (error) throw error;
    return data as Document;
  },

  createDocument: async (documentData: {
    title: string;
    content: string;
    publication_status?: "unpublished" | "hidden" | "live";
  }): Promise<Document> => {
    const userId = await getCurrentUserId();
    const { data, error } = await supabase
      .from("documents")
      .insert({
        user_id: userId,
        title: documentData.title,
        content: documentData.content,
        publication_status: documentData.publication_status || "unpublished",
      })
      .select()
      .single();
    if (error) throw error;
    return data as Document;
  },

  updateDocument: async (
    documentId: string,
    updates: {
      title?: string;
      content?: string;
      publication_status?: "unpublished" | "hidden" | "live";
    }
  ): Promise<Document> => {
    const { data, error } = await supabase
      .from("documents")
      .update(updates)
      .eq("id", documentId)
      .select()
      .single();
    if (error) throw error;
    return data as Document;
  },

  updateDocumentPublicationStatus: async (
    documentId: string,
    publication_status: "unpublished" | "hidden" | "live"
  ): Promise<Document> => {
    const { data, error } = await supabase
      .from("documents")
      .update({ publication_status })
      .eq("id", documentId)
      .select()
      .single();
    if (error) throw error;
    return data as Document;
  },

  deleteDocument: async (documentId: string): Promise<void> => {
    const { error } = await supabase
      .from("documents")
      .delete()
      .eq("id", documentId);
    if (error) throw error;
  },

  // ─── Weekly Reviews ──────────────────────────────────────

  getWeeklyReview: async (weekStart: string): Promise<WeeklyReview | null> => {
    try {
      const userId = await getCurrentUserId();
      const { data, error } = await supabase
        .from("weekly_reviews")
        .select("*")
        .eq("user_id", userId)
        .eq("week_start", weekStart)
        .maybeSingle();
      if (error) throw error;
      return data;
    } catch {
      return null;
    }
  },

  saveWeeklyReview: async (
    review: Omit<WeeklyReview, "id" | "user_id" | "created_at" | "updated_at">
  ): Promise<WeeklyReview> => {
    const userId = await getCurrentUserId();
    const { data, error } = await supabase
      .from("weekly_reviews")
      .upsert(
        {
          user_id: userId,
          week_start: review.week_start,
          week_end: review.week_end,
          checklist: review.checklist,
          questions: review.questions,
          inbox_items: review.inbox_items,
          is_completed: review.is_completed,
        },
        { onConflict: "user_id,week_start" }
      )
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  completeWeeklyReview: async (weekStart: string): Promise<WeeklyReview> => {
    const userId = await getCurrentUserId();
    const { data, error } = await supabase
      .from("weekly_reviews")
      .update({
        is_completed: true,
        completed_at: new Date().toISOString(),
      })
      .eq("user_id", userId)
      .eq("week_start", weekStart)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  getReviewStreak: async (): Promise<ReviewStreak> => {
    try {
      const userId = await getCurrentUserId();
      const { data, error } = await supabase
        .from("weekly_reviews")
        .select("week_start")
        .eq("user_id", userId)
        .eq("is_completed", true)
        .order("week_start", { ascending: false });
      if (error) throw error;

      const weekStarts = (data || []).map((r: any) => r.week_start);
      return calculateReviewStreak(weekStarts);
    } catch {
      return { current_streak: 0, longest_streak: 0 };
    }
  },

  getAllReviews: async (): Promise<WeeklyReview[]> => {
    try {
      const userId = await getCurrentUserId();
      const { data, error } = await supabase
        .from("weekly_reviews")
        .select("*")
        .eq("user_id", userId)
        .order("week_start", { ascending: false });
      if (error) throw error;
      return data || [];
    } catch {
      return [];
    }
  },

  // ─── Review Inbox (helper – stays client-side) ──────────

  addToReviewInbox: async (
    item: string,
    timezone: string = Intl.DateTimeFormat().resolvedOptions().timeZone
  ): Promise<boolean> => {
    try {
      // Calculate current week start (Wednesday)
      const now = new Date();
      const dateInTZ = new Date(
        now.toLocaleString("en-US", { timeZone: timezone })
      );
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
      const review = await api.getWeeklyReview(weekStart);

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
