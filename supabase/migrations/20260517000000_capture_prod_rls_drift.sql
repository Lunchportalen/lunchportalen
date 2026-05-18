-- Capture-migration: speiler prod-RLS-kjerne (private.* helpers + ordre-/meny-tabeller) som manglet i migrasjonsrepo.
-- FASE 13.5-FIX-1. Idempotent: CREATE OR REPLACE på funksjoner; DROP POLICY IF EXISTS + CREATE POLICY for navngitte policyer.
-- Kilde: Supabase prod (MCP execute_sql) 2026-05-17; orders_*_none fjernet 2026-05-18 (P3.D4-PARTIAL). Endrer ikke semantikk når kodedef er identisk.
--
-- PAUSE / OMFANG: Full eksport av alle ~192 prod-policies er ikke i denne filen (for stor + navnedrift vs eldre migrasjoner).
-- Kjerne: private.* (tenant/meny/ordre), public bridge for orders_select_bridge_scoped, policies for orders / order_items / menu_service_* .
--
-- PRECONDITIONS: Krever prod-paritet på bl.a. public.company_locations, company_memberships, platform_user_roles, deliveries, driver_runs,
-- membership_role, is_superadmin(), is_ops(). Ren minimal-bootstrap uten disse feiler ved apply.
--
begin;


-- ---------------------------------------------------------------------------
-- Public bridge helpers (orders_select_bridge_scoped)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.is_platform_admin()
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_legacy boolean := false;
begin
  if coalesce(public.is_superadmin(), false) or coalesce(public.is_ops(), false) then
    return true;
  end if;

  if to_regprocedure('public.is_platform_admin_legacy()') is not null then
    execute 'select public.is_platform_admin_legacy()' into v_legacy;
    return coalesce(v_legacy, false);
  end if;

  return false;
end;
$function$;

CREATE OR REPLACE FUNCTION public.can_admin_company(company_uuid uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select
    public.is_superadmin()
    or public.is_ops()
    or exists (
      select 1
      from public.company_memberships cm
      where cm.user_id = (select auth.uid())
        and cm.company_id = company_uuid
        and cm.role = 'company_admin'::public.membership_role
        and cm.active = true
    )
    or exists (
      select 1
      from public.profiles p
      where p.id = (select auth.uid())
        and p.company_id = company_uuid
        and lower(coalesce(p.role::text, '')) = 'company_admin'
        and coalesce(p.active, true) = true
        and p.archived_at is null
        and p.disabled_at is null
    );
$function$;

CREATE OR REPLACE FUNCTION public.can_admin_location(location_uuid uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select
    public.is_superadmin()
    or public.is_ops()
    or exists (
      select 1
      from public.location_memberships lm
      where lm.user_id = (select auth.uid())
        and lm.location_id = location_uuid
        and lm.role = 'location_admin'::public.membership_role
        and lm.active = true
    )
    or exists (
      select 1
      from public.company_locations cl
      join public.company_memberships cm
        on cm.company_id = cl.company_id
       and cm.user_id = (select auth.uid())
       and cm.role = 'company_admin'::public.membership_role
       and cm.active = true
      where cl.id = location_uuid
    )
    or exists (
      select 1
      from public.profiles p
      where p.id = (select auth.uid())
        and p.location_id = location_uuid
        and lower(coalesce(p.role::text, '')) = 'location_admin'
        and coalesce(p.active, true) = true
        and p.archived_at is null
        and p.disabled_at is null
    )
    or exists (
      select 1
      from public.company_locations cl
      join public.profiles p
        on p.company_id = cl.company_id
       and p.id = (select auth.uid())
       and lower(coalesce(p.role::text, '')) = 'company_admin'
       and coalesce(p.active, true) = true
       and p.archived_at is null
       and p.disabled_at is null
      where cl.id = location_uuid
    );
$function$;

CREATE OR REPLACE FUNCTION public.can_kitchen_location(location_uuid uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1
    from public.profiles p
    join public.location_memberships lm
      on lm.user_id = p.id
     and lm.location_id = location_uuid
     and lm.active = true
    where p.id = auth.uid()
      and lower(coalesce(p.role::text, '')) = 'kitchen'
      and coalesce(p.active, true) = true
      and p.archived_at is null
      and p.disabled_at is null
  );
$function$;


-- ---------------------------------------------------------------------------
-- private.* helpers (SECURITY DEFINER) — rekkefølge: avhengigheter først
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION private.role_is_company_finance(_role text)
 RETURNS boolean
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$
  select coalesce(_role, '') = any (array[
    'company_owner',
    'owner',
    'company_admin',
    'admin',
    'finance'
  ]::text[]);
$function$;

CREATE OR REPLACE FUNCTION private.role_is_company_manager(_role text)
 RETURNS boolean
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$
  select coalesce(_role, '') = any (array[
    'company_owner',
    'owner',
    'company_admin',
    'admin'
  ]::text[]);
$function$;

CREATE OR REPLACE FUNCTION private.role_is_location_manager(_role text)
 RETURNS boolean
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$
  select coalesce(_role, '') = any (array[
    'company_owner',
    'owner',
    'company_admin',
    'admin',
    'location_manager',
    'manager'
  ]::text[]);
$function$;

CREATE OR REPLACE FUNCTION private.has_platform_role(_roles platform_role[])
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select exists (
    select 1
    from public.platform_user_roles pur
    where pur.user_id = (select auth.uid())
      and pur.role = any(_roles)
  );
$function$;

CREATE OR REPLACE FUNCTION private.is_platform_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select private.has_platform_role(array['platform_admin'::public.platform_role]);
$function$;

CREATE OR REPLACE FUNCTION private.shares_company_with(_other_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select
    (select private.is_platform_admin())
    or exists (
      select 1
      from public.company_memberships mine
      join public.company_memberships theirs
        on theirs.company_id = mine.company_id
      where mine.user_id = (select auth.uid())
        and mine.status = 'active'
        and theirs.user_id = _other_user_id
        and theirs.status = 'active'
    );
$function$;

CREATE OR REPLACE FUNCTION private.can_access_company(_company_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select
    (select private.has_platform_role(array[
      'platform_admin'::public.platform_role,
      'platform_ops'::public.platform_role,
      'finance_internal'::public.platform_role,
      'kitchen'::public.platform_role,
      'courier'::public.platform_role
    ]))
    or exists (
      select 1
      from public.company_memberships cm
      where cm.company_id = _company_id
        and cm.user_id = (select auth.uid())
        and cm.status = 'active'
    );
$function$;

CREATE OR REPLACE FUNCTION private.can_access_location(_location_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select
    (select private.has_platform_role(array[
      'platform_admin'::public.platform_role,
      'platform_ops'::public.platform_role,
      'kitchen'::public.platform_role,
      'courier'::public.platform_role,
      'finance_internal'::public.platform_role
    ]))
    or exists (
      select 1
      from public.company_memberships cm
      join public.company_locations l
        on l.company_id = cm.company_id
      where l.id = _location_id
        and cm.user_id = (select auth.uid())
        and coalesce(cm.status::text, '') = 'active'
        and (cm.location_id is null or cm.location_id = _location_id)
    );
$function$;

CREATE OR REPLACE FUNCTION private.can_manage_location(_location_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select
    (select private.has_platform_role(array[
      'platform_admin'::public.platform_role,
      'platform_ops'::public.platform_role
    ]))
    or exists (
      select 1
      from public.company_memberships cm
      join public.company_locations l
        on l.company_id = cm.company_id
      where l.id = _location_id
        and cm.user_id = (select auth.uid())
        and coalesce(cm.status::text, '') = 'active'
        and (select private.role_is_location_manager(cm.role::text))
        and (cm.location_id is null or cm.location_id = _location_id)
    );
$function$;

CREATE OR REPLACE FUNCTION private.can_manage_company(_company_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select
    (select private.has_platform_role(array[
      'platform_admin'::public.platform_role,
      'platform_ops'::public.platform_role
    ]))
    or exists (
      select 1
      from public.company_memberships cm
      where cm.company_id = _company_id
        and cm.user_id = (select auth.uid())
        and coalesce(cm.status::text, '') = 'active'
        and (select private.role_is_company_manager(cm.role::text))
    );
$function$;

CREATE OR REPLACE FUNCTION private.can_finance_company(_company_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select
    (select private.has_platform_role(array[
      'platform_admin'::public.platform_role,
      'finance_internal'::public.platform_role
    ]))
    or exists (
      select 1
      from public.company_memberships cm
      where cm.company_id = _company_id
        and cm.user_id = (select auth.uid())
        and coalesce(cm.status::text, '') = 'active'
        and (select private.role_is_company_finance(cm.role::text))
    );
$function$;

CREATE OR REPLACE FUNCTION private.can_access_menu_day(_menu_service_day_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select exists (
    select 1
    from public.menu_service_days msd
    where msd.id = _menu_service_day_id
      and (
        (msd.state in ('published', 'locked', 'archived') and (select private.can_access_location(msd.location_id)))
        or (select private.can_manage_location(msd.location_id))
        or (select private.has_platform_role(array[
          'platform_admin'::public.platform_role,
          'platform_ops'::public.platform_role
        ]))
      )
  );
$function$;

CREATE OR REPLACE FUNCTION private.can_manage_menu_day(_menu_service_day_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select exists (
    select 1
    from public.menu_service_days msd
    where msd.id = _menu_service_day_id
      and (
        (select private.can_manage_location(msd.location_id))
        or (select private.has_platform_role(array[
          'platform_admin'::public.platform_role,
          'platform_ops'::public.platform_role
        ]))
      )
  );
$function$;

CREATE OR REPLACE FUNCTION private.can_view_order(_order_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select exists (
    select 1
    from public.orders o
    where o.id = _order_id
      and (
        o.user_id = (select auth.uid())
        or (select private.can_finance_company(o.company_id))
        or (select private.can_manage_location(o.location_id))
      )
  )
  or (select private.has_platform_role(array[
    'platform_admin'::public.platform_role,
    'platform_ops'::public.platform_role,
    'kitchen'::public.platform_role,
    'courier'::public.platform_role,
    'finance_internal'::public.platform_role
  ]));
$function$;

CREATE OR REPLACE FUNCTION private.can_edit_order(_order_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select exists (
    select 1
    from public.orders o
    where o.id = _order_id
      and (
        o.user_id = (select auth.uid())
        or (select private.can_manage_location(o.location_id))
      )
  )
  or (select private.has_platform_role(array[
    'platform_admin'::public.platform_role,
    'platform_ops'::public.platform_role
  ]));
$function$;

CREATE OR REPLACE FUNCTION private.can_access_delivery_run(_delivery_run_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select exists (
    select 1
    from public.delivery_runs dr
    where dr.id = _delivery_run_id
      and (
        (select private.can_access_location(dr.location_id))
        or (select private.has_platform_role(array[
          'platform_admin'::public.platform_role,
          'platform_ops'::public.platform_role,
          'kitchen'::public.platform_role,
          'courier'::public.platform_role
        ]))
      )
  );
$function$;

CREATE OR REPLACE FUNCTION private.can_operate_delivery_run(_delivery_run_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select exists (
    select 1
    from public.delivery_runs dr
    where dr.id = _delivery_run_id
      and (
        (select private.can_manage_location(dr.location_id))
        or (select private.has_platform_role(array[
          'platform_admin'::public.platform_role,
          'platform_ops'::public.platform_role,
          'kitchen'::public.platform_role,
          'courier'::public.platform_role
        ]))
      )
  );
$function$;

CREATE OR REPLACE FUNCTION private.can_view_profile(_profile_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select
    _profile_id = (select auth.uid())
    or (select private.shares_company_with(_profile_id));
$function$;

CREATE OR REPLACE FUNCTION private.add_fk_if_possible(p_table text, p_column text, p_target_table text, p_target_column text, p_constraint_name text, p_on_delete text DEFAULT 'no action'::text)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
declare
  v_table regclass;
  v_target regclass;
begin
  v_table := to_regclass(p_table);
  v_target := to_regclass(p_target_table);

  if v_table is null or v_target is null then
    return;
  end if;

  if not exists (
    select 1
    from pg_attribute
    where attrelid = v_table
      and attname = p_column
      and not attisdropped
      and atttypid = 'uuid'::regtype
  ) then
    return;
  end if;

  if not exists (
    select 1
    from pg_attribute
    where attrelid = v_target
      and attname = p_target_column
      and not attisdropped
  ) then
    return;
  end if;

  if exists (
    select 1
    from pg_constraint
    where conname = p_constraint_name
      and conrelid = v_table
  ) then
    return;
  end if;

  execute format(
    'alter table %s add constraint %I foreign key (%I) references %s (%I) on delete %s',
    p_table,
    p_constraint_name,
    p_column,
    p_target_table,
    p_target_column,
    p_on_delete
  );
exception
  when duplicate_object then
    null;
  when undefined_table then
    null;
  when undefined_column then
    null;
  when datatype_mismatch then
    null;
end;
$function$;


-- ---------------------------------------------------------------------------
-- Grants (defense in depth; matcher typisk Supabase PostgREST)
-- ---------------------------------------------------------------------------

GRANT EXECUTE ON FUNCTION private.role_is_company_finance(text) TO authenticated;
GRANT EXECUTE ON FUNCTION private.role_is_company_manager(text) TO authenticated;
GRANT EXECUTE ON FUNCTION private.role_is_location_manager(text) TO authenticated;
GRANT EXECUTE ON FUNCTION private.has_platform_role(platform_role[]) TO authenticated;
GRANT EXECUTE ON FUNCTION private.is_platform_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION private.shares_company_with(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION private.can_access_company(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION private.can_access_location(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION private.can_manage_location(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION private.can_manage_company(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION private.can_finance_company(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION private.can_access_menu_day(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION private.can_manage_menu_day(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION private.can_view_order(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION private.can_edit_order(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION private.can_access_delivery_run(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION private.can_operate_delivery_run(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION private.can_view_profile(uuid) TO authenticated;


-- ---------------------------------------------------------------------------
-- Policies: menu + order core (prod policynavn og uttrykk)
-- ---------------------------------------------------------------------------

ALTER TABLE public.menu_service_days ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_service_day_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS menu_service_day_items_manage ON public.menu_service_day_items;
CREATE POLICY menu_service_day_items_manage ON public.menu_service_day_items
  AS PERMISSIVE FOR ALL TO authenticated
  USING ((SELECT private.can_manage_menu_day(menu_service_day_items.menu_service_day_id) AS can_manage_menu_day))
  WITH CHECK ((SELECT private.can_manage_menu_day(menu_service_day_items.menu_service_day_id) AS can_manage_menu_day));

DROP POLICY IF EXISTS menu_service_day_items_select ON public.menu_service_day_items;
CREATE POLICY menu_service_day_items_select ON public.menu_service_day_items
  AS PERMISSIVE FOR SELECT TO authenticated
  USING ((SELECT private.can_access_menu_day(menu_service_day_items.menu_service_day_id) AS can_access_menu_day));

DROP POLICY IF EXISTS menu_service_days_manage ON public.menu_service_days;
CREATE POLICY menu_service_days_manage ON public.menu_service_days
  AS PERMISSIVE FOR ALL TO authenticated
  USING ((SELECT private.can_manage_menu_day(menu_service_days.id) AS can_manage_menu_day))
  WITH CHECK ((SELECT private.can_manage_location(menu_service_days.location_id) AS can_manage_location));

DROP POLICY IF EXISTS menu_service_days_select ON public.menu_service_days;
CREATE POLICY menu_service_days_select ON public.menu_service_days
  AS PERMISSIVE FOR SELECT TO authenticated
  USING ((SELECT private.can_access_menu_day(menu_service_days.id) AS can_access_menu_day));

DROP POLICY IF EXISTS order_items_delete ON public.order_items;
CREATE POLICY order_items_delete ON public.order_items
  AS PERMISSIVE FOR DELETE TO authenticated
  USING ((SELECT private.can_edit_order(order_items.order_id) AS can_edit_order));

DROP POLICY IF EXISTS order_items_insert ON public.order_items;
CREATE POLICY order_items_insert ON public.order_items
  AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((SELECT private.can_edit_order(order_items.order_id) AS can_edit_order));

DROP POLICY IF EXISTS order_items_select ON public.order_items;
CREATE POLICY order_items_select ON public.order_items
  AS PERMISSIVE FOR SELECT TO authenticated
  USING ((SELECT private.can_view_order(order_items.order_id) AS can_view_order));

DROP POLICY IF EXISTS order_items_update ON public.order_items;
CREATE POLICY order_items_update ON public.order_items
  AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((SELECT private.can_view_order(order_items.order_id) AS can_view_order))
  WITH CHECK ((SELECT private.can_edit_order(order_items.order_id) AS can_edit_order));

DROP POLICY IF EXISTS orders_delete ON public.orders;
CREATE POLICY orders_delete ON public.orders
  AS PERMISSIVE FOR DELETE TO authenticated
  USING ((SELECT private.can_edit_order(orders.id) AS can_edit_order));

DROP POLICY IF EXISTS orders_insert ON public.orders;
CREATE POLICY orders_insert ON public.orders
  AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK ((((user_id = (SELECT auth.uid() AS uid)) AND (SELECT private.can_access_location(orders.location_id) AS can_access_location)) OR (SELECT private.can_manage_location(orders.location_id) AS can_manage_location) OR (SELECT private.has_platform_role(ARRAY['platform_admin'::platform_role, 'platform_ops'::platform_role]) AS has_platform_role)));

DROP POLICY IF EXISTS orders_select ON public.orders;
CREATE POLICY orders_select ON public.orders
  AS PERMISSIVE FOR SELECT TO authenticated
  USING ((SELECT private.can_view_order(orders.id) AS can_view_order));

DROP POLICY IF EXISTS orders_select_bridge_scoped ON public.orders;
CREATE POLICY orders_select_bridge_scoped ON public.orders
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (
(is_platform_admin() OR (user_id = auth.uid()) OR can_admin_company(company_id) OR can_admin_location(location_id) OR can_kitchen_location(location_id) OR (EXISTS ( SELECT 1
   FROM (deliveries d
     JOIN driver_runs dr ON ((dr.id = d.run_id)))
  WHERE ((d.company_id = orders.company_id) AND (d.location_id = orders.location_id) AND (d.date = orders.date) AND (dr.driver_user_id = auth.uid()))))))
  );

DROP POLICY IF EXISTS orders_update ON public.orders;
CREATE POLICY orders_update ON public.orders
  AS PERMISSIVE FOR UPDATE TO authenticated
  USING ((SELECT private.can_view_order(orders.id) AS can_view_order))
  WITH CHECK ((((user_id = (SELECT auth.uid() AS uid)) AND (SELECT private.can_access_location(orders.location_id) AS can_access_location)) OR (SELECT private.can_manage_location(orders.location_id) AS can_manage_location) OR (SELECT private.has_platform_role(ARRAY['platform_admin'::platform_role, 'platform_ops'::platform_role, 'kitchen'::platform_role, 'courier'::platform_role]) AS has_platform_role)));



commit;
