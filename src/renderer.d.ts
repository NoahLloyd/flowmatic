export interface ShortcutsConfig {
  quickAddTask: string;
  quickAddNote: string;
}

export interface InsightsAPI {
  prepare: () => Promise<{ sandbox: string; outputPath: string }>;
  writeData: (files: Record<string, unknown>) => Promise<{ ok: true }>;
  writeSchema: (schemaMd: string) => Promise<{ ok: true }>;
  send: (prompt: string) => Promise<{ ok: true }>;
  cancel: () => Promise<{ ok: true }>;
  resetSession: () => Promise<{ ok: true }>;
  readOutput: () => Promise<string>;
  setSessionId: (sessionId: string | null) => Promise<{ ok: true }>;
  writeOutput: (html: string) => Promise<{ ok: boolean; error?: string }>;
  onStream: (cb: (event: any) => void) => () => void;
  onPreview: (cb: (html: string) => void) => () => void;
  onDone: (cb: (info: { code: number; sessionId: string | null }) => void) => () => void;
  onStderr: (cb: (text: string) => void) => () => void;
  onError: (cb: (msg: string) => void) => () => void;
}

export type AnkiStats =
  | { ok: true; reviewsToday: number; dueRemaining: number | null; lastSync: string | null }
  | { ok: false; error: string };

export interface AnkiAPI {
  readStats: () => Promise<AnkiStats>;
}

export interface IElectronAPI {
  send: (channel: string, data?: any) => void;
  on: (channel: string, func: (...args: any[]) => void) => void;
  removeListener: (channel: string, func: (...args: any[]) => void) => void;
  getShortcuts: () => Promise<ShortcutsConfig>;
  updateShortcuts: (shortcuts: ShortcutsConfig) => Promise<ShortcutsConfig>;
  setDoNotDisturb: (enabled: boolean) => Promise<boolean>;
  insights: InsightsAPI;
  anki: AnkiAPI;
}

declare global {
  interface Window {
    electron: IElectronAPI;
  }
}
