-- Ledger agreements (public.agreements): reject + pause + activated_at
-- Minimal additive: enum values, columns, RPCs. Does not change create-pending RPC.

begin;

alter type public.agreement_status add value if not exists 'REJECTED';
alter type public.agreement_status add value if not exists 'PAUSED';

alter table public.agreements
  add column if not exists activated_at timestamptz,
  add column if not exists rejection_reason text;

-- Approve: set activated_at on transition to ACTIVE
create or replace function public.lp_agreement_approve_active(
  p_agreement_id uuid,
  p_actor_user_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_agreement public.agreements%rowtype;
  v_company_status public.company_status;
  v_now timestamptz := clock_timestamp();
begin
  if p_agreement_id is null then
    raise exception using errcode = 'P0001', message = 'AGREEMENT_ID_REQUIRED';
  end if;

  select a.*
    into v_agreement
  from public.agreements a
  where a.id = p_agreement_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'AGREEMENT_NOT_FOUND';
  end if;

  if upper(v_agreement.status::text) <> 'PENDING' then
    raise exception using errcode = 'P0001', message = 'AGREEMENT_NOT_PENDING';
  end if;

  select c.status
    into v_company_status
  from public.companies c
  where c.id = v_agreement.company_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'COMPANY_NOT_FOUND';
  end if;

  if v_company_status = 'CLOSED'::public.company_status then
    raise exception using errcode = 'P0001', message = 'COMPANY_CLOSED';
  end if;

  if exists (
    select 1
    from public.agreements a
    where a.company_id = v_agreement.company_id
      and a.id <> v_agreement.id
      and upper(a.status::text) = 'ACTIVE'
    for update
  ) then
    raise exception using errcode = '23505', message = 'ACTIVE_AGREEMENT_EXISTS';
  end if;

  update public.agreements
     set status = 'ACTIVE'::public.agreement_status,
         activated_at = coalesce(activated_at, now()),
         updated_at = now()
   where id = v_agreement.id;

  if v_company_status <> 'ACTIVE'::public.company_status then
    update public.companies
       set status = 'ACTIVE'::public.company_status,
           updated_at = now()
     where id = v_agreement.company_id;
  end if;

  if to_regclass('public.outbox') is null then
    raise exception using errcode = 'P0001', message = 'OUTBOX_MISSING';
  end if;

  execute '
    insert into public.outbox (event_key, payload, status, attempts, last_error, locked_at, locked_by)
    values ($1, $2, $3, $4, $5, $6, $7)
    on conflict (event_key) do nothing
  '
    using
      format('agreement.activated:%s', v_agreement.id::text),
      jsonb_build_object(
        'event', 'agreement.activated',
        'agreementId', v_agreement.id,
        'companyId', v_agreement.company_id,
        'actorUserId', p_actor_user_id,
        'receipt', v_now
      ),
      'PENDING',
      0,
      null,
      null,
      null;

  execute '
    insert into public.outbox (event_key, payload, status, attempts, last_error, locked_at, locked_by)
    values ($1, $2, $3, $4, $5, $6, $7)
    on conflict (event_key) do nothing
  '
    using
      format('company.activated:%s', v_agreement.company_id::text),
      jsonb_build_object(
        'event', 'company.activated',
        'agreementId', v_agreement.id,
        'companyId', v_agreement.company_id,
        'actorUserId', p_actor_user_id,
        'receipt', v_now
      ),
      'PENDING',
      0,
      null,
      null,
      null;

  return jsonb_build_object(
    'agreement_id', v_agreement.id,
    'company_id', v_agreement.company_id,
    'status', 'ACTIVE',
    'receipt', v_now
  );
end
$$;

create or replace function public.lp_agreement_reject_pending(
  p_agreement_id uuid,
  p_actor_user_id uuid default null,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_agreement public.agreements%rowtype;
  v_reason text := left(trim(coalesce(p_reason, '')), 4000);
begin
  if p_agreement_id is null then
    raise exception using errcode = 'P0001', message = 'AGREEMENT_ID_REQUIRED';
  end if;

  select a.*
    into v_agreement
  from public.agreements a
  where a.id = p_agreement_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'AGREEMENT_NOT_FOUND';
  end if;

  if upper(v_agreement.status::text) <> 'PENDING' then
    raise exception using errcode = 'P0001', message = 'AGREEMENT_NOT_PENDING';
  end if;

  update public.agreements
     set status = 'REJECTED'::public.agreement_status,
         rejection_reason = nullif(v_reason, ''),
         updated_at = now()
   where id = v_agreement.id;

  return jsonb_build_object(
    'agreement_id', v_agreement.id,
    'company_id', v_agreement.company_id,
    'status', 'REJECTED',
    'actor_user_id', p_actor_user_id
  );
end
$$;

create or replace function public.lp_agreement_pause_ledger_active(
  p_agreement_id uuid,
  p_actor_user_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_agreement public.agreements%rowtype;
begin
  if p_agreement_id is null then
    raise exception using errcode = 'P0001', message = 'AGREEMENT_ID_REQUIRED';
  end if;

  select a.*
    into v_agreement
  from public.agreements a
  where a.id = p_agreement_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'AGREEMENT_NOT_FOUND';
  end if;

  if upper(v_agreement.status::text) <> 'ACTIVE' then
    raise exception using errcode = 'P0001', message = 'AGREEMENT_NOT_ACTIVE';
  end if;

  update public.agreements
     set status = 'PAUSED'::public.agreement_status,
         updated_at = now()
   where id = v_agreement.id;

  return jsonb_build_object(
    'agreement_id', v_agreement.id,
    'company_id', v_agreement.company_id,
    'status', 'PAUSED',
    'actor_user_id', p_actor_user_id
  );
end
$$;

revoke all on function public.lp_agreement_reject_pending(uuid, uuid, text) from public;
revoke all on function public.lp_agreement_reject_pending(uuid, uuid, text) from anon;
revoke all on function public.lp_agreement_reject_pending(uuid, uuid, text) from authenticated;
grant execute on function public.lp_agreement_reject_pending(uuid, uuid, text) to service_role;
grant execute on function public.lp_agreement_reject_pending(uuid, uuid, text) to postgres;

revoke all on function public.lp_agreement_pause_ledger_active(uuid, uuid) from public;
revoke all on function public.lp_agreement_pause_ledger_active(uuid, uuid) from anon;
revoke all on function public.lp_agreement_pause_ledger_active(uuid, uuid) from authenticated;
grant execute on function public.lp_agreement_pause_ledger_active(uuid, uuid) to service_role;
grant execute on function public.lp_agreement_pause_ledger_active(uuid, uuid) to postgres;

revoke all on function public.lp_agreement_approve_active(uuid, uuid) from public;
revoke all on function public.lp_agreement_approve_active(uuid, uuid) from anon;
revoke all on function public.lp_agreement_approve_active(uuid, uuid) from authenticated;
grant execute on function public.lp_agreement_approve_active(uuid, uuid) to service_role;
grant execute on function public.lp_agreement_approve_active(uuid, uuid) to postgres;

commit;
