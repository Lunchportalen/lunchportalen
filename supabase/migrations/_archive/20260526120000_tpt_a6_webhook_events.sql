-- TPT-A-6: Inbound Tripletex webhook audit + idempotency store.
-- Access: service_role only (no authenticated policies).

begin;

create table if not exists public.webhook_events (
  id uuid primary key default gen_random_uuid(),
  source text not null default 'tripletex',
  event_id text not null,
  event_type text not null,
  payload jsonb not null,
  signature text,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  status text not null default 'PENDING'
    check (status in ('PENDING', 'PROCESSED', 'FAILED', 'IGNORED')),
  error_detail text,
  constraint webhook_events_event_id_key unique (event_id)
);

create index if not exists idx_webhook_events_event_type
  on public.webhook_events (event_type);

create index if not exists idx_webhook_events_received_at
  on public.webhook_events (received_at desc);

comment on table public.webhook_events is
  'Inbound integration webhooks (Tripletex Flow A). event_id is idempotency key.';

alter table public.webhook_events enable row level security;

revoke all on public.webhook_events from public, anon, authenticated;
grant select, insert, update on public.webhook_events to service_role;

commit;
