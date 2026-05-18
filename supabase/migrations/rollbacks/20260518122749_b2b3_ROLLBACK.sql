-- MANUAL ROLLBACK ONLY — do not add to sequential migrate stack.
-- Reverts tg_audit_row() to B2b-2 (Art. 9 strip on order_items only; INSERT uses j_old/j_new).
--
-- Pair: supabase/migrations/20260518122749_b2b3_per_table_pii_strip.sql
-- schema_migrations.version on prod (MCP apply): 20260518122749

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
