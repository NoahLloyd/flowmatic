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
  distractions?: MorningDistraction[];
}

export interface MorningDistraction {
  id: string;
  startedAt: string;
  endedAt: string;
  durationSeconds: number;
  activityId: string;
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
  // Optional rotating prompts for the writing/journaling activity. When
  // non-empty, the activity displays one prompt at a time chosen via a
  // least-recently-seen rotation (see utils/promptPicker.ts). Empty / undef
  // = no prompt (current behaviour).
  prompts?: string[];
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
