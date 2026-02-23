import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("electron", {
  send: (channel: string, data?: any) => {
    const validChannels = ["show-window", "update-tray", "toggle-timer"];
    if (validChannels.includes(channel)) {
      ipcRenderer.send(channel, data);
    }
  },

  on: (channel: string, func: (...args: any[]) => void) => {
    const validChannels = [
      "show-window",
      "update-tray",
      "toggle-timer",
      "global-quick-add-task",
      "global-quick-add-note",
      "task-added-from-overlay",
    ];
    if (validChannels.includes(channel)) {
      ipcRenderer.on(channel, (event, ...args) => func(...args));
    }
  },

  removeListener: (channel: string, func: (...args: any[]) => void) => {
    const validChannels = [
      "show-window",
      "update-tray",
      "toggle-timer",
      "global-quick-add-task",
      "global-quick-add-note",
      "task-added-from-overlay",
    ];
    if (validChannels.includes(channel)) {
      ipcRenderer.removeListener(channel, func);
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
});
