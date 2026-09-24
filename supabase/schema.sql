-- CantAlice -- cloud progress storage.
-- Run this once in the Supabase SQL editor (Dashboard > SQL Editor > New query).

create table if not exists public.progress (
  spotify_user_id text primary key,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- Lock the table down: enable RLS and add no policies, so it is unreachable
-- with the public anon key. Only the service role (used by the progress Edge
-- Function, which verifies the caller's Spotify identity) can touch it.
alter table public.progress enable row level security;
