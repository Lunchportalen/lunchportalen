-- TPT-B-5b — Agreement lifecycle hooks (proactive Flow B sync)
-- ACTIVE transition → tripletex.company_customer_create_provider outbox
-- Tier change → tripletex.provider_product_sync outbox

begin;

create or replace function public.lp_agreement_lifecycle_hook()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_request_rid text;
  v_customer_key text;
  v_product_key text;
  v_env text := 'prod';
  v_tier text;
begin
  -- -------------------------------------------------------------------------
  -- ACTIVE transition → customer sync (Flow B-2)
  -- -------------------------------------------------------------------------
  if new.status = 'ACTIVE'::public.agreement_status
     and (
       tg_op = 'INSERT'
       or old.status is distinct from 'ACTIVE'::public.agreement_status
     )
     and new.company_id is not null
     and new.provider_id is not null
  then
    v_request_rid := replace(gen_random_uuid()::text, '-', '');
    v_customer_key := format(
      'tripletex.company_customer_create_provider:%s:%s',
      new.company_id::text,
      new.provider_id::text
    );

    insert into public.outbox (event_key, payload, status, attempts, last_error, locked_at, locked_by)
    values (
      v_customer_key,
      jsonb_build_object(
        'company_id', new.company_id,
        'provider_id', new.provider_id,
        'env', v_env,
        'request_rid', v_request_rid,
        'source', 'agreement_lifecycle',
        'agreement_id', new.id,
        'trigger', 'status_active'
      ),
      'PENDING',
      0,
      null,
      null,
      null
    )
    on conflict (event_key) do nothing;

    insert into public.lifecycle_audit_log (actor_id, action, entity_type, entity_id, reason, metadata)
    values (
      null,
      'agreement_lifecycle_hook_fired',
      'agreement',
      new.id,
      'Agreement ACTIVE → enqueue customer sync',
      jsonb_build_object(
        'hook', 'status_active',
        'agreement_id', new.id,
        'company_id', new.company_id,
        'provider_id', new.provider_id,
        'event_key', v_customer_key,
        'request_rid', v_request_rid
      )
    );
  end if;

  -- -------------------------------------------------------------------------
  -- Tier change → product sync (Flow B-2, TPT-B-5b handler)
  -- -------------------------------------------------------------------------
  if tg_op = 'UPDATE'
     and new.tier is distinct from old.tier
     and new.provider_id is not null
  then
    v_tier := upper(btrim(new.tier::text));
    if v_tier in ('BASIS', 'LUXUS', 'ENTERPRISE') then
      v_request_rid := replace(gen_random_uuid()::text, '-', '');
      v_product_key := format(
        'tripletex.provider_product_sync:%s:%s',
        new.provider_id::text,
        v_tier
      );

      insert into public.outbox (event_key, payload, status, attempts, last_error, locked_at, locked_by)
      values (
        v_product_key,
        jsonb_build_object(
          'provider_id', new.provider_id,
          'tier', v_tier,
          'env', v_env,
          'request_rid', v_request_rid,
          'source', 'agreement_lifecycle',
          'agreement_id', new.id,
          'trigger', 'tier_change',
          'previous_tier', upper(btrim(old.tier::text))
        ),
        'PENDING',
        0,
        null,
        null,
        null
      )
      on conflict (event_key) do nothing;

      insert into public.lifecycle_audit_log (actor_id, action, entity_type, entity_id, reason, metadata)
      values (
        null,
        'agreement_lifecycle_hook_fired',
        'agreement',
        new.id,
        format('Agreement tier %s → %s → enqueue product sync', old.tier, new.tier),
        jsonb_build_object(
          'hook', 'tier_change',
          'agreement_id', new.id,
          'provider_id', new.provider_id,
          'tier', v_tier,
          'previous_tier', old.tier,
          'event_key', v_product_key,
          'request_rid', v_request_rid
        )
      );
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_agreement_lifecycle_hook on public.agreements;

create trigger trg_agreement_lifecycle_hook
  after insert or update of status, tier on public.agreements
  for each row
  execute function public.lp_agreement_lifecycle_hook();

comment on function public.lp_agreement_lifecycle_hook() is
  'TPT-B-5b: enqueue Flow B Tripletex sync on agreement ACTIVE / tier change.';

do $$
begin
  if not exists (
    select 1 from pg_proc where proname = 'lp_agreement_lifecycle_hook'
  ) then
    raise exception 'TPT-B-5b: lp_agreement_lifecycle_hook missing';
  end if;
end;
$$;

commit;
