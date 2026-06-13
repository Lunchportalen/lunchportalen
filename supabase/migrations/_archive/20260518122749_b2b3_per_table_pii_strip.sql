-- B2b-3 sub-task per docs/audit-log-strategy.md (FASE B oppgave 2).
--
-- Extends tg_audit_row() with per-table stripping of approved PII and free-text fields
-- from audit_log payloads (preventive GDPR exposure reduction). B2b-1 (updated_at-only
-- UPDATE skip) and B2b-2 (order_items Art. 9 + j_old/j_new insert path) are preserved.
--
-- Owner-approved strip matrix (this migration only):
--
-- | order_items         | allergens_snapshot, dietary_tags_snapshot (B2b-2), notes
-- | orders              | customer_note, internal_note, note, cancel_reason,
-- |                       integrity_reason, integrity_rid
-- | delivery_runs       | courier_note, kitchen_note, received_by
-- | companies           | contact_name, contact_email, contact_phone, address,
-- |                       billing_email, delete_reason, orgnr, organization_number
-- |                       (name + timezone KEPT per owner)
-- | company_contracts   | notes
-- | company_memberships | employee_number (source KEPT per owner)
-- | billing_adjustments | description
-- | invoice_lines       | description, basis (entire JSONB key removed from audit)
-- | products            | description (name, sku, unit_name KEPT)
--
-- Unchanged tables this migration: company_product_prices, invoice_runs, location_policies,
-- menu_service_days, menu_service_day_items, etc.
--
-- Applied on prod via MCP with schema_migrations.version = 20260518122749.
-- Rollback: supabase/migrations/rollbacks/20260518122749_b2b3_ROLLBACK.sql (manual apply).
--
-- If profiles gains audit_row triggers, also strip allergy_notes / dietary_notes (see B2b-2 header).
--
-- =============================================================================
-- PREVIOUS FUNCTION (B2b-2 exact — rollback reference):
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
--   v_record_id := coalesce(to_jsonb(new) ->> 'id',
--                           to_jsonb(old) ->> 'id');
--
--   j_old := case when tg_op in ('UPDATE', 'DELETE')
--                 then to_jsonb(old) else null end;
--   j_new := case when tg_op in ('INSERT', 'UPDATE')
--                 then to_jsonb(new) else null end;
--
--   -- B2b-1: skip UPDATE if only updated_at changed
--   if tg_op = 'UPDATE' then
--     if (j_new - 'updated_at') = (j_old - 'updated_at') then
--       return new;
--     end if;
--   end if;
--
--   -- B2b-2: strip GDPR Art. 9 health data from payload for order_items only.
--   -- If profiles ever gets an audit_row trigger, MUST also strip allergy_notes / dietary_notes.
--   if tg_table_name = 'order_items' then
--     if j_old is not null then
--       j_old := j_old - 'allergens_snapshot' - 'dietary_tags_snapshot';
--     end if;
--     if j_new is not null then
--       j_new := j_new - 'allergens_snapshot' - 'dietary_tags_snapshot';
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
--     j_old,
--     j_new
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

  -- B2b-2 Art. 9 + B2b-3 per-table PII / free-text stripping
  if tg_table_name = 'order_items' then
    -- B2b-2: allergens / dietary snapshots (GDPR Art. 9).
    -- B2b-3: free-text notes.
    if j_old is not null then
      j_old := j_old - 'allergens_snapshot' - 'dietary_tags_snapshot' - 'notes';
    end if;
    if j_new is not null then
      j_new := j_new - 'allergens_snapshot' - 'dietary_tags_snapshot' - 'notes';
    end if;
  elsif tg_table_name = 'orders' then
    if j_old is not null then
      j_old := j_old - 'customer_note' - 'internal_note' - 'note' - 'cancel_reason'
                     - 'integrity_reason' - 'integrity_rid';
    end if;
    if j_new is not null then
      j_new := j_new - 'customer_note' - 'internal_note' - 'note' - 'cancel_reason'
                     - 'integrity_reason' - 'integrity_rid';
    end if;
  elsif tg_table_name = 'delivery_runs' then
    if j_old is not null then
      j_old := j_old - 'courier_note' - 'kitchen_note' - 'received_by';
    end if;
    if j_new is not null then
      j_new := j_new - 'courier_note' - 'kitchen_note' - 'received_by';
    end if;
  elsif tg_table_name = 'companies' then
    -- Keep name + timezone per owner decision.
    if j_old is not null then
      j_old := j_old - 'contact_name' - 'contact_email' - 'contact_phone' - 'address'
                     - 'billing_email' - 'delete_reason' - 'orgnr' - 'organization_number';
    end if;
    if j_new is not null then
      j_new := j_new - 'contact_name' - 'contact_email' - 'contact_phone' - 'address'
                     - 'billing_email' - 'delete_reason' - 'orgnr' - 'organization_number';
    end if;
  elsif tg_table_name = 'company_contracts' then
    if j_old is not null then
      j_old := j_old - 'notes';
    end if;
    if j_new is not null then
      j_new := j_new - 'notes';
    end if;
  elsif tg_table_name = 'company_memberships' then
    if j_old is not null then
      j_old := j_old - 'employee_number';
    end if;
    if j_new is not null then
      j_new := j_new - 'employee_number';
    end if;
  elsif tg_table_name = 'billing_adjustments' then
    if j_old is not null then
      j_old := j_old - 'description';
    end if;
    if j_new is not null then
      j_new := j_new - 'description';
    end if;
  elsif tg_table_name = 'invoice_lines' then
    if j_old is not null then
      j_old := j_old - 'description' - 'basis';
    end if;
    if j_new is not null then
      j_new := j_new - 'description' - 'basis';
    end if;
  elsif tg_table_name = 'products' then
    if j_old is not null then
      j_old := j_old - 'description';
    end if;
    if j_new is not null then
      j_new := j_new - 'description';
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
