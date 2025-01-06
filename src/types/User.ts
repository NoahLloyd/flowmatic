export interface User {
  _id: string;
  name: string;
  email: string;
  picture_url?: string; // Optional
  preferences?: Record<string, any>; // Optional
  created_at?: string; // Optional
  last_updated?: string; // Optional
}
