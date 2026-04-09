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
});
