// Weekly Review Types

export interface ChecklistItem {
  id: string;
  label: string;
  checked: boolean;
}

export interface QuestionItem {
  id: string;
  question: string;
  answer: string;
}

export interface WeeklyReview {
  id?: string;
  user_id?: string;
  week_start: string; // ISO date string (Wednesday of the week)
  week_end: string; // ISO date string (Tuesday of the following week)
  checklist: ChecklistItem[];
  questions: QuestionItem[];
  inbox_items: string[]; // Quick capture items added throughout the week
  is_completed: boolean;
  completed_at?: string; // ISO date string
  created_at?: string;
  updated_at?: string;
}

export interface ReviewStreak {
  current_streak: number;
  longest_streak: number;
  last_completed_week?: string; // ISO date string of the Monday
}

// Default checklist items (customizable in settings)
export const DEFAULT_CHECKLIST_ITEMS: Omit<ChecklistItem, 'checked'>[] = [
  { id: 'beeper', label: 'Read all Beeper messages, reconnect disconnected services' },
  { id: 'email', label: 'Clean up email inbox' },
  { id: 'notes', label: 'Process all flowmatic notes' },
  { id: 'last-calendar', label: "Review last week's calendar" },
  { id: 'last-todos', label: "Review last week's to-dos" },
  { id: 'next-calendar', label: "Review next week's calendar" },
  { id: 'future-tasks', label: 'Go through future tasks' },
  { id: 'weekly-tasks', label: 'Set weekly tasks for next week' },
];

// Default questions (customizable in settings)
export const DEFAULT_QUESTIONS: Omit<QuestionItem, 'answer'>[] = [
  { id: 'goals', question: 'What are my goals right now? (Deduction from values to current priority)' },
  { id: 'mistakes', question: 'What mistakes did I make this week?' },
  { id: 'idiot', question: 'What am I being an idiot about?' },
  { id: 'missing', question: 'What am I missing?' },
  { id: 'success', question: 'What was my biggest success this week?' },
  { id: 'bottleneck', question: 'What is my biggest bottleneck?' },
  { id: 'lesson', question: 'What is the right lesson to take from this week?' },
  { id: 'ideal', question: 'In an ideal version of this week, I would have...' },
  { id: 'procrastinating', question: 'What am I currently procrastinating about?' },
  { id: 'advice', question: 'Whose advice will help me solve my problems?' },
  { id: 'weighing', question: "What's weighing on my mind?" },
];

// User preferences for review customization
export interface ReviewPreferences {
  checklistItems: Omit<ChecklistItem, 'checked'>[];
  questions: Omit<QuestionItem, 'answer'>[];
}

