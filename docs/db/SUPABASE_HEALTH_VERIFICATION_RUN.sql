-- =============================================================================
-- Supabase Health Audit — Verification (READ-ONLY)
-- =============================================================================
-- Run this entire script in Supabase SQL Editor. No DDL/DML; catalog only.
-- Empty result set = OK. Non-empty = findings to address.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- PHASE A: Public tables without primary keys
-- -----------------------------------------------------------------------------
SELECT
  t.schemaname AS schema_name,
  t.tablename AS table_name
FROM pg_tables t
JOIN pg_class c ON c.relname = t.tablename
JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = t.schemaname
WHERE t.schemaname = 'public'
  AND c.relkind = 'r'
  AND NOT EXISTS (
    SELECT 1
    FROM pg_constraint pc
    WHERE pc.conrelid = c.oid
      AND pc.contype = 'p'
  )
ORDER BY t.tablename;


-- -----------------------------------------------------------------------------
-- PHASE B: Public tables without RLS enabled
-- -----------------------------------------------------------------------------
SELECT
  n.nspname AS schema_name,
  c.relname AS table_name
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind = 'r'
  AND NOT c.relrowsecurity
ORDER BY c.relname;


-- -----------------------------------------------------------------------------
-- PHASE C: Public tables with RLS enabled but zero policies
-- -----------------------------------------------------------------------------
SELECT
  n.nspname AS schema_name,
  c.relname AS table_name
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind = 'r'
  AND c.relrowsecurity
  AND NOT EXISTS (
    SELECT 1 FROM pg_policies p
    WHERE p.schemaname = n.nspname AND p.tablename = c.relname
  )
ORDER BY c.relname;


-- -----------------------------------------------------------------------------
-- PHASE D: Foreign keys whose source columns lack a supporting index
--         (Returns column names for index suggestions.)
-- -----------------------------------------------------------------------------
WITH fk_key_cols AS (
  SELECT
    c.conrelid AS table_oid,
    c.conname AS fk_name,
    (SELECT array_agg(attnum ORDER BY ord)
     FROM unnest(c.conkey::int[]) WITH ORDINALITY AS u(attnum, ord)) AS key_attnums
  FROM pg_constraint c
  WHERE c.contype = 'f'
    AND c.connamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
),
index_key_cols AS (
  SELECT
    i.indrelid,
    (SELECT array_agg(k ORDER BY ord)
     FROM unnest(i.indkey::int[]) WITH ORDINALITY AS u(k, ord)) AS idx_cols
  FROM pg_index i
  WHERE i.indisvalid
)
SELECT
  n.nspname AS schema_name,
  t.relname AS table_name,
  fk.fk_name,
  (
    SELECT array_agg(a.attname ORDER BY ord)
    FROM unnest(fk.key_attnums) WITH ORDINALITY AS u(attnum, ord)
    JOIN pg_attribute a ON a.attrelid = fk.table_oid AND a.attnum = u.attnum
    WHERE NOT a.attisdropped
  ) AS fk_column_names
FROM fk_key_cols fk
JOIN pg_class t ON t.oid = fk.table_oid
JOIN pg_namespace n ON n.oid = t.relnamespace AND n.nspname = 'public'
WHERE NOT EXISTS (
  SELECT 1
  FROM index_key_cols ic
  WHERE ic.indrelid = fk.table_oid
    AND (
      ic.idx_cols = fk.key_attnums
      OR (
        array_length(ic.idx_cols, 1) >= array_length(fk.key_attnums, 1)
        AND ic.idx_cols[1:array_length(fk.key_attnums, 1)] = fk.key_attnums
      )
    )
)
ORDER BY n.nspname, t.relname, fk.fk_name;
