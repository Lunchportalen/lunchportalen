-- Idempotent governance applies, dry-run audit trail, rollback pointer.

begin;

create table if not exists public.ai_governance_apply_log (
  id uuid primary key default gen_random_uuid(),
  idempotency_key text null,
  user_id uuid references auth.users (id) on update cascade on delete set null,
  actor_email text null,
  rid text not null,
  recommendation_id text null,
  action text not null,
  payload jsonb not null default '{}'::jsonb,
  dry_run boolean not null default false,
  snapshot_before jsonb not null default '{}'::jsonb,
  snapshot_after jsonb null,
  inverse_action text null,
  inverse_payload jsonb null,
  result jsonb null,
  rolled_back_at timestamptz null,
  rollback_of_id uuid null references public.ai_governance_apply_log (id) on update cascade on delete set null,
  created_at timestamptz not null default now(),
  constraint ai_governance_apply_log_action_nonempty check (char_length(trim(action)) > 0)
);

create unique index if not exists ai_governance_apply_log_idempotency_key_uq
  on public.ai_governance_apply_log (idempotency_key)
  where idempotency_key is not null and dry_run = false;

create index if not exists ai_governance_apply_log_created_idx
  on public.ai_governance_apply_log (created_at desc);

comment on table public.ai_governance_apply_log is
  'Superadmin AI governance applies: idempotency, snapshots, inverse hints; service-role writes.';

alter table public.ai_governance_apply_log enable row level security;

commit;
