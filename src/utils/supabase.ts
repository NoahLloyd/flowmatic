// @ts-ignore — supabase-js ships its own types but TS 4.x can't resolve them
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://kujhoojkrxkoftcbrgun.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_uHqEH-CEUBbqiq1RoTkciQ_TApuopZC";

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    storage: {
      getItem: (key: string) => localStorage.getItem(key),
      setItem: (key: string, value: string) => localStorage.setItem(key, value),
      removeItem: (key: string) => localStorage.removeItem(key),
    },
  },
});

// Helper to get the current user ID (throws if not authenticated)
// Uses getSession() (reads from local memory) instead of getUser() (network call)
// to avoid blocking on network requests and lock contention during app startup.
export const getCurrentUserId = async (): Promise<string> => {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.user) throw new Error("Not authenticated");
  return session.user.id;
};
