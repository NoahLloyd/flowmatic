export interface WritingEntry {
  date: string;
  content: string;
  user_id: string;
}

export interface WritingEntries {
  entries: WritingEntry[];
  streak: number;
}
