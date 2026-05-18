-- B2b-2 sub-task per docs/audit-log-strategy.md (FASE B oppgave 2)
--
-- GDPR Art. 9: order_items.allergens_snapshot and order_items.dietary_tags_snapshot
-- are special-category personal data when stored as audit JSONB snapshots without
-- an explicit Art. 9 legal basis for audit retention.
--
-- This migration updates tg_audit_row() to omit those two keys from old_data/new_data
-- ONLY when tg_table_name = 'order_items'. All other audited tables are unchanged.
--
-- Design (locked):
-- - B2b-1 updated_at-only UPDATE skip still compares full row minus updated_at BEFORE strip.
-- - Changes only to allergens/dietary still produce an UPDATE audit row; payload omits values.
--
-- Applied on prod via MCP with schema_migrations.version = 20260518112233
-- (name b2b2_strip_art9_health_data_order_items).
--
-- Note: Previous B2b-1 INSERT used to_jsonb(old/new) in VALUES instead of j_old/j_new,
-- which blocked stripping. INSERT now uses j_old/j_new consistently (no semantic change
-- for tables other than order_items).
--
-- Rollback: see supabase/migrations/rollbacks/20260518112233_b2b2_ROLLBACK.sql
--
-- If profiles is ever added to the audit_row trigger list, extend this function to strip
-- profiles.allergy_notes and profiles.dietary_notes as well.
--
-- =============================================================================
-- PREVIOUS FUNCTION (B2b-1 — rollback reference):
-- =============================================================================
-- CREATE OR REPLACE FUNCTION public.tg_audit_row()
-- RETURNS trigger
-- LANGUAGE plpgsql
-- SECURITY DEFINER
-- SET search_path TO ''
-- AS $function$
-- declare
--   v_actor uuid;
--   v_record_id text;
--   j_old jsonb;
--   j_new jsonb;
-- begin
--   v_actor := auth.uid();
--   v_record_id := coalesce(to_jsonb(new) ->> 'id', to_jsonb(old) ->> 'id');
--
--   -- B2b-1: skip UPDATE if only updated_at changed
--   if tg_op = 'UPDATE' then
--     j_old := to_jsonb(old);
--     j_new := to_jsonb(new);
--     if (j_new - 'updated_at') = (j_old - 'updated_at') then
--       return new;
--     end if;
--   end if;
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
  v_record_id := coalesce(to_jsonb(new) ->> 'id',
                          to_jsonb(old) ->> 'id');

  j_old := case when tg_op in ('UPDATE', 'DELETE')
                then to_jsonb(old) else null end;
  j_new := case when tg_op in ('INSERT', 'UPDATE')
                then to_jsonb(new) else null end;

  -- B2b-1: skip UPDATE if only updated_at changed
  if tg_op = 'UPDATE' then
    if (j_new - 'updated_at') = (j_old - 'updated_at') then
      return new;
    end if;
  end if;

  -- B2b-2: strip GDPR Art. 9 health data from payload for order_items only.
  -- If profiles ever gets an audit_row trigger, MUST also strip allergy_notes / dietary_notes.
  if tg_table_name = 'order_items' then
    if j_old is not null then
      j_old := j_old - 'allergens_snapshot' - 'dietary_tags_snapshot';
    end if;
    if j_new is not null then
      j_new := j_new - 'allergens_snapshot' - 'dietary_tags_snapshot';
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
    j_old,
    j_new
  );

  return coalesce(new, old);
end;
$function$;
