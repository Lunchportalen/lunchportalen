-- MANUAL ROLLBACK ONLY — do not add to sequential migrate stack.
-- Reverts tg_audit_row() to pre–B2b-1 behavior (log every INSERT/UPDATE/DELETE).
--
-- Pair: supabase/migrations/20260518094806_b2b1_skip_updated_at_only_updates.sql
-- schema_migrations.version on prod (MCP apply): 20260518094806

CREATE OR REPLACE FUNCTION public.tg_audit_row()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_actor uuid;
  v_record_id text;
begin
  v_actor := auth.uid();
  v_record_id := coalesce(to_jsonb(new) ->> 'id', to_jsonb(old) ->> 'id');

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
