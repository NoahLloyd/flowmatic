import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ArrowUp,
  Loader2,
  Plus,
  RefreshCw,
  Square,
  Terminal,
  History,
  Trash2,
  ChevronRight,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import { supabase, getCurrentUserId } from "../../utils/supabase";

type ChatRole = "user" | "assistant" | "tool";

interface ChatMessage {
  id: string;
  role: ChatRole;
  text: string;
  toolName?: string;
  toolInput?: string;
}

interface RunStats {
  startedAt: number;
  toolCalls: number;
  streamedChars: number;
  events: number;
  inputTokens: number | null;
  outputTokens: number | null;
  lastToolName: string | null;
  lastEventType: string | null;
}

interface StoredSession {
  id: string;
  claudeSessionId: string | null;
  title: string;
  messages: ChatMessage[];
  outputHtml: string | null;
  createdAt: number;
  updatedAt: number;
}

interface RemoteChatRow {
  local_id: string;
  claude_session_id: string | null;
  title: string;
  messages: ChatMessage[];
  output_html: string | null;
  created_at: string;
  updated_at: string;
}

const SCHEMA_MD = `# Flowmatic schema (field reference)

## sessions
- id, user_id, created_at, minutes, focus (1-5), notes, task_title

## signals (one row per day)
- id, user_id, date (YYYY-MM-DD), signals (jsonb): {signalKey: number|boolean}
  Examples: wokeUpEarly (bool), minutesToOffice (number), exercise (bool), pushUps (number), journalingValue (derived)

## tasks
- id, user_id, title, type ("day" | "week" | "future" | "blocked" | "shopping"), completed (bool), completed_at, created_at

## writings (morning journal)
- id, user_id, date, entry_type, content, created_at

## weekly_reviews
- id, user_id, week_start (date), content (jsonb)

## notes
- id, user_id, content, created_at

## profiles
- id, email, preferences (jsonb): { activeSignals[], signalGoals{}, signalPercentageGoal, dailyHoursGoals{}, timezone, ... }

## garmin.json (optional — only present if the Garmin sync script has been run)
Top-level: { days: [], workouts: [], last_sync: string }

### days[] (one entry per date)
- date (YYYY-MM-DD)
- sleep: { total_minutes, deep_minutes, rem_minutes, light_minutes, awake_minutes, score (0-100), overnight_hrv, respiration_avg }
- hrv: { overnight_avg (ms), seven_day_avg, status ("balanced" | "unbalanced" | "low" | ...) }
- stress: { avg (0-100), max, rest_minutes, high_minutes }
- body_battery: { high (0-100), low }
- steps, distance_km, active_minutes, resting_hr, calories_active

### workouts[]
- date, type (e.g. "running", "cycling"), name, duration_min, distance_km, avg_hr, max_hr, calories, training_effect

## anki.json (optional — Anki flashcard review stats)
Top-level: { days: [], last_sync, profile }
### days[] (only dates with reviews)
- date, reviews (count), time_minutes, new_cards, again_count, relearn_count, retention_pct (0-100)

## github.json (optional — GitHub contribution activity)
Top-level: { login, days: [], yearly: [], top_repos: [], last_sync }
### days[] (one per date, includes zero days)
- date, contributions (combined count: commits + PRs + reviews + issues that show on the profile calendar)
### yearly[]
- { from, to, total, commits, prs, reviews, issues } for each ~year-long window
### top_repos[]
- { name, commits } — top repos by commits across the fetched range
`;

const MIN_CHAT_WIDTH = 320;
const MIN_PREVIEW_WIDTH = 320;
const DEFAULT_CHAT_RATIO = 0.4;
const CHAT_WIDTH_KEY = "insights:chatWidth";
const SESSIONS_KEY = "insights:sessions";
const MAX_SESSIONS = 50;
const MAX_MESSAGES_PER_CHAT = 500;
const REMOTE_SAVE_DEBOUNCE_MS = 2000;

const genId = () =>
  `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

const formatElapsed = (ms: number) => {
  const s = Math.floor(ms / 1000);
  const mm = Math.floor(s / 60)
    .toString()
    .padStart(2, "0");
  const ss = (s % 60).toString().padStart(2, "0");
  return `${mm}:${ss}`;
};

const formatRelative = (ms: number) => {
  const d = Date.now() - ms;
  if (d < 60_000) return "just now";
  if (d < 3_600_000) return `${Math.floor(d / 60_000)}m ago`;
  if (d < 86_400_000) return `${Math.floor(d / 3_600_000)}h ago`;
  if (d < 7 * 86_400_000) return `${Math.floor(d / 86_400_000)}d ago`;
  return new Date(ms).toLocaleDateString();
};

const loadSessions = (): StoredSession[] => {
  try {
    const raw = localStorage.getItem(SESSIONS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // Normalize entries from older schema versions.
    return parsed.map((s: any) => ({
      id: s.id,
      claudeSessionId: s.claudeSessionId ?? null,
      title: s.title ?? "New chat",
      messages: Array.isArray(s.messages) ? s.messages : [],
      outputHtml: s.outputHtml ?? null,
      createdAt: s.createdAt ?? Date.now(),
      updatedAt: s.updatedAt ?? Date.now(),
    }));
  } catch {
    return [];
  }
};

const saveSessions = (sessions: StoredSession[]) => {
  try {
    localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions));
  } catch {
    /* quota exceeded — best effort */
  }
};

const truncateMessages = (msgs: ChatMessage[]): ChatMessage[] =>
  msgs.length <= MAX_MESSAGES_PER_CHAT
    ? msgs
    : msgs.slice(msgs.length - MAX_MESSAGES_PER_CHAT);

const rowToSession = (r: RemoteChatRow): StoredSession => ({
  id: r.local_id,
  claudeSessionId: r.claude_session_id,
  title: r.title,
  messages: Array.isArray(r.messages) ? r.messages : [],
  outputHtml: r.output_html,
  createdAt: new Date(r.created_at).getTime(),
  updatedAt: new Date(r.updated_at).getTime(),
});

const fetchRemoteSessions = async (): Promise<StoredSession[]> => {
  try {
    const userId = await getCurrentUserId();
    if (!userId) return [];
    const { data, error } = await supabase
      .from("insights_chats")
      .select("*")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false })
      .limit(MAX_SESSIONS);
    if (error) throw error;
    return (data || []).map(rowToSession);
  } catch {
    return [];
  }
};

const upsertRemoteSession = async (s: StoredSession) => {
  try {
    const userId = await getCurrentUserId();
    if (!userId) return;
    await supabase.from("insights_chats").upsert(
      {
        user_id: userId,
        local_id: s.id,
        claude_session_id: s.claudeSessionId,
        title: s.title,
        messages: truncateMessages(s.messages),
        output_html: s.outputHtml,
        updated_at: new Date(s.updatedAt).toISOString(),
      },
      { onConflict: "user_id,local_id" }
    );
  } catch {
    /* network or RLS — next flush will retry */
  }
};

const deleteRemoteSession = async (localId: string) => {
  try {
    const userId = await getCurrentUserId();
    if (!userId) return;
    await supabase
      .from("insights_chats")
      .delete()
      .eq("user_id", userId)
      .eq("local_id", localId);
  } catch {
    /* best effort */
  }
};

const AIInsights: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [running, setRunning] = useState(false);
  const [previewHtml, setPreviewHtml] = useState("");
  const [dataLoaded, setDataLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<RunStats | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [chatWidth, setChatWidth] = useState<number | null>(null);
  const [isResizing, setIsResizing] = useState(false);

  const [sessions, setSessions] = useState<StoredSession[]>(() =>
    loadSessions()
  );
  const [currentSessionLocalId, setCurrentSessionLocalId] = useState<
    string | null
  >(null);
  const [currentClaudeSessionId, setCurrentClaudeSessionId] = useState<
    string | null
  >(null);
  const [historyOpen, setHistoryOpen] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const currentAssistantIdRef = useRef<string | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const historyBtnRef = useRef<HTMLButtonElement>(null);
  const historyPanelRef = useRef<HTMLDivElement>(null);
  const insightsApi = (window as any).electron?.insights;

  const claudeSessionIdRef = useRef<string | null>(null);
  claudeSessionIdRef.current = currentClaudeSessionId;

  // Debounced remote save — one timer per chat.
  const saveTimersRef = useRef<Map<string, number>>(new Map());
  const scheduleRemoteSave = useCallback((s: StoredSession) => {
    const existing = saveTimersRef.current.get(s.id);
    if (existing) clearTimeout(existing);
    const t = window.setTimeout(() => {
      saveTimersRef.current.delete(s.id);
      upsertRemoteSession(s);
    }, REMOTE_SAVE_DEBOUNCE_MS);
    saveTimersRef.current.set(s.id, t);
  }, []);

  // Flush pending saves on page unload.
  useEffect(() => {
    const handler = () => {
      for (const [, t] of saveTimersRef.current) clearTimeout(t);
      saveTimersRef.current.clear();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, []);

  // -------- Layout: resizable splitter --------
  useLayoutEffect(() => {
    const saved = Number(localStorage.getItem(CHAT_WIDTH_KEY));
    if (saved && Number.isFinite(saved) && saved >= MIN_CHAT_WIDTH) {
      setChatWidth(saved);
      return;
    }
    const el = containerRef.current;
    if (el) {
      const initial = Math.max(
        MIN_CHAT_WIDTH,
        Math.round(el.clientWidth * DEFAULT_CHAT_RATIO)
      );
      setChatWidth(initial);
    }
  }, []);

  useEffect(() => {
    if (!isResizing) return;
    const onMove = (e: MouseEvent) => {
      const el = containerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const rawWidth = e.clientX - rect.left;
      const maxWidth = rect.width - MIN_PREVIEW_WIDTH;
      const next = Math.min(
        Math.max(rawWidth, MIN_CHAT_WIDTH),
        Math.max(MIN_CHAT_WIDTH, maxWidth)
      );
      setChatWidth(next);
    };
    const onUp = () => {
      setIsResizing(false);
      if (chatWidth != null) {
        localStorage.setItem(CHAT_WIDTH_KEY, String(chatWidth));
      }
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isResizing, chatWidth]);

  // -------- Textarea auto-grow + autofocus --------
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${Math.min(ta.scrollHeight, 200)}px`;
  }, [input]);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  // -------- History popover outside-click --------
  useEffect(() => {
    if (!historyOpen) return;
    const onDown = (e: MouseEvent) => {
      const panel = historyPanelRef.current;
      const btn = historyBtnRef.current;
      if (!panel) return;
      if (
        e.target instanceof Node &&
        !panel.contains(e.target) &&
        !(btn && btn.contains(e.target))
      ) {
        setHistoryOpen(false);
      }
    };
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, [historyOpen]);

  // -------- Supabase → sandbox data --------
  const refreshData = useCallback(async () => {
    if (!insightsApi) return;
    setError(null);
    try {
      const userId = await getCurrentUserId();
      const fetchTable = async (
        table: string,
        order: string | null = "created_at"
      ) => {
        let q = supabase.from(table).select("*").eq("user_id", userId);
        if (order) q = q.order(order, { ascending: false }).limit(5000);
        const { data, error } = await q;
        if (error) throw error;
        return data || [];
      };
      const [profile, sessionsData, signals, tasks, writings, weekly, notes] =
        await Promise.all([
          supabase.from("profiles").select("*").eq("id", userId).single(),
          fetchTable("sessions"),
          fetchTable("signals", "date"),
          fetchTable("tasks"),
          fetchTable("writings", "date"),
          fetchTable("weekly_reviews", "week_start"),
          fetchTable("notes"),
        ]);
      await insightsApi.writeData({
        "profile.json": profile.data,
        "sessions.json": sessionsData,
        "signals.json": signals,
        "tasks.json": tasks,
        "writings.json": writings,
        "weekly_reviews.json": weekly,
        "notes.json": notes,
      });
      await insightsApi.writeSchema(SCHEMA_MD);
      setDataLoaded(true);
    } catch (e: any) {
      setError(`Failed to refresh data: ${e?.message || e}`);
    }
  }, [insightsApi]);

  // -------- IPC wiring --------
  useEffect(() => {
    if (!insightsApi) return;
    let cancelled = false;
    (async () => {
      await insightsApi.prepare();
      const html = await insightsApi.readOutput();
      if (!cancelled) setPreviewHtml(html);
      await refreshData();
    })();
    const offPreview = insightsApi.onPreview((html: string) => {
      setPreviewHtml(html);
    });
    const offStream = insightsApi.onStream((ev: any) => {
      handleStreamEvent(ev);
    });
    const offDone = insightsApi.onDone(
      (info: { code: number; sessionId: string | null }) => {
        setRunning(false);
        currentAssistantIdRef.current = null;
        if (info?.sessionId) {
          setCurrentClaudeSessionId(info.sessionId);
        }
        if (info?.code !== 0 && info?.code !== null) {
          setError((prev) => {
            const line = `claude exited with code ${info.code}`;
            return prev ? `${prev}\n${line}` : line;
          });
        }
      }
    );
    const offErr = insightsApi.onError((msg: string) => {
      setError(msg);
      setRunning(false);
    });
    const offStderr = insightsApi.onStderr((text: string) => {
      setError((prev) => (prev ? `${prev}${text}` : text));
    });
    return () => {
      cancelled = true;
      offPreview?.();
      offStream?.();
      offDone?.();
      offErr?.();
      offStderr?.();
    };
  }, [insightsApi, refreshData]);

  // -------- Scroll + elapsed timer --------
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (!running || !stats) return;
    const id = window.setInterval(() => {
      setElapsedMs(Date.now() - stats.startedAt);
    }, 250);
    return () => window.clearInterval(id);
  }, [running, stats]);

  // -------- Persist sessions when messages change --------
  useEffect(() => {
    if (!currentSessionLocalId) return;
    setSessions((prev) => {
      const idx = prev.findIndex((s) => s.id === currentSessionLocalId);
      if (idx === -1) return prev;
      const existing = prev[idx];
      const firstUserMsg = messages.find((m) => m.role === "user");
      const title = firstUserMsg
        ? firstUserMsg.text.slice(0, 60)
        : existing.title;
      const updated: StoredSession = {
        ...existing,
        messages,
        title,
        claudeSessionId: claudeSessionIdRef.current,
        updatedAt: Date.now(),
      };
      const next = [...prev];
      next[idx] = updated;
      next.sort((a, b) => b.updatedAt - a.updatedAt);
      saveSessions(next);
      scheduleRemoteSave(updated);
      return next;
    });
  }, [messages, currentSessionLocalId, scheduleRemoteSave]);

  // Track outputHtml per current chat so the preview restores with history.
  useEffect(() => {
    if (!currentSessionLocalId || !previewHtml) return;
    setSessions((prev) => {
      const idx = prev.findIndex((s) => s.id === currentSessionLocalId);
      if (idx === -1) return prev;
      if (prev[idx].outputHtml === previewHtml) return prev;
      const updated: StoredSession = {
        ...prev[idx],
        outputHtml: previewHtml,
        updatedAt: Date.now(),
      };
      const next = [...prev];
      next[idx] = updated;
      saveSessions(next);
      scheduleRemoteSave(updated);
      return next;
    });
  }, [previewHtml, currentSessionLocalId, scheduleRemoteSave]);

  // Also persist when claudeSessionId changes for current chat.
  useEffect(() => {
    if (!currentSessionLocalId) return;
    setSessions((prev) => {
      const idx = prev.findIndex((s) => s.id === currentSessionLocalId);
      if (idx === -1) return prev;
      const updated: StoredSession = {
        ...prev[idx],
        claudeSessionId: currentClaudeSessionId,
        updatedAt: Date.now(),
      };
      const next = [...prev];
      next[idx] = updated;
      saveSessions(next);
      scheduleRemoteSave(updated);
      return next;
    });
  }, [currentClaudeSessionId, currentSessionLocalId, scheduleRemoteSave]);

  // -------- Hydrate from Supabase on mount --------
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const remote = await fetchRemoteSessions();
      if (cancelled) return;
      setSessions((prevLocal) => {
        const byId = new Map<string, StoredSession>();
        for (const r of remote) byId.set(r.id, r);
        // Remote wins if newer; otherwise keep local.
        for (const l of prevLocal) {
          const existing = byId.get(l.id);
          if (!existing || l.updatedAt > existing.updatedAt) {
            byId.set(l.id, l);
          }
        }
        const merged = Array.from(byId.values())
          .sort((a, b) => b.updatedAt - a.updatedAt)
          .slice(0, MAX_SESSIONS);
        saveSessions(merged);
        // Push any local-only chats to remote (one-shot).
        const remoteIds = new Set(remote.map((r) => r.id));
        for (const l of prevLocal) {
          if (!remoteIds.has(l.id)) upsertRemoteSession(l);
        }
        return merged;
      });
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // -------- Stream handling --------
  const upsertAssistant = (text: string) => {
    const id = currentAssistantIdRef.current;
    if (id) {
      setMessages((prev) =>
        prev.map((m) => (m.id === id ? { ...m, text: m.text + text } : m))
      );
    } else {
      const newId = `a_${genId()}`;
      currentAssistantIdRef.current = newId;
      setMessages((prev) => [...prev, { id: newId, role: "assistant", text }]);
    }
    setStats((s) =>
      s ? { ...s, streamedChars: s.streamedChars + text.length } : s
    );
  };

  const appendMessage = (msg: Omit<ChatMessage, "id">) => {
    const id = `m_${genId()}`;
    setMessages((prev) => [...prev, { ...msg, id }]);
  };

  const handleStreamEvent = (ev: any) => {
    if (!ev || typeof ev !== "object") return;
    const type = ev.type;
    if (type === "raw") return; // debug log, not a real event
    setStats((s) =>
      s
        ? {
            ...s,
            events: s.events + 1,
            lastEventType: type || s.lastEventType,
          }
        : s
    );
    if (type === "system" && ev.subtype === "init" && ev.session_id) {
      setCurrentClaudeSessionId(ev.session_id);
      return;
    }
    if (type === "stream_event") {
      const e = ev.event;
      if (e?.type === "content_block_delta" && e.delta?.text) {
        upsertAssistant(e.delta.text);
      } else if (e?.type === "content_block_stop") {
        currentAssistantIdRef.current = null;
      }
    } else if (type === "assistant" && ev.message?.content) {
      const blocks = ev.message.content as any[];
      for (const b of blocks) {
        if (b.type === "tool_use") {
          currentAssistantIdRef.current = null;
          const preview =
            typeof b.input === "object"
              ? JSON.stringify(b.input, null, 2).slice(0, 4000)
              : String(b.input ?? "").slice(0, 4000);
          appendMessage({
            role: "tool",
            text: preview,
            toolName: b.name || "tool",
            toolInput: preview,
          });
          setStats((s) =>
            s
              ? {
                  ...s,
                  toolCalls: s.toolCalls + 1,
                  lastToolName: b.name || "tool",
                }
              : s
          );
        }
      }
    } else if (type === "result") {
      currentAssistantIdRef.current = null;
      const usage = ev.usage || {};
      setStats((s) =>
        s
          ? {
              ...s,
              inputTokens:
                (usage.input_tokens ?? usage.cache_read_input_tokens ?? 0) ||
                s.inputTokens,
              outputTokens: usage.output_tokens ?? s.outputTokens,
            }
          : s
      );
    }
  };

  // -------- Actions --------
  const ensureSession = () => {
    if (currentSessionLocalId) return currentSessionLocalId;
    const id = `s_${genId()}`;
    const now = Date.now();
    const entry: StoredSession = {
      id,
      claudeSessionId: null,
      title: "New chat",
      messages: [],
      outputHtml: null,
      createdAt: now,
      updatedAt: now,
    };
    setSessions((prev) => {
      const next = [entry, ...prev].slice(0, MAX_SESSIONS);
      saveSessions(next);
      return next;
    });
    setCurrentSessionLocalId(id);
    return id;
  };

  const send = async () => {
    const text = input.trim();
    if (!text || running || !insightsApi) return;
    setError(null);
    ensureSession();
    appendMessage({ role: "user", text });
    setInput("");
    setRunning(true);
    currentAssistantIdRef.current = null;
    setStats({
      startedAt: Date.now(),
      toolCalls: 0,
      streamedChars: 0,
      events: 0,
      inputTokens: null,
      outputTokens: null,
      lastToolName: null,
      lastEventType: null,
    });
    setElapsedMs(0);
    requestAnimationFrame(() => textareaRef.current?.focus());
    try {
      await insightsApi.send(text);
    } catch (e: any) {
      setError(e?.message || String(e));
      setRunning(false);
    }
  };

  const cancel = async () => {
    await insightsApi?.cancel();
    setRunning(false);
  };

  const newChat = async () => {
    await insightsApi?.resetSession();
    setMessages([]);
    setStats(null);
    setCurrentSessionLocalId(null);
    setCurrentClaudeSessionId(null);
    currentAssistantIdRef.current = null;
    const html = await insightsApi?.readOutput();
    if (html) setPreviewHtml(html);
    setHistoryOpen(false);
    requestAnimationFrame(() => textareaRef.current?.focus());
  };

  const loadChat = async (sessionId: string) => {
    const session = sessions.find((s) => s.id === sessionId);
    if (!session) return;
    await insightsApi?.cancel();
    await insightsApi?.setSessionId(session.claudeSessionId);
    setMessages(session.messages);
    setCurrentSessionLocalId(session.id);
    setCurrentClaudeSessionId(session.claudeSessionId);
    setStats(null);
    currentAssistantIdRef.current = null;
    // Restore preview — both the iframe AND the sandbox file so Claude sees
    // the previous output.html if the chat is resumed.
    if (session.outputHtml) {
      setPreviewHtml(session.outputHtml);
      insightsApi?.writeOutput(session.outputHtml);
    } else {
      // Older chats saved before outputHtml tracking — clear the iframe so
      // we don't show a stale preview from a different chat.
      const placeholder =
        '<!doctype html><html><body style="background:#0b0f19;color:#6b7280;font-family:system-ui;padding:24px">No saved preview for this chat. Send a follow-up to regenerate.</body></html>';
      setPreviewHtml(placeholder);
      insightsApi?.writeOutput(placeholder);
    }
    setHistoryOpen(false);
    requestAnimationFrame(() => textareaRef.current?.focus());
  };

  const deleteChat = (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    // Cancel any pending remote save for this chat.
    const t = saveTimersRef.current.get(sessionId);
    if (t) {
      clearTimeout(t);
      saveTimersRef.current.delete(sessionId);
    }
    setSessions((prev) => {
      const next = prev.filter((s) => s.id !== sessionId);
      saveSessions(next);
      return next;
    });
    deleteRemoteSession(sessionId);
    if (sessionId === currentSessionLocalId) {
      setMessages([]);
      setCurrentSessionLocalId(null);
      setCurrentClaudeSessionId(null);
      insightsApi?.setSessionId(null);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  // -------- Render helpers --------
  const renderedMessages = useMemo(() => messages, [messages]);

  if (!insightsApi) {
    return (
      <div className="text-sm text-gray-500 dark:text-gray-400">
        AI Insights requires the desktop app (Electron bridge not available).
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="flex w-full h-full min-h-0"
    >
      {/* Chat column */}
      <div
        className="flex flex-col min-h-0 border-r border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 relative"
        style={{ width: chatWidth ?? "40%" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between h-11 px-3 border-b border-gray-200 dark:border-gray-800">
          <div className="flex items-center gap-2 min-w-0">
            <button
              ref={historyBtnRef}
              onClick={() => setHistoryOpen((v) => !v)}
              className={`p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-800 ${
                historyOpen
                  ? "bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                  : "text-gray-500 dark:text-gray-400"
              }`}
              title="History"
            >
              <History className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={newChat}
              className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400"
              title="New chat"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
            <span className="text-[13px] font-medium text-gray-900 dark:text-gray-100 truncate">
              {(() => {
                const s = sessions.find((x) => x.id === currentSessionLocalId);
                return s?.title || "Ask Claude";
              })()}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <span
              className={`text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded border ${
                dataLoaded
                  ? "border-emerald-500/30 text-emerald-600 dark:text-emerald-400"
                  : "border-gray-300 dark:border-gray-700 text-gray-500"
              }`}
              title={dataLoaded ? "Data synced" : "Loading data..."}
            >
              {dataLoaded ? "synced" : "loading"}
            </span>
            <button
              onClick={refreshData}
              className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400"
              title="Re-export data from Supabase"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* History popover */}
        {historyOpen && (
          <div
            ref={historyPanelRef}
            className="absolute left-2 top-12 z-20 w-80 max-h-[70vh] overflow-y-auto rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-xl"
          >
            {sessions.length === 0 ? (
              <div className="text-[12px] text-gray-500 dark:text-gray-500 px-3 py-4 text-center">
                No chats yet.
              </div>
            ) : (
              <div className="py-1">
                {sessions.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => loadChat(s.id)}
                    className={`group w-full flex items-start gap-2 px-3 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-800 ${
                      s.id === currentSessionLocalId
                        ? "bg-indigo-500/5"
                        : ""
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] text-gray-900 dark:text-gray-100 truncate">
                        {s.title}
                      </div>
                      <div className="text-[11px] text-gray-500 dark:text-gray-500 flex items-center gap-2 mt-0.5">
                        <span>{formatRelative(s.updatedAt)}</span>
                        <span>
                          {s.messages.filter((m) => m.role === "user").length}{" "}
                          msg
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={(e) => deleteChat(s.id, e)}
                      className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-500/10 text-gray-400 hover:text-red-500"
                      title="Delete"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Messages */}
        <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4 space-y-4">
          {renderedMessages.length === 0 && (
            <div className="text-[13px] text-gray-500 dark:text-gray-400 leading-relaxed space-y-3 max-w-md">
              <p>
                Claude Code runs locally in a sandbox with JSON dumps of your
                Supabase tables. It can call{" "}
                <code className="text-[12px] text-indigo-600 dark:text-indigo-400">
                  jq
                </code>
                ,{" "}
                <code className="text-[12px] text-indigo-600 dark:text-indigo-400">
                  node
                </code>
                , or write a self-contained{" "}
                <code className="text-[12px] text-indigo-600 dark:text-indigo-400">
                  output.html
                </code>{" "}
                rendered beside this chat.
              </p>
              <div>
                <p className="text-gray-600 dark:text-gray-300 mb-2">
                  Starter questions
                </p>
                <div className="space-y-1">
                  {[
                    "Plot my focus hours per day for the last 60 days",
                    "Which signals correlate most with ≥4h days?",
                    "Show my wake-time distribution vs focus score",
                  ].map((q) => (
                    <button
                      key={q}
                      onClick={() => setInput(q)}
                      className="block w-full text-left text-[12px] px-3 py-2 rounded border border-gray-200 dark:border-gray-800 hover:border-indigo-400 dark:hover:border-indigo-600 hover:bg-indigo-50/30 dark:hover:bg-indigo-500/5 text-gray-700 dark:text-gray-300"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
          {renderedMessages.map((m) => (
            <MessageItem key={m.id} msg={m} />
          ))}
          {running && !currentAssistantIdRef.current && (
            <div className="flex items-center gap-2 text-[12px] text-gray-500 dark:text-gray-400">
              <Loader2 className="w-3 h-3 animate-spin" />
              <span>
                {stats?.lastToolName
                  ? `running ${stats.lastToolName}…`
                  : "thinking…"}
              </span>
            </div>
          )}
          {error && (
            <div className="text-[12px] px-3 py-2 rounded border border-red-500/30 bg-red-500/5 text-red-600 dark:text-red-400 whitespace-pre-wrap">
              {error}
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        {/* Status bar */}
        {(running || stats) && (
          <div className="flex items-center gap-3 h-7 px-4 border-t border-gray-200 dark:border-gray-800 text-[11px] font-mono text-gray-500 dark:text-gray-500">
            <span className="flex items-center gap-1">
              <span
                className={`inline-block w-1.5 h-1.5 rounded-full ${
                  running
                    ? "bg-emerald-500 animate-pulse"
                    : "bg-gray-400 dark:bg-gray-600"
                }`}
              />
              {formatElapsed(elapsedMs)}
            </span>
            <span>{stats?.events ?? 0} evt</span>
            <span>
              {stats?.toolCalls ?? 0} tool{stats?.toolCalls === 1 ? "" : "s"}
            </span>
            <span>{(stats?.streamedChars ?? 0).toLocaleString()} chars</span>
            {stats?.outputTokens != null && (
              <span>{stats.outputTokens.toLocaleString()} tok</span>
            )}
            {stats?.lastEventType && (
              <span className="ml-auto text-gray-400 dark:text-gray-600 truncate">
                {stats.lastEventType}
              </span>
            )}
          </div>
        )}

        {/* Input */}
        <div className="border-t border-gray-200 dark:border-gray-800 p-3">
          <div className="relative flex items-end gap-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl px-3 py-2 focus-within:border-indigo-400 dark:focus-within:border-indigo-600 transition-colors">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              rows={1}
              placeholder={
                running
                  ? "Running… (Enter blocked)"
                  : "Ask anything about your data…"
              }
              className="flex-1 resize-none bg-transparent text-[13px] leading-6 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-600 focus:outline-none max-h-[200px]"
            />
            {running ? (
              <button
                onClick={cancel}
                className="flex-shrink-0 w-7 h-7 rounded-full bg-gray-900 dark:bg-gray-100 hover:bg-gray-700 dark:hover:bg-white text-white dark:text-gray-900 flex items-center justify-center"
                title="Stop"
              >
                <Square className="w-3 h-3 fill-current" />
              </button>
            ) : (
              <button
                onClick={send}
                disabled={!input.trim()}
                className="flex-shrink-0 w-7 h-7 rounded-full bg-indigo-500 hover:bg-indigo-600 disabled:bg-gray-300 dark:disabled:bg-gray-800 disabled:cursor-not-allowed text-white flex items-center justify-center transition-colors"
                title="Send (Enter)"
              >
                <ArrowUp className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Resize handle */}
      <div
        onMouseDown={(e) => {
          e.preventDefault();
          setIsResizing(true);
        }}
        className={`relative flex-shrink-0 w-px cursor-col-resize bg-gray-200 dark:bg-gray-800 hover:bg-indigo-400 dark:hover:bg-indigo-600 transition-colors ${
          isResizing ? "!bg-indigo-500" : ""
        }`}
        style={{ touchAction: "none" }}
        title="Drag to resize"
      >
        <div className="absolute inset-y-0 -left-2 -right-2 cursor-col-resize" />
      </div>

      {isResizing && (
        <div
          className="fixed inset-0 z-50"
          style={{ cursor: "col-resize" }}
        />
      )}

      {/* Preview column */}
      <div className="flex-1 min-w-0 flex flex-col min-h-0 bg-white dark:bg-gray-950">
        <div className="flex items-center gap-2 h-11 px-4 border-b border-gray-200 dark:border-gray-800">
          <Terminal className="w-3.5 h-3.5 text-gray-500 dark:text-gray-400" />
          <span className="text-[13px] font-medium text-gray-900 dark:text-gray-100">
            Preview
          </span>
          <span className="text-[11px] font-mono text-gray-400 dark:text-gray-600 ml-1">
            output.html
          </span>
        </div>
        <iframe
          srcDoc={previewHtml}
          className="flex-1 w-full bg-[#0b0f19] border-0"
          title="Insights preview"
        />
      </div>
    </div>
  );
};

// -------- Message rendering --------

const MessageItem: React.FC<{ msg: ChatMessage }> = ({ msg }) => {
  if (msg.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-indigo-500 text-white px-3.5 py-2 text-[13px] leading-relaxed whitespace-pre-wrap">
          {msg.text}
        </div>
      </div>
    );
  }
  if (msg.role === "tool") {
    return <ToolCallItem msg={msg} />;
  }
  return <AssistantMarkdown text={msg.text} />;
};

const ToolCallItem: React.FC<{ msg: ChatMessage }> = ({ msg }) => {
  const [open, setOpen] = useState(false);
  const parsed = useMemo(() => {
    try {
      return JSON.parse(msg.toolInput || msg.text);
    } catch {
      return null;
    }
  }, [msg.toolInput, msg.text]);
  const summary = useMemo(() => {
    if (!parsed || typeof parsed !== "object") {
      const t = (msg.toolInput || msg.text).replace(/\s+/g, " ").trim();
      return t.length > 80 ? t.slice(0, 80) + "…" : t;
    }
    // Smart summaries for common tools
    if (msg.toolName === "Read" && parsed.file_path)
      return shortPath(parsed.file_path);
    if (msg.toolName === "Write" && parsed.file_path)
      return shortPath(parsed.file_path);
    if (msg.toolName === "Edit" && parsed.file_path)
      return shortPath(parsed.file_path);
    if (msg.toolName === "Bash" && parsed.command)
      return String(parsed.command).split("\n")[0].slice(0, 80);
    if (msg.toolName === "Glob" && parsed.pattern) return parsed.pattern;
    if (msg.toolName === "Grep" && parsed.pattern) return parsed.pattern;
    const keys = Object.keys(parsed);
    return keys.length ? keys.map((k) => k).join(", ") : "";
  }, [parsed, msg.toolName, msg.toolInput, msg.text]);

  return (
    <div className="text-[11px] font-mono text-gray-500 dark:text-gray-500">
      <button
        onClick={() => setOpen((v) => !v)}
        className="group flex items-start gap-1.5 w-full text-left hover:text-gray-700 dark:hover:text-gray-300"
      >
        <ChevronRight
          className={`w-3 h-3 mt-0.5 flex-shrink-0 transition-transform ${
            open ? "rotate-90" : ""
          }`}
        />
        <span className="text-indigo-500 dark:text-indigo-400 flex-shrink-0">
          {msg.toolName}
        </span>
        <span className="truncate opacity-70">{summary}</span>
      </button>
      {open && (
        <pre className="mt-1 ml-4 px-2 py-1.5 rounded bg-gray-100 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 whitespace-pre-wrap break-all text-[11px] text-gray-700 dark:text-gray-300 max-h-64 overflow-auto">
          {msg.toolInput || msg.text}
        </pre>
      )}
    </div>
  );
};

const shortPath = (p: string) => {
  const parts = p.split("/");
  if (parts.length <= 3) return p;
  return ".../" + parts.slice(-2).join("/");
};

const AssistantMarkdown: React.FC<{ text: string }> = ({ text }) => {
  return (
    <div className="prose-insights text-[13px] leading-relaxed text-gray-800 dark:text-gray-200">
      <ReactMarkdown
        components={{
          p: ({ node: _node, ...props }) => (
            <p className="mb-2 last:mb-0" {...props} />
          ),
          strong: ({ node: _node, ...props }) => (
            <strong
              className="font-semibold text-gray-900 dark:text-white"
              {...props}
            />
          ),
          em: ({ node: _node, ...props }) => (
            <em className="italic" {...props} />
          ),
          h1: ({ node: _node, ...props }) => (
            <h1
              className="text-[15px] font-semibold text-gray-900 dark:text-white mt-3 mb-2"
              {...props}
            />
          ),
          h2: ({ node: _node, ...props }) => (
            <h2
              className="text-[14px] font-semibold text-gray-900 dark:text-white mt-3 mb-1.5"
              {...props}
            />
          ),
          h3: ({ node: _node, ...props }) => (
            <h3
              className="text-[13px] font-semibold text-gray-900 dark:text-white mt-2 mb-1"
              {...props}
            />
          ),
          ul: ({ node: _node, ...props }) => (
            <ul
              className="list-disc pl-5 my-2 space-y-0.5 marker:text-gray-400 dark:marker:text-gray-600"
              {...props}
            />
          ),
          ol: ({ node: _node, ...props }) => (
            <ol
              className="list-decimal pl-5 my-2 space-y-0.5 marker:text-gray-400 dark:marker:text-gray-600"
              {...props}
            />
          ),
          li: ({ node: _node, ...props }) => (
            <li className="leading-relaxed" {...props} />
          ),
          code: ({ node: _node, className, children, ...props }: any) => {
            const inline = !className;
            if (inline) {
              return (
                <code
                  className="px-1 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-[12px] text-indigo-600 dark:text-indigo-400 font-mono"
                  {...props}
                >
                  {children}
                </code>
              );
            }
            return (
              <code
                className="block px-3 py-2 rounded bg-gray-100 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-[12px] font-mono overflow-x-auto"
                {...props}
              >
                {children}
              </code>
            );
          },
          pre: ({ node: _node, children, ...props }: any) => (
            <pre className="my-2" {...props}>
              {children}
            </pre>
          ),
          blockquote: ({ node: _node, ...props }) => (
            <blockquote
              className="border-l-2 border-gray-300 dark:border-gray-700 pl-3 my-2 text-gray-600 dark:text-gray-400"
              {...props}
            />
          ),
          a: ({ node: _node, ...props }) => (
            <a
              className="text-indigo-600 dark:text-indigo-400 underline hover:text-indigo-700"
              target="_blank"
              rel="noopener noreferrer"
              {...props}
            />
          ),
          table: ({ node: _node, ...props }) => (
            <div className="my-2 overflow-x-auto">
              <table
                className="border-collapse text-[12px] w-full"
                {...props}
              />
            </div>
          ),
          th: ({ node: _node, ...props }) => (
            <th
              className="border border-gray-300 dark:border-gray-700 px-2 py-1 text-left bg-gray-100 dark:bg-gray-900 font-semibold"
              {...props}
            />
          ),
          td: ({ node: _node, ...props }) => (
            <td
              className="border border-gray-300 dark:border-gray-700 px-2 py-1"
              {...props}
            />
          ),
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
};

export default AIInsights;
