export interface MorningEntry {
  date: string;
  content: string;
  user_id: string;
  activityContent?: MorningActivityContent;
}

export interface MorningActivityContent {
  writing?: string;
  gratitude?: string;
  affirmations?: string;
  lastActivityIndex?: number;
}

export interface MorningEntries {
  entries: MorningEntry[];
  streak: number;
}

export interface MorningActivity {
  id: string;
  type:
    | "writing"
    | "visualization"
    | "gratitude"
    | "affirmations"
    | "breathwork"
    | "tasks";
  enabled: boolean;
  timerMinutes: number;
  text?: string;
  title: string;
}

export type DayOfWeek =
  | "monday"
  | "tuesday"
  | "wednesday"
  | "thursday"
  | "friday"
  | "saturday"
  | "sunday";

export interface WeeklyMorningSchedule {
  [key: string]: MorningActivity[];
}
