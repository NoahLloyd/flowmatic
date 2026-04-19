-- Insights chat history (synced across devices)
-- Run in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS insights_chats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  local_id TEXT NOT NULL,
  claude_session_id TEXT,
  title TEXT NOT NULL DEFAULT 'New chat',
  messages JSONB NOT NULL DEFAULT '[]'::jsonb,
  output_html TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, local_id)
);

CREATE INDEX IF NOT EXISTS insights_chats_user_updated_idx
  ON insights_chats (user_id, updated_at DESC);

ALTER TABLE insights_chats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own insights_chats"
  ON insights_chats FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own insights_chats"
  ON insights_chats FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own insights_chats"
  ON insights_chats FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own insights_chats"
  ON insights_chats FOR DELETE USING (auth.uid() = user_id);
