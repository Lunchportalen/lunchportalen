-- Align older ai_suggestions tables with repo contract (PostgREST / app inserts).
alter table public.ai_suggestions add column if not exists created_by text null;
alter table public.ai_suggestions add column if not exists input jsonb not null default '{}'::jsonb;
alter table public.ai_suggestions add column if not exists output jsonb not null default '{}'::jsonb;
