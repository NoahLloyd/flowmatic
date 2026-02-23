export interface ShortcutsConfig {
  quickAddTask: string;
  quickAddNote: string;
}

export interface IElectronAPI {
  send: (channel: string, data?: any) => void;
  on: (channel: string, func: (...args: any[]) => void) => void;
  removeListener: (channel: string, func: (...args: any[]) => void) => void;
  getShortcuts: () => Promise<ShortcutsConfig>;
  updateShortcuts: (shortcuts: ShortcutsConfig) => Promise<ShortcutsConfig>;
  setDoNotDisturb: (enabled: boolean) => Promise<boolean>;
}

declare global {
  interface Window {
    electron: IElectronAPI;
  }
}
