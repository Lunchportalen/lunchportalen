-- MANUAL ROLLBACK ONLY — do not add to sequential migrate stack.
-- Reverts tg_audit_row() to B2b-1 (skip updated_at-only UPDATEs; INSERT uses direct to_jsonb).
--
-- Pair: supabase/migrations/20260518112233_b2b2_strip_art9_health_data_order_items.sql
-- schema_migrations.version on prod (MCP apply): 20260518112233

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
