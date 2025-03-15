import { MorningActivity, WeeklyMorningSchedule } from "./Morning";

interface UserPreferences {
  defaultProject?: string;
  defaultMinutes?: number;
  fromColor?: string;
  toColor?: string;
  morningActivities?: MorningActivity[];
  weeklyMorningSchedule?: WeeklyMorningSchedule;
}

export interface User {
  _id: string;
  name: string;
  email: string;
  picture_url?: string; // Optional
  preferences?: UserPreferences;
  created_at?: string; // Optional
  last_updated?: string; // Optional
}
