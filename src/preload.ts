import { contextBridge, ipcRenderer } from "electron";

// Define the types for API requests
interface ApiRequestOptions {
  body?: any;
  headers?: {
    "Content-Type"?: string;
    Authorization?: string;
    [key: string]: string | undefined;
  };
}

interface ApiRequestParams {
  method: string;
  endpoint: string;
  options?: ApiRequestOptions;
}

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

  apiRequest: (
    method: string,
    endpoint: string,
    options?: ApiRequestOptions
  ) => {
    return ipcRenderer.invoke("api-request", {
      method,
      endpoint,
      options, // Pass the entire options object
    } as ApiRequestParams);
  },
});
