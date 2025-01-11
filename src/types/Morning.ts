export interface MorningEntry {
  date: string;
  content: string;
  user_id: string;
}

export interface MorningEntries {
  entries: MorningEntry[];
  streak: number;
}
