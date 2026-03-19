# Supabase Database Health Check Audit Pack (Read-Only)

**Purpose:** A compact, production-safe SQL audit pack to detect important structural issues in the Lunchportalen Supabase database. All queries are **SELECT-only** and safe to run in the Supabase SQL Editor.

---

## 1. AUDIT PACK OVERVIEW

This pack covers:

- **RLS & keys:** Tables without primary keys, tables without RLS, and tables with RLS but no policies.
- **Indexing:** Foreign keys that may lack supporting indexes (lock/performance risk).
- **Key backoffice tables:** Index, trigger, policy, and column overview for: `content_pages`, `content_page_variants`, `media_items`, `forms`, `form_submissions`, `agreements`, `company_locations`, `companies`, `profiles`, `marketing_pages`.

No DDL, DML, or schema changes. Use results to decide where to add keys, RLS, policies, or indexes via separate migrations.

---

## 2. SQL CHECKS

### A. Public tables without primary keys

**Why it matters:** Tables without a primary key can complicate replication, backups, and safe updates; they are also a common audit finding.

```sql
-- A. Public tables without primary keys
SELECT t.schemaname,
       t.tablename
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
```

---

### B. Public tables without RLS enabled

**Why it matters:** Tables in `public` without RLS may be exposed to cross-tenant or over-privileged access if application code is wrong.

```sql
-- B. Public tables without RLS enabled
SELECT n.nspname AS schema_name,
       c.relname AS table_name
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind = 'r'
  AND NOT c.relrowsecurity
ORDER BY c.relname;
```

---

### C. Public tables with RLS enabled but zero policies

**Why it matters:** RLS with no policies typically denies all rows; this either indicates misconfiguration or an intentionally empty policy set (e.g. deny-all by design).

```sql
-- C. Public tables with RLS enabled but no policies
SELECT n.nspname AS schema_name,
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
```

---

### D. Foreign keys whose source columns may lack a supporting index

**Why it matters:** FK source columns without an index can cause slow deletes/updates on the referenced table and increase lock contention; this query highlights likely gaps.

```sql
-- D. Foreign keys possibly lacking supporting index on source columns
WITH fk_key_cols AS (
  SELECT c.conrelid AS table_oid,
         c.conname AS fk_name,
         (SELECT array_agg(attnum ORDER BY ord)
          FROM unnest(c.conkey::int[]) WITH ORDINALITY AS u(attnum, ord)) AS key_cols
  FROM pg_constraint c
  WHERE c.contype = 'f'
    AND c.connamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
),
index_key_cols AS (
  SELECT i.indrelid,
         (SELECT array_agg(k ORDER BY ord)
          FROM unnest(i.indkey::int[]) WITH ORDINALITY AS u(k, ord)) AS idx_cols
  FROM pg_index i
  WHERE i.indisvalid
)
SELECT n.nspname AS schema_name,
       t.relname AS table_name,
       fk.fk_name,
       fk.key_cols AS fk_column_attnums
FROM fk_key_cols fk
JOIN pg_class t ON t.oid = fk.table_oid
JOIN pg_namespace n ON n.oid = t.relnamespace AND n.nspname = 'public'
WHERE NOT EXISTS (
  SELECT 1 FROM index_key_cols ic
  WHERE ic.indrelid = fk.table_oid
    AND (
      ic.idx_cols = fk.key_cols
      OR (
        array_length(ic.idx_cols, 1) >= array_length(fk.key_cols, 1)
        AND ic.idx_cols[1:array_length(fk.key_cols, 1)] = fk.key_cols
      )
    )
)
ORDER BY n.nspname, t.relname, fk.fk_name;
```

*Note: A supporting index is one whose leading columns equal the FK columns (exact or prefix). Rows returned are FKs with no such index; consider adding an index on the FK source columns.*

---

### E. Index overview for key tables

**Why it matters:** Quick view of indexes on backoffice/CMS tables for performance and uniqueness checks.

```sql
-- E. Index overview for key backoffice tables
SELECT schemaname,
       tablename,
       indexname,
       indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN (
    'content_pages', 'content_page_variants', 'media_items',
    'forms', 'form_submissions', 'agreements', 'company_locations',
    'companies', 'profiles', 'marketing_pages'
  )
ORDER BY tablename, indexname;
```

---

### F. Trigger overview for key tables

**Why it matters:** Surfaces triggers (e.g. audit, outbox, timestamps) on critical tables.

```sql
-- F. Trigger overview for key backoffice tables
SELECT n.nspname AS schema_name,
       c.relname AS table_name,
       t.tgname AS trigger_name,
       p.proname AS function_name,
       CASE t.tgtype::integer & 66
         WHEN 2 THEN 'BEFORE'
         WHEN 64 THEN 'INSTEAD OF'
         ELSE 'AFTER'
       END AS timing,
       CASE
         WHEN t.tgtype::integer & 4 > 0 THEN 'INSERT'
         WHEN t.tgtype::integer & 8 > 0 THEN 'DELETE'
         WHEN t.tgtype::integer & 16 > 0 THEN 'UPDATE'
         ELSE 'UNKNOWN'
       END AS event
FROM pg_trigger t
JOIN pg_class c ON c.oid = t.tgrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
JOIN pg_proc p ON p.oid = t.tgfoid
WHERE n.nspname = 'public'
  AND c.relkind = 'r'
  AND NOT t.tgisinternal
  AND c.relname IN (
    'content_pages', 'content_page_variants', 'media_items',
    'forms', 'form_submissions', 'agreements', 'company_locations',
    'companies', 'profiles', 'marketing_pages'
  )
ORDER BY c.relname, t.tgname;
```

*Note: Event decoding is simplified (one of INSERT/DELETE/UPDATE). For full event sets, inspect `tgtype` in the docs.*

---

### G. Policy overview for key tables

**Why it matters:** Confirms RLS policy names, roles, and commands for tenant isolation and backoffice access.

```sql
-- G. Policy overview for key backoffice tables
SELECT schemaname,
       tablename,
       policyname,
       permissive,
       roles,
       cmd,
       qual IS NOT NULL AS has_using,
       with_check IS NOT NULL AS has_with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN (
    'content_pages', 'content_page_variants', 'media_items',
    'forms', 'form_submissions', 'agreements', 'company_locations',
    'companies', 'profiles', 'marketing_pages'
  )
ORDER BY tablename, policyname;
```

---

### H. Column overview for key backoffice tables

**Why it matters:** Quick schema snapshot (names, types, nullability) to spot missing or unexpected columns.

```sql
-- H. Column overview for key backoffice tables
SELECT table_schema,
       table_name,
       column_name,
       data_type,
       is_nullable,
       column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN (
    'content_pages', 'content_page_variants', 'media_items',
    'forms', 'form_submissions', 'agreements', 'company_locations',
    'companies', 'profiles', 'marketing_pages'
  )
ORDER BY table_name, ordinal_position;
```

---

## 3. HOW TO USE

- **Where to run:** Supabase Dashboard → SQL Editor. Run each query separately.
- **Good outcomes:**
  - **A:** Empty result = every public table has a primary key.
  - **B:** Empty or only intentional exceptions = all tenant/user tables have RLS.
  - **C:** Empty or only intentional deny-all tables = no RLS tables left without policies.
  - **D:** Empty = every FK has a matching index on source columns; any row is a candidate for adding an index (in a separate migration).
  - **E–H:** Use as reference; no single “pass/fail” — look for missing indexes on FKs, missing triggers you expect, or missing policies on key tables.
- **If rows appear:**
  - **A:** Plan a migration to add primary keys (and consider replication/backup impact).
  - **B:** Enable RLS on listed tables and add policies (or document why RLS is intentionally off).
  - **C:** Add policies or document that deny-all is intentional.
  - **D:** Consider adding an index on the FK source columns (same order as the FK) in a separate migration.
  - **E–H:** Use to drive targeted schema/RLS improvements; do not change schema from this document.

---

## 4. VERIFICATION AND FIXES

- **Verification script (read-only):** Run `docs/db/SUPABASE_HEALTH_VERIFICATION_RUN.sql` in the Supabase SQL Editor to re-check the four areas (A–D) after any fixes.
- **Report and suggested fixes:** See `docs/db/SUPABASE_HEALTH_VERIFICATION_REPORT.md` for how to interpret results (OK vs ISSUE FOUND), how to record findings, and idempotent SQL fix suggestions for each phase. Apply fixes only when verification returns rows.

*(Previously: fix-suggestions-only pass — now covered by the verification report.)*