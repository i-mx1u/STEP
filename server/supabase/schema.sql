-- ============================================================================
-- STEPWISE — Supabase Schema
-- Run this SQL once in the Supabase SQL Editor (Project → SQL).
-- The server code (server/db/supabase.ts) expects these exact table/column names.
-- Row Level Security is enabled but bypassed by the service role key.
-- ============================================================================

-- 1. Users table — stores registered accounts (passwords are always hashed).
CREATE TABLE IF NOT EXISTS step_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  display_name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 2. Test history — one row per completed test.
CREATE TABLE IF NOT EXISTS step_test_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES step_users(id) ON DELETE CASCADE,
  config JSONB NOT NULL,
  score INTEGER NOT NULL,
  correct_count INTEGER NOT NULL,
  total_count INTEGER NOT NULL,
  answered_count INTEGER NOT NULL,
  duration_seconds INTEGER NOT NULL,
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE NOT NULL,
  questions JSONB NOT NULL
);

-- Index for user's recent tests.
CREATE INDEX IF NOT EXISTS idx_step_tests_user_completed
  ON step_test_history (user_id, completed_at DESC);

-- 3. Bookmarks — one row per bookmarked question.
CREATE TABLE IF NOT EXISTS step_bookmarks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES step_users(id) ON DELETE CASCADE,
  question_id TEXT NOT NULL,
  model_id INTEGER NOT NULL,
  section TEXT NOT NULL,
  snapshot JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE (user_id, question_id)
);

-- Index for user's bookmarks ordered by creation time.
CREATE INDEX IF NOT EXISTS idx_step_bookmarks_user_created
  ON step_bookmarks (user_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- Row Level Security (RLS)
-- The server uses the Supabase Service Role Key, which bypasses RLS.
-- These statements enable RLS so the dashboard/UI (using the anon key) can
-- still read/write according to policy, but the backend ignores the policies.
-- ---------------------------------------------------------------------------
ALTER TABLE step_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE step_test_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE step_bookmarks ENABLE ROW LEVEL SECURITY;

-- Policies that allow the anon/registered user to read their own data only.
-- The backend (service role key) bypasses these, but they are required for
-- correct RLS operation and for any future direct DB access.
CREATE POLICY "users_read_own" ON step_users FOR SELECT USING (auth.uid()::text = id);
CREATE POLICY "users_update_own" ON step_users FOR UPDATE USING (auth.uid()::text = id);
CREATE POLICY "test_history_read_own" ON step_test_history FOR SELECT USING (auth.uid()::text = user_id);
CREATE POLICY "test_history_insert_own" ON step_test_history FOR INSERT WITH CHECK (auth.uid()::text = user_id);
CREATE POLICY "test_history_delete_own" ON step_test_history FOR DELETE USING (auth.uid()::text = user_id);
CREATE POLICY "bookmarks_read_own" ON step_bookmarks FOR SELECT USING (auth.uid()::text = user_id);
CREATE POLICY "bookmarks_insert_own" ON step_bookmarks FOR INSERT WITH CHECK (auth.uid()::text = user_id);
CREATE POLICY "bookmarks_delete_own" ON step_bookmarks FOR DELETE USING (auth.uid()::text = user_id);