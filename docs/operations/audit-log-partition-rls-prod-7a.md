# audit_log partition leak — prod apply + 7a verification

**Migration:** `20260613120000_audit_log_partition_rls_lockdown.sql`  
**Branch:** `fix/audit-log-partition-rls`

## Do not apply during pooler maintenance

Supabase pooler maintenance **eu-west-1** — avoid prod `db push` around **15:00** on maintenance day.

## Gated prod apply

1. Merge + workflow `supabase-migrate` (or manual `db push` **outside** 15:00 window).
2. Confirm migration version `20260613120000` in `supabase_migrations.schema_migrations`.

## 7a verification (read-only SQL on prod)

```sql
-- Privileges: anon/authenticated must NOT have SELECT on partitions
SELECT c.relname,
       has_table_privilege('anon', c.oid, 'SELECT') AS anon_sel,
       has_table_privilege('authenticated', c.oid, 'SELECT') AS auth_sel,
       c.relrowsecurity AS rls_on
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
JOIN pg_inherits i ON i.inhrelid = c.oid
JOIN pg_class p ON p.oid = i.inhparent
WHERE n.nspname = 'public' AND p.relname = 'audit_log'
ORDER BY c.relname
LIMIT 5;

-- API simulation: partition SELECT blocked
BEGIN;
SET LOCAL ROLE authenticated;
SELECT count(*) FROM public.audit_log_y2026m06;  -- expect ERROR permission denied OR 0
ROLLBACK;

-- Audit writes still work (postgres role / after order touch)
SELECT count(*) FROM public.audit_log WHERE created_at > now() - interval '1 hour';
```

Advisor: **RLS Disabled in Public** should clear for `audit_log_y*` partitions.
