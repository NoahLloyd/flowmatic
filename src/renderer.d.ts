export interface ShortcutsConfig {
  quickAddTask: string;
  quickAddNote: string;
}

interface ApiRequestOptions {
  body?: any;
  headers?: {
    "Content-Type"?: string;
    Authorization?: string;
    [key: string]: string | undefined;
  };
}

export interface IElectronAPI {
  send: (channel: string, data?: any) => void;
  on: (channel: string, func: (...args: any[]) => void) => void;
  removeListener: (channel: string, func: (...args: any[]) => void) => void;
  apiRequest: (
    method: string,
    endpoint: string,
    options?: ApiRequestOptions
  ) => Promise<any>;
  getShortcuts: () => Promise<ShortcutsConfig>;
  updateShortcuts: (shortcuts: ShortcutsConfig) => Promise<ShortcutsConfig>;
}

declare global {
  interface Window {
    electron: IElectronAPI;
  }
}
