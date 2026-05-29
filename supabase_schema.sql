-- supabase_schema.sql
-- Run this once in the Supabase SQL editor (Dashboard → SQL Editor → New query → paste → Run).

create table if not exists public.submissions (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  tasker_name   text,
  task_id       text not null,
  triage_note   text,
  skipped       boolean default false,
  skip_answers  jsonb default '{}'::jsonb,
  preseed_trace text,
  revised_trace text,
  preseed_plan  text,
  revised_plan  text,
  cameras       text[] default '{}',
  temporal      boolean default false,
  label_answers jsonb default '{}'::jsonb,
  section_results jsonb,
  ai_analysis   jsonb,
  ai_verdict    text,
  major_flags   int default 0,
  minor_flags   int default 0
);

-- Helpful index for the reviewer dashboard
create index if not exists submissions_created_at_idx on public.submissions (created_at desc);
create index if not exists submissions_task_id_idx     on public.submissions (task_id);

-- Row Level Security: enabled, with NO public policies.
-- The app's API routes use the service_role key, which bypasses RLS, so the
-- table stays private (no anon access) while the server can still read/write.
alter table public.submissions enable row level security;
