-- TPT-A-5: Allow service_role (cron via supabaseAdmin) to run SaaS invoice RPCs.
-- Human callers still require platform admin; cron is gated by CRON_SECRET route only.

begin;

create or replace function public.lp_provider_generate_invoice_for_period(
  p_provider_id uuid,
  p_invoice_period date,
  p_request_rid text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_period date := date_trunc('month', coalesce(p_invoice_period, current_date))::date;
  v_sub public.provider_subscriptions%rowtype;
  v_rate numeric;
  v_net numeric(10, 2);
  v_tax numeric(10, 2);
  v_total numeric(10, 2);
  v_invoice_id uuid;
  v_invoice_number text;
  v_existing uuid;
  v_existing_status text;
  v_slug text;
  v_event_key text;
  v_idempotent boolean := false;
begin
  if not (public.is_platform_admin() or auth.role() = 'service_role') then
    raise exception 'PERMISSION_DENIED' using errcode = '42501';
  end if;

  select id, status
    into v_existing, v_existing_status
  from public.provider_invoices
  where provider_id = p_provider_id
    and invoice_period = v_period;

  if v_existing is not null then
    v_idempotent := true;
    v_invoice_id := v_existing;
    if v_existing_status = 'DRAFT' then
      v_event_key := private.lp_enqueue_saas_invoice_outbox(v_invoice_id, p_provider_id, p_request_rid);
    end if;
    return jsonb_build_object(
      'ok', true,
      'invoice_id', v_invoice_id,
      'idempotent', v_idempotent,
      'event_key', v_event_key
    );
  end if;

  select * into v_sub
  from public.provider_subscriptions
  where provider_id = p_provider_id
    and active_to is null
    and status = 'ACTIVE'
  order by active_from desc
  limit 1;

  if not found then
    raise exception 'ACTIVE_SUBSCRIPTION_NOT_FOUND' using errcode = 'P0002';
  end if;

  select btc.rate into v_rate
  from public.billing_tax_codes btc
  where btc.id = v_sub.tax_code_id;

  if v_rate is null then
    raise exception 'TAX_CODE_NOT_FOUND' using errcode = 'P0002';
  end if;

  v_net := round(v_sub.monthly_amount, 2);
  v_tax := round(v_net * v_rate, 2);
  v_total := v_net + v_tax;

  select p.slug into v_slug from public.providers p where p.id = p_provider_id;
  v_invoice_number := format(
    'LP-SAAS-%s-%s',
    upper(coalesce(nullif(btrim(v_slug), ''), 'PROV')),
    to_char(v_period, 'YYYYMM')
  );

  insert into public.provider_invoices (
    provider_id,
    subscription_id,
    invoice_number,
    invoice_period,
    amount_net,
    amount_tax,
    amount_total,
    tax_code_id,
    status,
    due_date,
    metadata
  )
  values (
    p_provider_id,
    v_sub.id,
    v_invoice_number,
    v_period,
    v_net,
    v_tax,
    v_total,
    v_sub.tax_code_id,
    'DRAFT',
    (v_period + interval '1 month' + interval '14 days')::date,
    jsonb_build_object('plan', v_sub.plan, 'generated_by', 'lp_provider_generate_invoice_for_period')
  )
  returning id into v_invoice_id;

  insert into public.lifecycle_audit_log (actor_id, action, entity_type, entity_id, reason, metadata)
  values (
    auth.uid(),
    'provider_invoice_generated',
    'provider_invoice',
    v_invoice_id,
    format('Invoice %s for period %s', v_invoice_number, v_period),
    jsonb_build_object(
      'provider_id', p_provider_id,
      'subscription_id', v_sub.id,
      'invoice_period', v_period,
      'amount_total', v_total
    )
  );

  v_event_key := private.lp_enqueue_saas_invoice_outbox(v_invoice_id, p_provider_id, p_request_rid);

  return jsonb_build_object(
    'ok', true,
    'invoice_id', v_invoice_id,
    'invoice_number', v_invoice_number,
    'amount_net', v_net,
    'amount_tax', v_tax,
    'amount_total', v_total,
    'idempotent', false,
    'event_key', v_event_key
  );
end;
$$;

create or replace function public.lp_generate_saas_invoices_for_period(
  p_invoice_period date default null,
  p_request_rid text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_period date := date_trunc('month', coalesce(p_invoice_period, current_date))::date;
  v_sub record;
  v_result jsonb;
  v_generated int := 0;
  v_skipped int := 0;
  v_errors jsonb := '[]'::jsonb;
  v_invoice_ids jsonb := '[]'::jsonb;
begin
  if not (public.is_platform_admin() or auth.role() = 'service_role') then
    raise exception 'PERMISSION_DENIED' using errcode = '42501';
  end if;

  for v_sub in
    select ps.provider_id
    from public.provider_subscriptions ps
    join public.providers p on p.id = ps.provider_id and p.deleted_at is null
    where ps.active_to is null
      and ps.status = 'ACTIVE'
    order by ps.provider_id
  loop
    begin
      v_result := public.lp_provider_generate_invoice_for_period(
        v_sub.provider_id,
        v_period,
        p_request_rid
      );
      if coalesce((v_result->>'idempotent')::boolean, false) then
        v_skipped := v_skipped + 1;
      else
        v_generated := v_generated + 1;
      end if;
      v_invoice_ids := v_invoice_ids || jsonb_build_array(v_result->'invoice_id');
    exception
      when others then
        v_errors := v_errors || jsonb_build_array(
          jsonb_build_object(
            'provider_id', v_sub.provider_id,
            'sqlstate', sqlstate,
            'message', sqlerrm
          )
        );
    end;
  end loop;

  return jsonb_build_object(
    'ok', true,
    'invoice_period', v_period,
    'generated', v_generated,
    'skipped_idempotent', v_skipped,
    'error_count', jsonb_array_length(v_errors),
    'errors', v_errors,
    'invoice_ids', v_invoice_ids
  );
end;
$$;

notify pgrst, 'reload schema';

commit;
