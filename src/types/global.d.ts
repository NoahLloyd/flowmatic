declare module "components/*";
declare module "pages/*";
declare module "utils/*";

interface ApiRequestOptions {
  body?: any;
  headers?: {
    "Content-Type"?: string;
    Authorization?: string;
    [key: string]: string | undefined;
  };
}

// Add the electron API types
interface Window {
  electron: {
    send: (channel: string, data?: any) => void;
    on: (channel: string, func: (...args: any[]) => void) => void;
    apiRequest: (
      method: string,
      endpoint: string,
      options?: ApiRequestOptions
    ) => Promise<any>;
  };
}
