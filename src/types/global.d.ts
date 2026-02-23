declare module "components/*";
declare module "pages/*";
declare module "utils/*";

// Add the electron API types
interface Window {
  electron: {
    send: (channel: string, data?: any) => void;
    on: (channel: string, func: (...args: any[]) => void) => void;
    removeListener: (channel: string, func: (...args: any[]) => void) => void;
    getShortcuts: () => Promise<{ quickAddTask: string; quickAddNote: string }>;
    updateShortcuts: (shortcuts: {
      quickAddTask: string;
      quickAddNote: string;
    }) => Promise<{ quickAddTask: string; quickAddNote: string }>;
    setDoNotDisturb: (enabled: boolean) => Promise<boolean>;
  };
}
