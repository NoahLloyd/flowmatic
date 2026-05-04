// Picks a journaling prompt with a "least-recently-seen" preference,
// falling back to a randomized choice that still avoids the most recent
// repeats once every prompt has been seen.
//
// History is stored in localStorage under a per-activity key as an ordered
// list of prompts (most-recent first). When picking:
//   1. If any prompt has never been seen → pick uniformly at random from
//      the unseen set.
//   2. Otherwise, take the bottom half of the history (oldest cohort) and
//      pick uniformly at random within it. This keeps things from feeling
//      deterministic while still rotating through everything.

const STORAGE_PREFIX = "morningPromptHistory:";
const MAX_HISTORY = 200;

const readHistory = (key: string): string[] => {
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((s) => typeof s === "string") : [];
  } catch {
    return [];
  }
};

const writeHistory = (key: string, history: string[]): void => {
  try {
    localStorage.setItem(
      STORAGE_PREFIX + key,
      JSON.stringify(history.slice(0, MAX_HISTORY))
    );
  } catch {
    /* quota / disabled storage — not fatal */
  }
};

/**
 * Pick the next prompt for an activity given the configured prompts list.
 * Returns null if `prompts` is empty (or only blank lines).
 *
 * `key` should uniquely identify the activity (its id) so each writing-
 * activity tracks its own history. Whitespace-only entries are ignored
 * here so the settings-side textarea can keep blank lines while the user
 * is editing without those leaking into the rotation.
 */
export const pickNextPrompt = (
  prompts: string[],
  key: string
): string | null => {
  const cleaned = (prompts || [])
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
  if (cleaned.length === 0) return null;
  if (cleaned.length === 1) return cleaned[0];

  const history = readHistory(key);
  // Drop history entries no longer in the configured prompts (so removing
  // a prompt from settings doesn't poison the rotation forever).
  const cleanHistory = history.filter((p) => cleaned.includes(p));

  // Stage 1: prefer prompts the user has never seen.
  const unseen = cleaned.filter((p) => !cleanHistory.includes(p));
  if (unseen.length > 0) {
    return unseen[Math.floor(Math.random() * unseen.length)];
  }

  // Stage 2: every prompt has been seen — pick from the older half (the
  // bottom of the history list, since most-recent is at the front).
  const olderHalf = cleanHistory.slice(Math.floor(cleanHistory.length / 2));
  const pool = olderHalf.length > 0 ? olderHalf : cleanHistory;
  return pool[Math.floor(Math.random() * pool.length)];
};

/**
 * Record that a prompt was just shown. Pushes to the front of the history
 * list, dedupes, and trims to MAX_HISTORY entries.
 */
export const recordPromptShown = (prompt: string, key: string): void => {
  const history = readHistory(key);
  const next = [prompt, ...history.filter((p) => p !== prompt)];
  writeHistory(key, next);
};
