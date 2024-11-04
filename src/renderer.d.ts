export interface IElectronAPI {
  send: (channel: string, data?: any) => void;
  on: (channel: string, func: (...args: any[]) => void) => void;
  submitSession: (data: any) => Promise<any>;
}

declare global {
  interface Window {
    electron: IElectronAPI;
  }
}
