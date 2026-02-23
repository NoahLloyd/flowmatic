import { MorningActivity, WeeklyMorningSchedule } from "./Morning";

export interface DailyHoursGoal {
  monday: number;
  tuesday: number;
  wednesday: number;
  thursday: number;
  friday: number;
  saturday: number;
  sunday: number;
}

export interface YearlyGoal {
  hoursPerYear: number;
  startDate: string; // ISO date string
}

interface UserPreferences {
  defaultProject?: string;
  defaultMinutes?: number;
  fromColor?: string;
  toColor?: string;
  lightModeFromColor?: string;
  lightModeToColor?: string;
  darkModeFromColor?: string;
  darkModeToColor?: string;
  morningActivities?: MorningActivity[];
  weeklyMorningSchedule?: WeeklyMorningSchedule;
  dailyHoursGoals?: DailyHoursGoal;
  yearlyHoursGoal?: YearlyGoal;
  signalGoals?: Record<string, number>;
  activeSignals?: string[];
}

export interface User {
  id: string;
  name: string;
  email: string;
  picture_url?: string; // Optional
  preferences?: UserPreferences;
  created_at?: string; // Optional
  updated_at?: string; // Optional
}
