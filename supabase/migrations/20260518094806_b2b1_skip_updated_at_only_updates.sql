-- B2b-1 sub-task per docs/audit-log-strategy.md
--
-- Source analysis: 44.15% of historical audit_log UPDATE rows had
-- only updated_at changed (companies: 33.5%, company_memberships: 99.9%,
-- menu_service_days: 100%, menu_service_day_items: 99.6%).
--
-- This migration modifies tg_audit_row() to skip UPDATE-only
-- timestamp-touch events. INSERT and DELETE behavior is unchanged.
--
-- Applied on prod via MCP with schema_migrations.version = 20260518094806 (name b2b1_skip_updated_at_only_updates).
--
-- Rollback: see supabase/migrations/rollbacks/20260518094806_b2b1_ROLLBACK.sql
-- (manual apply only — not invoked by migrate). Previous function definition is
-- also preserved below as comment.
--
-- =============================================================================
-- PREVIOUS FUNCTION (for rollback reference):
-- =============================================================================
-- CREATE OR REPLACE FUNCTION public.tg_audit_row()
--  RETURNS trigger
--  LANGUAGE plpgsql
--  SECURITY DEFINER
--  SET search_path TO ''
-- AS $function$
-- declare
--   v_actor uuid;
--   v_record_id text;
-- begin
--   v_actor := auth.uid();
--   v_record_id := coalesce(to_jsonb(new) ->> 'id', to_jsonb(old) ->> 'id');
--
--   insert into public.audit_log (
--     actor_user_id,
--     table_name,
--     record_id,
--     action,
--     old_data,
--     new_data
--   )
--   values (
--     v_actor,
--     tg_table_schema || '.' || tg_table_name,
--     v_record_id,
--     tg_op,
--     case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) else null end,
--     case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) else null end
--   );
--
--   return coalesce(new, old);
-- end;
-- $function$;
-- =============================================================================

CREATE OR REPLACE FUNCTION public.tg_audit_row()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
declare
  v_actor uuid;
  v_record_id text;
  j_old jsonb;
  j_new jsonb;
begin
  v_actor := auth.uid();
  v_record_id := coalesce(to_jsonb(new) ->> 'id', to_jsonb(old) ->> 'id');

  -- B2b-1: skip UPDATE if only updated_at changed
  if tg_op = 'UPDATE' then
    j_old := to_jsonb(old);
    j_new := to_jsonb(new);
    if (j_new - 'updated_at') = (j_old - 'updated_at') then
      return new;
    end if;
  end if;

  insert into public.audit_log (
    actor_user_id,
    table_name,
    record_id,
    action,
    old_data,
    new_data
  )
  values (
    v_actor,
    tg_table_schema || '.' || tg_table_name,
    v_record_id,
    tg_op,
    case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) else null end,
    case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) else null end
  );

  return coalesce(new, old);
end;
$function$;
