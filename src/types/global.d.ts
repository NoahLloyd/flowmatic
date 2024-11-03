declare module "components/*";
declare module "pages/*";
declare module "utils/*";

// Add the electron API types
interface Window {
  electron: {
    send: (channel: string, data?: any) => void;
    on: (channel: string, func: (...args: any[]) => void) => void;
  };
}
