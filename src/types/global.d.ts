declare module "components/*";
declare module "pages/*";
declare module "utils/*";

// Add the electron API types
interface Window {
  electron: {
    send: (channel: string, data?: any) => void;
    on: (channel: string, func: (...args: any[]) => void) => number;
    removeListener: (channel: string, idOrFunc: number | ((...args: any[]) => void)) => void;
    getShortcuts: () => Promise<{ quickAddTask: string; quickAddNote: string }>;
    updateShortcuts: (shortcuts: {
      quickAddTask: string;
      quickAddNote: string;
    }) => Promise<{ quickAddTask: string; quickAddNote: string }>;
    setDoNotDisturb: (enabled: boolean) => Promise<boolean>;
    requestShortcutsAccess: () => Promise<string>;
    anki?: {
      readStats: () => Promise<
        | { ok: true; reviewsToday: number; dueRemaining: number | null; lastSync: string | null }
        | { ok: false; error: string }
      >;
    };
    obsidian?: {
      readTasks: () => Promise<
        | {
            ok: true;
            data: {
              vault: string;
              vault_abs: string;
              tasks: Array<{
                file: string;
                line: number;
                indent: number;
                raw_text: string;
                text_hash: string;
                display: string;
                tags: string[];
                due_date: string | null;
                scheduled_date: string | null;
                priority: string | null;
              }>;
              last_sync: string;
            };
          }
        | { ok: false; error: string }
      >;
      markComplete: (args: {
        vaultAbs: string;
        file: string;
        textHash: string;
      }) => Promise<
        { ok: true; line: number } | { ok: false; error: string }
      >;
      checkAccess: () => Promise<
        | { ok: true; path: string; fileCount: number; mdCount: number }
        | {
            ok: false;
            path: string;
            code: string;
            error: string;
            stage: "documents" | "vault";
          }
      >;
      openPrivacySettings: () => Promise<
        { ok: true } | { ok: false; error: string }
      >;
      resetPermission: () => Promise<
        { ok: true } | { ok: false; error: string }
      >;
      listFiles: () => Promise<
        | { ok: true; vault: string; vault_abs: string; files: string[] }
        | { ok: false; error: string }
      >;
      openFile: (
        file: string,
      ) => Promise<{ ok: true } | { ok: false; error: string }>;
    };
  };
}
