-- TPT-B-5 — Daily agreement billing scheduler (compute due + orchestrator)
-- Flow B: cron → lp_run_daily_agreement_billing → invoice + outbox → worker → Tripletex

-- ---------------------------------------------------------------------------
-- 1) Index for scheduler filtering
-- ---------------------------------------------------------------------------
create index if not exists agreements_billing_scheduler_idx
  on public.agreements (status, billing_cycle, billing_anchor_date)
  where status = 'ACTIVE'::public.agreement_status;

-- ---------------------------------------------------------------------------
-- 2) lp_compute_agreements_due_today — deterministic SQL billing windows
-- ---------------------------------------------------------------------------
create or replace function public.lp_compute_agreements_due_today(p_today date)
returns table(
  agreement_id uuid,
  provider_id uuid,
  company_id uuid,
  billing_cycle text,
  period_start date,
  period_end date
)
language plpgsql
stable
security definer
set search_path = public, pg_catalog
as $$
begin
  if p_today is null then
    raise exception 'TODAY_REQUIRED' using errcode = 'P0001';
  end if;

  if auth.role() <> 'service_role' then
    raise exception 'PERMISSION_DENIED' using errcode = '42501';
  end if;

  return query
  with base as (
    select
      a.id as agreement_id,
      a.provider_id,
      a.company_id,
      coalesce(nullif(btrim(a.billing_cycle), ''), 'monthly') as billing_cycle,
      a.billing_anchor_date,
      a.starts_at,
      a.created_at,
      a.last_invoiced_at
    from public.agreements a
    join public.companies c on c.id = a.company_id
    join public.providers p on p.id = a.provider_id
    where a.status = 'ACTIVE'::public.agreement_status
      and c.suspended_at is null
      and c.paused_at is null
      and p.suspended_at is null
      and p.paused_at is null
      and p.deleted_at is null
      and (
        a.last_invoiced_at is null
        or (a.last_invoiced_at at time zone 'Europe/Oslo')::date < p_today
      )
  ),
  computed as (
    select
      b.agreement_id,
      b.provider_id,
      b.company_id,
      b.billing_cycle,
      coalesce(b.billing_anchor_date, b.starts_at::date, b.created_at::date) as anchor_date,
      extract(day from coalesce(b.billing_anchor_date, b.starts_at::date, b.created_at::date))::int
        as anchor_day,
      extract(day from (date_trunc('month', p_today) + interval '1 month - 1 day'))::int
        as last_day_of_month
    from base b
  ),
  due as (
    select
      c.agreement_id,
      c.provider_id,
      c.company_id,
      c.billing_cycle,
      case
        when c.billing_cycle = 'biweekly' then
          p_today >= c.anchor_date
          and mod((p_today - c.anchor_date), 14) = 0
        else
          extract(day from p_today) = least(c.anchor_day, c.last_day_of_month)
      end as is_due,
      case
        when c.billing_cycle = 'biweekly' then (p_today - 14)
        else (date_trunc('month', p_today) - interval '1 month')::date
      end as period_start,
      case
        when c.billing_cycle = 'biweekly' then (p_today - 1)
        else (date_trunc('month', p_today) - interval '1 day')::date
      end as period_end
    from computed c
  )
  select
    d.agreement_id,
    d.provider_id,
    d.company_id,
    d.billing_cycle,
    d.period_start,
    d.period_end
  from due d
  where d.is_due;
end;
$$;

revoke all on function public.lp_compute_agreements_due_today(date) from public;
revoke all on function public.lp_compute_agreements_due_today(date) from anon;
revoke all on function public.lp_compute_agreements_due_today(date) from authenticated;
grant execute on function public.lp_compute_agreements_due_today(date) to service_role;

-- ---------------------------------------------------------------------------
-- 3) lp_run_daily_agreement_billing — orchestrator (service_role only)
-- ---------------------------------------------------------------------------
create or replace function public.lp_run_daily_agreement_billing(
  p_today date default (timezone('Europe/Oslo', now()))::date,
  p_request_rid text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_run_id uuid := gen_random_uuid();
  v_ran_at timestamptz := now();
  v_row record;
  v_result jsonb;
  v_candidates int := 0;
  v_generated int := 0;
  v_skipped int := 0;
  v_failed int := 0;
  v_invoice_ids jsonb := '[]'::jsonb;
  v_errors jsonb := '[]'::jsonb;
  v_request_rid text := coalesce(nullif(btrim(p_request_rid), ''), format('cron:agreement_billing:%s', p_today));
begin
  if auth.role() <> 'service_role' then
    raise exception 'PERMISSION_DENIED' using errcode = '42501';
  end if;

  if p_today is null then
    raise exception 'TODAY_REQUIRED' using errcode = 'P0001';
  end if;

  for v_row in
    select *
    from public.lp_compute_agreements_due_today(p_today)
    order by provider_id, agreement_id
  loop
    v_candidates := v_candidates + 1;

    begin
      v_result := private.lp_generate_agreement_invoice_core(
        v_row.agreement_id,
        v_row.period_start,
        v_row.period_end,
        v_request_rid
      );

      if coalesce((v_result->>'skipped')::boolean, false) then
        v_skipped := v_skipped + 1;
      elsif coalesce((v_result->>'idempotent')::boolean, false) then
        v_skipped := v_skipped + 1;
        if v_result ? 'invoice_id' then
          v_invoice_ids := v_invoice_ids || jsonb_build_array(v_result->'invoice_id');
        end if;
      elsif coalesce((v_result->>'ok')::boolean, false) and v_result ? 'invoice_id' then
        v_generated := v_generated + 1;
        v_invoice_ids := v_invoice_ids || jsonb_build_array(v_result->'invoice_id');
      else
        v_skipped := v_skipped + 1;
      end if;
    exception
      when others then
        v_failed := v_failed + 1;
        v_errors := v_errors || jsonb_build_array(
          jsonb_build_object(
            'agreement_id', v_row.agreement_id,
            'provider_id', v_row.provider_id,
            'company_id', v_row.company_id,
            'period_start', v_row.period_start,
            'period_end', v_row.period_end,
            'sqlstate', sqlstate,
            'message', sqlerrm
          )
        );
    end;
  end loop;

  insert into public.lifecycle_audit_log (actor_id, action, entity_type, entity_id, reason, metadata)
  values (
    null,
    case when v_failed > 0 then 'agreement_billing_cron_partial' else 'agreement_billing_cron_completed' end,
    'agreement_billing_cron',
    v_run_id,
    null,
    jsonb_build_object(
      'run_id', v_run_id,
      'request_rid', v_request_rid,
      'today', p_today,
      'candidates_count', v_candidates,
      'generated_count', v_generated,
      'skipped_count', v_skipped,
      'failed_count', v_failed,
      'invoice_ids', v_invoice_ids,
      'errors', v_errors
    )
  );

  return jsonb_build_object(
    'ok', true,
    'run_id', v_run_id,
    'ran_at', v_ran_at,
    'today', p_today,
    'candidates_count', v_candidates,
    'generated_count', v_generated,
    'skipped_count', v_skipped,
    'failed_count', v_failed,
    'invoice_ids', v_invoice_ids,
    'errors', v_errors
  );
end;
$$;

revoke all on function public.lp_run_daily_agreement_billing(date, text) from public;
revoke all on function public.lp_run_daily_agreement_billing(date, text) from anon;
revoke all on function public.lp_run_daily_agreement_billing(date, text) from authenticated;
grant execute on function public.lp_run_daily_agreement_billing(date, text) to service_role;

-- ---------------------------------------------------------------------------
-- 4) Post-checks
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_proc
    where proname = 'lp_compute_agreements_due_today' and prosecdef
  ) then
    raise exception 'TPT-B-5: lp_compute_agreements_due_today missing';
  end if;

  if not exists (
    select 1 from pg_proc
    where proname = 'lp_run_daily_agreement_billing' and prosecdef
  ) then
    raise exception 'TPT-B-5: lp_run_daily_agreement_billing missing';
  end if;
end;
$$;
