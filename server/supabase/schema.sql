-- STEPWISE — Supabase schema
-- Run this once in Supabase → SQL Editor before starting the API.
-- The API uses the service-role key server-side; never expose it in the browser.

create extension if not exists pgcrypto;

create table if not exists public.step_users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  password_hash text not null,
  display_name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.step_test_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.step_users(id) on delete cascade,
  config jsonb not null default '{}'::jsonb,
  score integer not null check (score between 0 and 100),
  correct_count integer not null default 0,
  total_count integer not null default 0,
  answered_count integer not null default 0,
  duration_seconds integer not null default 0,
  started_at timestamptz,
  completed_at timestamptz not null default now(),
  questions jsonb not null default '[]'::jsonb
);

create index if not exists idx_step_tests_user_completed
  on public.step_test_history (user_id, completed_at desc);

create table if not exists public.step_bookmarks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.step_users(id) on delete cascade,
  question_id text not null,
  model_id integer not null,
  section text not null,
  snapshot jsonb not null,
  created_at timestamptz not null default now(),
  unique (user_id, question_id)
);

create index if not exists idx_step_bookmarks_user_created
  on public.step_bookmarks (user_id, created_at desc);

alter table public.step_users enable row level security;
alter table public.step_test_history enable row level security;
alter table public.step_bookmarks enable row level security;

-- No RLS policies are added deliberately. Only the server-side service-role key
-- (which bypasses RLS) may read or write these tables.
