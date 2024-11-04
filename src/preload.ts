import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("electron", {
  send: (channel: string, data?: any) => {
    const validChannels = ["show-window", "update-tray", "toggle-timer"];
    if (validChannels.includes(channel)) {
      ipcRenderer.send(channel, data);
    }
  },
  on: (channel: string, func: (...args: any[]) => void) => {
    const validChannels = ["show-window", "update-tray", "toggle-timer"];
    if (validChannels.includes(channel)) {
      ipcRenderer.on(channel, (event, ...args) => func(...args));
    }
  },
  apiRequest: (method: string, endpoint: string, data?: any) => {
    return ipcRenderer.invoke("api-request", { method, endpoint, data });
  },
});
