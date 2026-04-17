-- Valgfri e-post fra offentlig AI-demo (server-side insert via service role).
create table if not exists public.demo_interest_leads (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  source text not null default 'public_ai_demo',
  created_at timestamptz not null default now()
);

create index if not exists idx_demo_interest_leads_created on public.demo_interest_leads (created_at desc);

alter table public.demo_interest_leads enable row level security;

revoke all on public.demo_interest_leads from anon, authenticated;
