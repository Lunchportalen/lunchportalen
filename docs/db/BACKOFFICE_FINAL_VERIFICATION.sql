-- =============================================================================
-- Backoffice Final Verification (READ-ONLY)
-- Run in Supabase SQL Editor after schema/migration work.
-- Empty result = OK for that check. Non-empty = finding.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1A. content_pages: missing tree columns (expect 0 rows)
-- -----------------------------------------------------------------------------
SELECT 'content_pages_missing_tree_columns' AS check_name, column_name
FROM (VALUES ('tree_parent_id'), ('tree_root_key'), ('tree_sort_order')) AS v(column_name)
WHERE NOT EXISTS (
  SELECT 1 FROM information_schema.columns c
  WHERE c.table_schema = 'public' AND c.table_name = 'content_pages' AND c.column_name = v.column_name
);

-- -----------------------------------------------------------------------------
-- 1B. media_items table missing (expect 0 rows)
-- -----------------------------------------------------------------------------
SELECT 'media_items_table_missing' AS check_name
WHERE NOT EXISTS (
  SELECT 1 FROM information_schema.tables t
  WHERE t.table_schema = 'public' AND t.table_name = 'media_items'
);

-- -----------------------------------------------------------------------------
-- 1C. forms / form_submissions tables missing (expect 0 rows)
-- -----------------------------------------------------------------------------
SELECT 'forms_table_missing' AS check_name
WHERE NOT EXISTS (SELECT 1 FROM information_schema.tables t WHERE t.table_schema = 'public' AND t.table_name = 'forms')
UNION ALL
SELECT 'form_submissions_table_missing'
WHERE NOT EXISTS (SELECT 1 FROM information_schema.tables t WHERE t.table_schema = 'public' AND t.table_name = 'form_submissions');

-- -----------------------------------------------------------------------------
-- 1D. forms trigger (forms_updated_at_trigger) missing (expect 0 rows)
-- -----------------------------------------------------------------------------
SELECT 'forms_trigger_missing' AS check_name
WHERE NOT EXISTS (
  SELECT 1 FROM pg_trigger t
  JOIN pg_class c ON c.oid = t.tgrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relname = 'forms' AND t.tgname = 'forms_updated_at_trigger' AND NOT t.tgisinternal
);

-- -----------------------------------------------------------------------------
-- 1E. RLS not enabled on forms or form_submissions (expect 0 rows)
-- -----------------------------------------------------------------------------
SELECT 'rls_disabled' AS check_name, c.relname AS table_name
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relname IN ('forms', 'form_submissions') AND c.relkind = 'r'
  AND NOT c.relrowsecurity;

-- -----------------------------------------------------------------------------
-- 1F. forms or form_submissions with zero policies (expect 0 rows)
-- -----------------------------------------------------------------------------
SELECT 'no_policies' AS check_name, c.relname AS table_name
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relname IN ('forms', 'form_submissions') AND c.relkind = 'r'
  AND c.relrowsecurity
  AND NOT EXISTS (SELECT 1 FROM pg_policies p WHERE p.schemaname = n.nspname AND p.tablename = c.relname);

-- -----------------------------------------------------------------------------
-- 1G. FK support indexes: missing any of the six (expect 0 rows)
-- -----------------------------------------------------------------------------
SELECT 'fk_index_missing' AS check_name, v.index_name
FROM (VALUES
  ('content_pages_tree_parent_idx'),
  ('esg_daily_company_idx'),
  ('esg_daily_location_idx'),
  ('esg_monthly_company_idx'),
  ('form_submissions_created_by_idx'),
  ('invoice_lines_location_idx')
) AS v(index_name)
WHERE NOT EXISTS (
  SELECT 1 FROM pg_indexes i
  WHERE i.schemaname = 'public' AND i.indexname = v.index_name
);

-- -----------------------------------------------------------------------------
-- 1H. form_submissions: created_by column (for form_submissions_created_by_idx)
--     If missing, index migration would fail. Expect 0 rows if column present.
-- -----------------------------------------------------------------------------
SELECT 'form_submissions_created_by_column_missing' AS check_name
WHERE NOT EXISTS (
  SELECT 1 FROM information_schema.columns c
  WHERE c.table_schema = 'public' AND c.table_name = 'form_submissions' AND c.column_name = 'created_by'
);
