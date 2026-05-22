-- TPT-B-7 polish-9 — provider_tripletex_webhook_subscriptions (Tripletex API mirror)
-- UP: table + RLS + grants
-- DOWN: drop table (see bottom)

create table if not exists public.provider_tripletex_webhook_subscriptions (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.providers (id) on delete cascade,
  env text not null check (env in ('test', 'prod')),
  tripletex_subscription_id text not null,
  event_type text not null,
  target_url text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint provider_tripletex_webhook_subscriptions_env_event_unique
    unique (provider_id, env, event_type)
);

comment on table public.provider_tripletex_webhook_subscriptions is
  'Mirrors Tripletex /event/subscription rows per provider for dashboard and disconnect cleanup (TPT-B-7 polish-9).';

create index if not exists idx_provider_tripletex_webhook_subscriptions_provider_env
  on public.provider_tripletex_webhook_subscriptions (provider_id, env)
  where active = true;

alter table public.provider_tripletex_webhook_subscriptions enable row level security;
revoke all on public.provider_tripletex_webhook_subscriptions from public, anon;

grant select on public.provider_tripletex_webhook_subscriptions to authenticated;
grant select, insert, update, delete on public.provider_tripletex_webhook_subscriptions to service_role;

drop policy if exists provider_tripletex_webhook_subscriptions_provider_read
  on public.provider_tripletex_webhook_subscriptions;
create policy provider_tripletex_webhook_subscriptions_provider_read
  on public.provider_tripletex_webhook_subscriptions
  for select
  to authenticated
  using (public.can_access_provider(provider_id));

drop policy if exists provider_tripletex_webhook_subscriptions_superadmin_all
  on public.provider_tripletex_webhook_subscriptions;
create policy provider_tripletex_webhook_subscriptions_superadmin_all
  on public.provider_tripletex_webhook_subscriptions
  for all
  to authenticated
  using (public.is_superadmin())
  with check (public.is_superadmin());

-- ---------------------------------------------------------------------------
-- DOWN (reversible): drop table + policies
-- ---------------------------------------------------------------------------
-- drop table if exists public.provider_tripletex_webhook_subscriptions cascade;
