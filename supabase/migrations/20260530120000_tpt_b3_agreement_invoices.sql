-- TPT-B-3 — Agreement invoice generation (Provider → Company billing)
-- Schema: agreement_invoices + agreement_invoice_lines
-- RPCs: lp_provider_generate_agreement_invoice_for_period, lp_generate_agreement_invoices_for_period
-- Worker dispatch → TPT-B-4

begin;

-- ---------------------------------------------------------------------------
-- 1) agreements: billing_cycle biweekly + invoicing metadata
-- ---------------------------------------------------------------------------
alter table public.agreements
  drop constraint if exists agreements_billing_cycle_check;

alter table public.agreements
  add constraint agreements_billing_cycle_check
  check (billing_cycle in ('monthly', 'biweekly'));

alter table public.agreements
  add column if not exists billing_anchor_date date,
  add column if not exists last_invoiced_at timestamptz;

-- ---------------------------------------------------------------------------
-- 2) agreement_invoices
-- ---------------------------------------------------------------------------
create table if not exists public.agreement_invoices (
  id uuid primary key default gen_random_uuid(),
  agreement_id uuid not null references public.agreements(id) on delete restrict,
  provider_id uuid not null references public.providers(id) on delete restrict,
  company_id uuid not null references public.companies(id) on delete restrict,
  invoice_period_start date not null,
  invoice_period_end date not null,
  billing_cycle text not null check (billing_cycle in ('monthly', 'biweekly')),
  invoice_number text,
  amount_net numeric(12, 2) not null default 0,
  amount_tax numeric(12, 2) not null default 0,
  amount_total numeric(12, 2) not null default 0,
  tripletex_vat_code text not null default 'MVA_15',
  status text not null default 'DRAFT' check (
    status in (
      'DRAFT', 'PENDING_SYNC', 'SENT', 'PAID', 'OVERDUE', 'SYNC_FAILED', 'VOID'
    )
  ),
  tripletex_invoice_id text,
  due_date date,
  sent_at timestamptz,
  paid_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (agreement_id, invoice_period_start)
);

create index if not exists idx_agreement_invoices_provider
  on public.agreement_invoices (provider_id);

create index if not exists idx_agreement_invoices_company
  on public.agreement_invoices (company_id);

create index if not exists idx_agreement_invoices_period
  on public.agreement_invoices (invoice_period_start, invoice_period_end);

comment on table public.agreement_invoices is
  'Flow B: provider → company meal invoices per agreement period. TPT-B-3.';

-- ---------------------------------------------------------------------------
-- 3) agreement_invoice_lines
-- ---------------------------------------------------------------------------
create table if not exists public.agreement_invoice_lines (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.agreement_invoices(id) on delete cascade,
  product_key text not null check (product_key in ('BASIS', 'LUXUS', 'ENTERPRISE', 'CUSTOM')),
  description text not null,
  quantity integer not null check (quantity > 0),
  unit_price numeric(12, 2) not null check (unit_price >= 0),
  line_amount numeric(12, 2) not null check (line_amount >= 0),
  vat_rate numeric(8, 4) not null check (vat_rate >= 0 and vat_rate <= 1),
  vat_amount numeric(12, 2) not null check (vat_amount >= 0),
  tax_code_id text not null references public.billing_tax_codes(id) on update cascade on delete restrict,
  created_at timestamptz not null default now()
);

create index if not exists idx_agreement_invoice_lines_invoice
  on public.agreement_invoice_lines (invoice_id);

comment on table public.agreement_invoice_lines is
  'Line items aggregated from billable orders (tier × unit_price). TPT-B-3.';

-- ---------------------------------------------------------------------------
-- 4) RLS
-- ---------------------------------------------------------------------------
alter table public.agreement_invoices enable row level security;
alter table public.agreement_invoice_lines enable row level security;

revoke all on public.agreement_invoices from public;
revoke all on public.agreement_invoices from anon;
revoke all on public.agreement_invoice_lines from public;
revoke all on public.agreement_invoice_lines from anon;

grant select on public.agreement_invoices to authenticated;
grant select on public.agreement_invoice_lines to authenticated;
grant all on public.agreement_invoices to service_role;
grant all on public.agreement_invoice_lines to service_role;

drop policy if exists agreement_invoices_superadmin_all on public.agreement_invoices;
create policy agreement_invoices_superadmin_all
  on public.agreement_invoices
  as permissive for all to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

drop policy if exists agreement_invoices_provider_select on public.agreement_invoices;
create policy agreement_invoices_provider_select
  on public.agreement_invoices
  as permissive for select to authenticated
  using (public.can_access_provider(provider_id));

drop policy if exists agreement_invoices_company_admin_select on public.agreement_invoices;
create policy agreement_invoices_company_admin_select
  on public.agreement_invoices
  as permissive for select to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role = 'company_admin'::public.user_role
        and p.company_id = agreement_invoices.company_id
    )
  );

drop policy if exists agreement_invoice_lines_superadmin_all on public.agreement_invoice_lines;
create policy agreement_invoice_lines_superadmin_all
  on public.agreement_invoice_lines
  as permissive for all to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

drop policy if exists agreement_invoice_lines_provider_select on public.agreement_invoice_lines;
create policy agreement_invoice_lines_provider_select
  on public.agreement_invoice_lines
  as permissive for select to authenticated
  using (
    exists (
      select 1 from public.agreement_invoices ai
      where ai.id = agreement_invoice_lines.invoice_id
        and public.can_access_provider(ai.provider_id)
    )
  );

drop policy if exists agreement_invoice_lines_company_admin_select on public.agreement_invoice_lines;
create policy agreement_invoice_lines_company_admin_select
  on public.agreement_invoice_lines
  as permissive for select to authenticated
  using (
    exists (
      select 1
      from public.agreement_invoices ai
      join public.profiles p on p.id = auth.uid()
      where ai.id = agreement_invoice_lines.invoice_id
        and p.role = 'company_admin'::public.user_role
        and p.company_id = ai.company_id
    )
  );

-- ---------------------------------------------------------------------------
-- 5) Outbox enqueue helper
-- ---------------------------------------------------------------------------
create or replace function private.lp_enqueue_agreement_invoice_outbox(
  p_invoice_id uuid,
  p_provider_id uuid,
  p_agreement_id uuid,
  p_request_rid text default null
)
returns text
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_event_key text;
  v_rid text;
begin
  v_rid := coalesce(
    nullif(btrim(coalesce(p_request_rid, '')), ''),
    replace(gen_random_uuid()::text, '-', '')
  );
  v_event_key := format('tripletex.agreement_invoice_create_provider:%s', p_invoice_id::text);

  insert into public.outbox (event_key, payload, status, attempts, last_error, locked_at, locked_by)
  values (
    v_event_key,
    jsonb_build_object(
      'invoice_id', p_invoice_id,
      'provider_id', p_provider_id,
      'agreement_id', p_agreement_id,
      'target', 'provider',
      'request_rid', v_rid
    ),
    'PENDING',
    0,
    null,
    null,
    null
  )
  on conflict (event_key) do nothing;

  return v_event_key;
end;
$$;

-- ---------------------------------------------------------------------------
-- 6) Core generator (SECURITY DEFINER — auth checked by public wrappers)
-- ---------------------------------------------------------------------------
create or replace function private.lp_generate_agreement_invoice_core(
  p_agreement_id uuid,
  p_period_start date,
  p_period_end date,
  p_request_rid text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_agreement public.agreements%rowtype;
  v_company public.companies%rowtype;
  v_existing uuid;
  v_existing_status text;
  v_invoice_id uuid;
  v_invoice_number text;
  v_event_key text;
  v_idempotent boolean := false;
  v_slug text;
  v_net numeric(12, 2) := 0;
  v_tax numeric(12, 2) := 0;
  v_total numeric(12, 2) := 0;
  v_primary_tax_code text := 'MVA_15';
  v_order_count int := 0;
  v_line record;
  v_tier text;
  v_tax_code_id text;
  v_vat_rate numeric(8, 4);
  v_line_net numeric(12, 2);
  v_line_tax numeric(12, 2);
  v_product_key text;
  v_desc text;
begin
  if p_agreement_id is null then
    raise exception 'AGREEMENT_ID_REQUIRED' using errcode = 'P0001';
  end if;

  if p_period_start is null or p_period_end is null then
    raise exception 'PERIOD_REQUIRED' using errcode = 'P0001';
  end if;

  if p_period_start > p_period_end then
    raise exception 'INVALID_PERIOD' using errcode = '22023';
  end if;

  select * into v_agreement
  from public.agreements a
  where a.id = p_agreement_id;

  if not found then
    raise exception 'AGREEMENT_NOT_FOUND' using errcode = 'P0002';
  end if;

  select * into v_company
  from public.companies c
  where c.id = v_agreement.company_id;

  if not found then
    raise exception 'COMPANY_NOT_FOUND' using errcode = 'P0002';
  end if;

  if upper(v_agreement.status::text) <> 'ACTIVE' then
    return jsonb_build_object(
      'ok', true,
      'skipped', true,
      'reason', 'AGREEMENT_NOT_ACTIVE',
      'agreement_id', p_agreement_id,
      'status', v_agreement.status::text
    );
  end if;

  if v_company.suspended_at is not null or v_company.paused_at is not null then
    return jsonb_build_object(
      'ok', true,
      'skipped', true,
      'reason', 'COMPANY_SUSPENDED_OR_PAUSED',
      'agreement_id', p_agreement_id,
      'company_id', v_company.id
    );
  end if;

  if exists (
    select 1 from public.providers p
    where p.id = v_agreement.provider_id
      and (p.suspended_at is not null or p.paused_at is not null or p.deleted_at is not null)
  ) then
    return jsonb_build_object(
      'ok', true,
      'skipped', true,
      'reason', 'PROVIDER_SUSPENDED_OR_PAUSED',
      'agreement_id', p_agreement_id,
      'provider_id', v_agreement.provider_id
    );
  end if;

  select ai.id, ai.status
    into v_existing, v_existing_status
  from public.agreement_invoices ai
  where ai.agreement_id = p_agreement_id
    and ai.invoice_period_start = p_period_start;

  if v_existing is not null then
    v_idempotent := true;
    v_invoice_id := v_existing;
    if v_existing_status = 'DRAFT' then
      v_event_key := private.lp_enqueue_agreement_invoice_outbox(
        v_invoice_id,
        v_agreement.provider_id,
        v_agreement.id,
        p_request_rid
      );
    end if;
    return jsonb_build_object(
      'ok', true,
      'invoice_id', v_invoice_id,
      'idempotent', v_idempotent,
      'event_key', v_event_key
    );
  end if;

  select count(*)::int into v_order_count
  from public.orders o
  where o.agreement_id = p_agreement_id
    and o.date >= p_period_start
    and o.date <= p_period_end
    and upper(o.status::text) not in ('CANCELLED');

  if v_order_count = 0 then
    return jsonb_build_object(
      'ok', true,
      'skipped', true,
      'reason', 'ZERO_ORDERS',
      'agreement_id', p_agreement_id,
      'period_start', p_period_start,
      'period_end', p_period_end
    );
  end if;

  select p.slug into v_slug
  from public.providers p
  where p.id = v_agreement.provider_id;

  insert into public.agreement_invoices (
    agreement_id,
    provider_id,
    company_id,
    invoice_period_start,
    invoice_period_end,
    billing_cycle,
    amount_net,
    amount_tax,
    amount_total,
    tripletex_vat_code,
    status,
    due_date,
    metadata
  )
  values (
    v_agreement.id,
    v_agreement.provider_id,
    v_agreement.company_id,
    p_period_start,
    p_period_end,
    coalesce(nullif(btrim(v_agreement.billing_cycle), ''), 'monthly'),
    0,
    0,
    0,
    v_primary_tax_code,
    'DRAFT',
    (p_period_end + interval '14 days')::date,
    jsonb_build_object(
      'generated_by', 'lp_provider_generate_agreement_invoice_for_period',
      'order_count', v_order_count
    )
  )
  returning id into v_invoice_id;

  v_invoice_number := format(
    'AGR-%s-%s-%s',
    upper(coalesce(nullif(btrim(v_slug), ''), 'PROV')),
    to_char(p_period_start, 'YYYYMMDD'),
    left(replace(v_invoice_id::text, '-', ''), 8)
  );

  update public.agreement_invoices
     set invoice_number = v_invoice_number
   where id = v_invoice_id;

  for v_line in
    select
      upper(o.tier::text) as tier,
      o.unit_price_nok::numeric(12, 2) as unit_price,
      count(*)::int as quantity,
      sum(o.unit_price_nok)::numeric(12, 2) as line_net
    from public.orders o
    where o.agreement_id = p_agreement_id
      and o.date >= p_period_start
      and o.date <= p_period_end
      and upper(o.status::text) not in ('CANCELLED')
    group by upper(o.tier::text), o.unit_price_nok
    order by upper(o.tier::text), o.unit_price_nok
  loop
    v_tier := v_line.tier;
    v_product_key := case
      when v_tier in ('BASIS', 'LUXUS', 'ENTERPRISE') then v_tier
      else 'CUSTOM'
    end;

    select bp.tax_code_id, btc.rate
      into v_tax_code_id, v_vat_rate
    from public.billing_products bp
    join public.billing_tax_codes btc on btc.id = bp.tax_code_id
    where bp.tier = case
      when v_product_key in ('BASIS', 'LUXUS', 'ENTERPRISE') then v_product_key
      else 'BASIS'
    end;

    if v_tax_code_id is null then
      select btc.id, btc.rate
        into v_tax_code_id, v_vat_rate
      from public.billing_tax_codes btc
      where btc.id = 'MVA_15';
    end if;

    v_line_net := round(v_line.line_net, 2);
    v_line_tax := round(v_line_net * coalesce(v_vat_rate, 0.15), 2);
    v_desc := format('%s måltid × %s kr', v_product_key, v_line.unit_price);

    insert into public.agreement_invoice_lines (
      invoice_id,
      product_key,
      description,
      quantity,
      unit_price,
      line_amount,
      vat_rate,
      vat_amount,
      tax_code_id
    )
    values (
      v_invoice_id,
      v_product_key,
      v_desc,
      v_line.quantity,
      v_line.unit_price,
      v_line_net,
      coalesce(v_vat_rate, 0.15),
      v_line_tax,
      coalesce(v_tax_code_id, 'MVA_15')
    );

    v_net := v_net + v_line_net;
    v_tax := v_tax + v_line_tax;
    v_primary_tax_code := coalesce(v_tax_code_id, v_primary_tax_code);
  end loop;

  v_total := v_net + v_tax;

  update public.agreement_invoices
     set amount_net = v_net,
         amount_tax = v_tax,
         amount_total = v_total,
         tripletex_vat_code = v_primary_tax_code,
         updated_at = now()
   where id = v_invoice_id;

  update public.agreements
     set last_invoiced_at = now(),
         updated_at = now()
   where id = v_agreement.id;

  insert into public.lifecycle_audit_log (actor_id, action, entity_type, entity_id, reason, metadata)
  values (
    auth.uid(),
    'agreement_invoice_generated',
    'agreement_invoice',
    v_invoice_id,
    format('Invoice %s for agreement %s', v_invoice_number, v_agreement.id),
    jsonb_build_object(
      'agreement_id', v_agreement.id,
      'provider_id', v_agreement.provider_id,
      'company_id', v_agreement.company_id,
      'period_start', p_period_start,
      'period_end', p_period_end,
      'amount_total', v_total,
      'line_count', v_order_count
    )
  );

  v_event_key := private.lp_enqueue_agreement_invoice_outbox(
    v_invoice_id,
    v_agreement.provider_id,
    v_agreement.id,
    p_request_rid
  );

  return jsonb_build_object(
    'ok', true,
    'invoice_id', v_invoice_id,
    'invoice_number', v_invoice_number,
    'amount_net', v_net,
    'amount_tax', v_tax,
    'amount_total', v_total,
    'order_count', v_order_count,
    'idempotent', false,
    'event_key', v_event_key
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- 7) Public RPC: single agreement
-- ---------------------------------------------------------------------------
create or replace function public.lp_provider_generate_agreement_invoice_for_period(
  p_agreement_id uuid,
  p_period_start date,
  p_period_end date,
  p_request_rid text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_agreement public.agreements%rowtype;
begin
  select * into v_agreement
  from public.agreements a
  where a.id = p_agreement_id;

  if not found then
    raise exception 'AGREEMENT_NOT_FOUND' using errcode = 'P0002';
  end if;

  if v_agreement.provider_id is null then
    raise exception 'AGREEMENT_PROVIDER_MISSING' using errcode = 'P0001';
  end if;

  perform private.lp_assert_provider_admin_or_superadmin(v_agreement.provider_id);

  return private.lp_generate_agreement_invoice_core(
    p_agreement_id,
    p_period_start,
    p_period_end,
    p_request_rid
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- 8) Public RPC: bulk (cron / service_role)
-- ---------------------------------------------------------------------------
create or replace function public.lp_generate_agreement_invoices_for_period(
  p_period_start date,
  p_period_end date,
  p_request_rid text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_agreement record;
  v_result jsonb;
  v_generated int := 0;
  v_skipped int := 0;
  v_errors jsonb := '[]'::jsonb;
  v_invoice_ids jsonb := '[]'::jsonb;
begin
  if not (public.is_platform_admin() or auth.role() = 'service_role') then
    raise exception 'PERMISSION_DENIED' using errcode = '42501';
  end if;

  if p_period_start is null or p_period_end is null then
    raise exception 'PERIOD_REQUIRED' using errcode = 'P0001';
  end if;

  for v_agreement in
    select a.id
    from public.agreements a
    join public.companies c on c.id = a.company_id
    join public.providers p on p.id = a.provider_id
    where upper(a.status::text) = 'ACTIVE'
      and c.suspended_at is null
      and c.paused_at is null
      and p.suspended_at is null
      and p.paused_at is null
      and p.deleted_at is null
    order by a.provider_id, a.id
  loop
    begin
      v_result := private.lp_generate_agreement_invoice_core(
        v_agreement.id,
        p_period_start,
        p_period_end,
        p_request_rid
      );

      if coalesce((v_result->>'skipped')::boolean, false) then
        v_skipped := v_skipped + 1;
      elsif coalesce((v_result->>'idempotent')::boolean, false) then
        v_skipped := v_skipped + 1;
        v_invoice_ids := v_invoice_ids || jsonb_build_array(v_result->'invoice_id');
      else
        v_generated := v_generated + 1;
        v_invoice_ids := v_invoice_ids || jsonb_build_array(v_result->'invoice_id');
      end if;
    exception
      when others then
        v_errors := v_errors || jsonb_build_array(
          jsonb_build_object(
            'agreement_id', v_agreement.id,
            'sqlstate', sqlstate,
            'message', sqlerrm
          )
        );
    end;
  end loop;

  return jsonb_build_object(
    'ok', true,
    'period_start', p_period_start,
    'period_end', p_period_end,
    'generated', v_generated,
    'skipped', v_skipped,
    'error_count', jsonb_array_length(v_errors),
    'errors', v_errors,
    'invoice_ids', v_invoice_ids
  );
end;
$$;

revoke all on function public.lp_provider_generate_agreement_invoice_for_period(uuid, date, date, text) from public;
revoke all on function public.lp_provider_generate_agreement_invoice_for_period(uuid, date, date, text) from anon;
grant execute on function public.lp_provider_generate_agreement_invoice_for_period(uuid, date, date, text)
  to authenticated, service_role;

revoke all on function public.lp_generate_agreement_invoices_for_period(date, date, text) from public;
revoke all on function public.lp_generate_agreement_invoices_for_period(date, date, text) from anon;
grant execute on function public.lp_generate_agreement_invoices_for_period(date, date, text)
  to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 9) Post-checks
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'agreement_invoices'
  ) then
    raise exception 'TPT-B-3: agreement_invoices missing';
  end if;

  if not exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'agreement_invoice_lines'
  ) then
    raise exception 'TPT-B-3: agreement_invoice_lines missing';
  end if;

  if not exists (
    select 1 from pg_proc where proname = 'lp_provider_generate_agreement_invoice_for_period' and prosecdef
  ) then
    raise exception 'TPT-B-3: lp_provider_generate_agreement_invoice_for_period missing';
  end if;

  if not exists (
    select 1 from pg_proc where proname = 'lp_generate_agreement_invoices_for_period' and prosecdef
  ) then
    raise exception 'TPT-B-3: lp_generate_agreement_invoices_for_period missing';
  end if;
end;
$$;

notify pgrst, 'reload schema';

commit;
