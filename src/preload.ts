import { contextBridge, ipcRenderer } from "electron";

// Track wrapper functions so removeListener can find the correct reference.
// contextBridge proxies prevent setting properties on the passed-in functions,
// so we use a Map keyed by "channel:id" instead.
const listenerMap = new Map<string, (...args: any[]) => void>();
let listenerId = 0;

contextBridge.exposeInMainWorld("electron", {
  send: (channel: string, data?: any) => {
    const validChannels = ["show-window", "update-tray", "update-signal-tray", "toggle-timer"];
    if (validChannels.includes(channel)) {
      ipcRenderer.send(channel, data);
    }
  },

  on: (channel: string, func: (...args: any[]) => void) => {
    const validChannels = [
      "show-window",
      "update-tray",
      "update-signal-tray",
      "toggle-timer",
      "open-record-modal",
      "global-quick-add-task",
      "global-quick-add-note",
      "task-added-from-overlay",
      "navigate-to-streak",
      "open-current-task-picker",
      "finish-session",
    ];
    if (validChannels.includes(channel)) {
      const id = listenerId++;
      const wrapper = (_event: any, ...args: any[]) => func(...args);
      listenerMap.set(`${channel}:${id}`, wrapper);
      ipcRenderer.on(channel, wrapper);
      // Return the id so the caller can pass it to removeListener
      return id;
    }
  },

  removeListener: (channel: string, idOrFunc: number | ((...args: any[]) => void)) => {
    const validChannels = [
      "show-window",
      "update-tray",
      "update-signal-tray",
      "toggle-timer",
      "open-record-modal",
      "global-quick-add-task",
      "global-quick-add-note",
      "task-added-from-overlay",
      "navigate-to-streak",
      "open-current-task-picker",
      "finish-session",
    ];
    if (validChannels.includes(channel)) {
      if (typeof idOrFunc === "number") {
        const key = `${channel}:${idOrFunc}`;
        const wrapper = listenerMap.get(key);
        if (wrapper) {
          ipcRenderer.removeListener(channel, wrapper);
          listenerMap.delete(key);
        }
      } else {
        // Fallback: remove all listeners for this channel that match
        ipcRenderer.removeAllListeners(channel);
        // Clean up map entries for this channel
        for (const [key] of listenerMap) {
          if (key.startsWith(`${channel}:`)) {
            listenerMap.delete(key);
          }
        }
      }
    }
  },

  getShortcuts: () => {
    return ipcRenderer.invoke("get-shortcuts");
  },

  updateShortcuts: (shortcuts: {
    quickAddTask: string;
    quickAddNote: string;
  }) => {
    return ipcRenderer.invoke("update-shortcuts", shortcuts);
  },

  setDoNotDisturb: (enabled: boolean) => {
    return ipcRenderer.invoke("set-do-not-disturb", enabled);
  },

  requestShortcutsAccess: () => {
    return ipcRenderer.invoke("request-shortcuts-access");
  },

  insights: {
    prepare: () => ipcRenderer.invoke("insights:prepare"),
    writeData: (files: Record<string, unknown>) =>
      ipcRenderer.invoke("insights:write-data", files),
    writeSchema: (schemaMd: string) =>
      ipcRenderer.invoke("insights:write-schema", schemaMd),
    send: (prompt: string) => ipcRenderer.invoke("insights:send", prompt),
    cancel: () => ipcRenderer.invoke("insights:cancel"),
    resetSession: () => ipcRenderer.invoke("insights:reset-session"),
    readOutput: () => ipcRenderer.invoke("insights:read-output"),
    setSessionId: (sessionId: string | null) =>
      ipcRenderer.invoke("insights:set-session-id", sessionId),
    writeOutput: (html: string) =>
      ipcRenderer.invoke("insights:write-output", html),
    onStream: (cb: (event: any) => void) => {
      const wrapper = (_e: any, data: any) => cb(data);
      ipcRenderer.on("insights:stream", wrapper);
      return () => ipcRenderer.removeListener("insights:stream", wrapper);
    },
    onPreview: (cb: (html: string) => void) => {
      const wrapper = (_e: any, html: string) => cb(html);
      ipcRenderer.on("insights:preview", wrapper);
      return () => ipcRenderer.removeListener("insights:preview", wrapper);
    },
    onDone: (cb: (info: { code: number; sessionId: string | null }) => void) => {
      const wrapper = (_e: any, info: any) => cb(info);
      ipcRenderer.on("insights:done", wrapper);
      return () => ipcRenderer.removeListener("insights:done", wrapper);
    },
    onStderr: (cb: (text: string) => void) => {
      const wrapper = (_e: any, text: string) => cb(text);
      ipcRenderer.on("insights:stderr", wrapper);
      return () => ipcRenderer.removeListener("insights:stderr", wrapper);
    },
    onError: (cb: (msg: string) => void) => {
      const wrapper = (_e: any, msg: string) => cb(msg);
      ipcRenderer.on("insights:error", wrapper);
      return () => ipcRenderer.removeListener("insights:error", wrapper);
    },
  },

  anki: {
    readStats: () => ipcRenderer.invoke("anki:read-stats"),
  },

  obsidian: {
    readTasks: () => ipcRenderer.invoke("obsidian:read-tasks"),
    markComplete: (args: { vaultAbs: string; file: string; textHash: string }) =>
      ipcRenderer.invoke("obsidian:mark-complete", args),
    checkAccess: () => ipcRenderer.invoke("obsidian:check-access"),
    openPrivacySettings: () =>
      ipcRenderer.invoke("obsidian:open-privacy-settings"),
    resetPermission: () => ipcRenderer.invoke("obsidian:reset-permission"),
    listFiles: () => ipcRenderer.invoke("obsidian:list-files"),
    openFile: (file: string) =>
      ipcRenderer.invoke("obsidian:open-file", { file }),
  },
});
