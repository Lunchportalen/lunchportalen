-- FASE 13-IMPL-3O — Superadmin-tilgang til lp_company_order_summary
--
-- Bakgrunn: RPC brukte private.has_platform_role('platform_admin'), men den
-- helperen finnes ikke i repo-migrasjoner; exception-handler satte da
-- v_can_platform := false → superadmin uten firma-membership fikk FORBIDDEN.
--
-- Kilde for plattform-rettigheter i Lunchportalen (RLS overalt): profiles.role = 'superadmin'.
-- Bevarer funksjonssignatur og jsonb-retur uendret.

create or replace function public.lp_company_order_summary(
  p_company_id uuid,
  p_period_start date,
  p_period_end date
)
returns jsonb
language plpgsql
security definer
set search_path to public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_can_company boolean;
  v_can_platform boolean;
  v_company jsonb;
  v_per_user jsonb;
  v_total_meal_units bigint;
  v_active_order_count int;
  v_total_subtotal bigint;
  v_total_vat bigint;
  v_total_gross bigint;
  v_span int;
begin
  if v_uid is null then
    raise exception 'UNAUTHENTICATED' using errcode = 'P0001';
  end if;

  if p_company_id is null then
    raise exception 'INVALID_COMPANY_ID' using errcode = 'P0001';
  end if;

  if p_period_end < p_period_start then
    raise exception 'INVALID_PERIOD' using errcode = 'P0001';
  end if;

  v_span := (p_period_end - p_period_start);
  if v_span > 731 then
    raise exception 'PERIOD_TOO_LONG' using errcode = 'P0001';
  end if;

  select exists (
    select 1
    from public.company_memberships cm
    where cm.user_id = v_uid
      and cm.company_id = p_company_id
      and cm.status = 'active'::public.membership_status
      and cm.role::text in ('company_admin', 'company_finance')
  )
  into v_can_company;

  select exists (
    select 1
    from public.profiles p
    where p.id = v_uid
      and p.role::text = 'superadmin'
  )
  into v_can_platform;

  if not v_can_company and not v_can_platform then
    raise exception 'FORBIDDEN_NOT_COMPANY_ADMIN' using errcode = 'P0001';
  end if;

  select
    coalesce(sum(oi.quantity), 0)::bigint,
    coalesce(count(distinct o.id), 0)::int,
    coalesce(sum(oi.line_subtotal_cents_ex_vat), 0)::bigint,
    coalesce(sum(oi.line_vat_cents), 0)::bigint,
    coalesce(sum(oi.line_total_cents_inc_vat), 0)::bigint
  into
    v_total_meal_units,
    v_active_order_count,
    v_total_subtotal,
    v_total_vat,
    v_total_gross
  from public.orders o
  join public.order_items oi on oi.order_id = o.id
  where o.company_id = p_company_id
    and o.status = 'ACTIVE'::public.order_status
    and o.service_date >= p_period_start
    and o.service_date <= p_period_end;

  select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'user_id', x.user_id,
          'display_name', x.display_name,
          'active_order_count', x.active_order_count,
          'meal_units', x.meal_units,
          'subtotal_cents_ex_vat', x.subtotal_cents_ex_vat,
          'vat_cents', x.vat_cents,
          'gross_cents_inc_vat', x.gross_cents_inc_vat
        )
        order by x.gross_sort desc nulls last
      ),
      '[]'::jsonb
    )
  into v_per_user
  from (
    select
      o.user_id,
      coalesce(p.full_name, p.email, 'Ukjent') as display_name,
      count(distinct o.id)::int as active_order_count,
      coalesce(sum(oi.quantity), 0)::bigint as meal_units,
      coalesce(sum(oi.line_subtotal_cents_ex_vat), 0)::bigint as subtotal_cents_ex_vat,
      coalesce(sum(oi.line_vat_cents), 0)::bigint as vat_cents,
      coalesce(sum(oi.line_total_cents_inc_vat), 0)::bigint as gross_cents_inc_vat,
      coalesce(sum(oi.line_total_cents_inc_vat), 0)::bigint as gross_sort
    from public.orders o
    join public.order_items oi on oi.order_id = o.id
    join public.profiles p on p.id = o.user_id
    where o.company_id = p_company_id
      and o.status = 'ACTIVE'::public.order_status
      and o.service_date >= p_period_start
      and o.service_date <= p_period_end
    group by o.user_id, p.full_name, p.email
  ) x;

  v_company := jsonb_build_object(
    'company_id', p_company_id,
    'period_start', p_period_start,
    'period_end', p_period_end,
    'total_meal_units', v_total_meal_units,
    'active_order_count', v_active_order_count,
    'total_subtotal_cents_ex_vat', v_total_subtotal,
    'total_vat_cents', v_total_vat,
    'total_gross_cents_inc_vat', v_total_gross,
    'per_user', v_per_user
  );

  return jsonb_build_object(
    'summary', v_company
  );
end;
$$;

comment on function public.lp_company_order_summary(uuid, date, date) is
  'Firma-scope ordre-aggregering for company_admin / company_finance (membership) eller superadmin (profiles.role). Ingen produkt- eller valgdetaljer.';
