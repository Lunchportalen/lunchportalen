# Supabase Health Check — Fix Suggestions Only (Planning)

**Status:** No stored audit result file was found. Findings below are inferred from migration definitions so that suggested fixes match what the audit pack would report. **Do not execute SQL from this document** until you have run the audit and confirmed which issues apply to your database.

---

## 1. FINDINGS SUMMARY

| Check | Likely findings (from migrations) |
|-------|-----------------------------------|
| **A. Tables without primary key** | `invoice_exports`, `daily_company_rollup`, `daily_employee_orders` (each has a UNIQUE constraint but no PRIMARY KEY). |
| **B. Tables without RLS** | Several operational/billing tables (e.g. `invoice_exports`, `invoice_lines`, `daily_company_rollup`, `daily_employee_orders`, `esg_monthly`, `idempotency`, `audit_events`, `company_deletions`, system/ops tables) may appear if RLS was never enabled. Run audit B to get the exact list. |
| **C. RLS on but no policies** | Only if some table was set `ENABLE ROW LEVEL SECURITY` in a migration but no `CREATE POLICY` was added. Run audit C for the exact list. |
| **D. FK lacking supporting index** | `content_experiments.variant_id` references `content_page_variants(id)`; there is an index on `page_id` but none on `variant_id` alone. Audit D may report this FK. |
| **E–H. Key tables** | Use audit output to confirm indexes, triggers, and policies; no structural gaps inferred for the listed key backoffice tables beyond the variant_id index above. |

---

## 2. FIX SUGGESTIONS BY ISSUE

### Issue: Public table without primary key — `invoice_exports`

- **Why it matters:** No PK complicates replication, point-in-time recovery, and safe upserts; auditors often flag it.
- **Suggested SQL (idempotent):**

```sql
-- Only if audit A returns invoice_exports and (reference) is guaranteed unique in your data.
do $$
begin
  if to_regclass('public.invoice_exports') is not null
     and not exists (
       select 1 from pg_constraint
       where conrelid = 'public.invoice_exports'::regclass and contype = 'p'
     )
     and exists (
       select 1 from pg_constraint
       where conrelid = 'public.invoice_exports'::regclass and conname = 'invoice_exports_reference_uniq'
     )
  then
    alter table public.invoice_exports
      add constraint invoice_exports_pkey primary key (reference);
  end if;
end
$$;
```

- **Risk level:** Low if `reference` is already unique (enforced by existing unique constraint). Medium if duplicates exist (migration will fail; clean data first).

---

### Issue: Public table without primary key — `daily_company_rollup`

- **Why it matters:** Same as above; rollup tables benefit from a clear primary key for consistency and tooling.
- **Suggested SQL (idempotent):**

```sql
do $$
begin
  if to_regclass('public.daily_company_rollup') is not null
     and not exists (
       select 1 from pg_constraint
       where conrelid = 'public.daily_company_rollup'::regclass and contype = 'p'
     )
     and exists (
       select 1 from pg_constraint
       where conrelid = 'public.daily_company_rollup'::regclass and conname = 'daily_company_rollup_unique'
     )
  then
    alter table public.daily_company_rollup
      add constraint daily_company_rollup_pkey primary key (date, company_id, location_key, slot_key);
  end if;
end
$$;
```

- **Risk level:** Low. Uses the same columns as the existing unique constraint.

---

### Issue: Public table without primary key — `daily_employee_orders`

- **Why it matters:** Same as above.
- **Suggested SQL (idempotent):**

```sql
do $$
begin
  if to_regclass('public.daily_employee_orders') is not null
     and not exists (
       select 1 from pg_constraint
       where conrelid = 'public.daily_employee_orders'::regclass and contype = 'p'
     )
     and exists (
       select 1 from pg_constraint
       where conrelid = 'public.daily_employee_orders'::regclass and conname = 'daily_employee_orders_unique'
     )
  then
    alter table public.daily_employee_orders
      add constraint daily_employee_orders_pkey primary key (date, user_id, slot_key);
  end if;
end
$$;
```

- **Risk level:** Low.

---

### Issue: Public tables without RLS (audit B)

- **Why it matters:** Tables in `public` without RLS rely entirely on application and role permissions; one mistake can expose or corrupt data across tenants.
- **Suggested approach:** For each table returned by audit B, decide:
  - **Option 1 (preferred for tenant-sensitive data):** Enable RLS and add policies that restrict by `profiles.company_id` (or equivalent) for authenticated users; keep service role for backend jobs.
  - **Option 2 (operational/system tables):** Enable RLS and add a single policy that allows only `service_role` or specific roles (e.g. superadmin-only), or document why RLS is intentionally off.
- **Suggested SQL (template — enable RLS only; add policies in a separate migration):**

```sql
-- Apply only to tables that audit B lists and that you intend to protect.
-- Replace <table_name> with the actual table (e.g. invoice_exports).
do $$
begin
  if to_regclass('public.<table_name>') is not null then
    execute 'alter table public.<table_name> enable row level security';
  end if;
end
$$;
```

- **Risk level:** High if you enable RLS without adding policies (effectively deny-all). Always add at least one policy or document deny-all by design.

---

### Issue: Public tables with RLS but no policies (audit C)

- **Why it matters:** RLS with zero policies means no row is visible/insertable/updatable for normal roles; usually a misconfiguration.
- **Suggested approach:** For each table returned by audit C, either add appropriate policies (tenant-scoped or role-scoped) or document that deny-all is intentional (e.g. table only used by service role).
- **No generic SQL:** Policies must be defined per table and per role; use audit C output and your role model to draft `CREATE POLICY` statements in a separate migration.

- **Risk level:** High to enable access; low if you only document.

---

### Issue: Foreign key lacking supporting index — `content_experiments.variant_id`

- **Why it matters:** Deletes/updates on `content_page_variants(id)` can lock and scan `content_experiments` inefficiently without an index on `variant_id`.
- **Suggested SQL (idempotent):**

```sql
create index if not exists content_experiments_variant_id_idx
  on public.content_experiments (variant_id)
  where variant_id is not null;
```

- **Risk level:** Low. Partial index keeps size small and supports the FK.

---

### Issue: Other FKs reported by audit D

- **Why it matters:** Same as above for any FK listed by the audit.
- **Suggested approach:** For each row from audit D, add an index on the **source** table and column(s) of the FK, in the same order as the constraint. Example pattern:

```sql
-- Replace <table>, <column(s)> with the table and column(s) shown by the audit.
create index if not exists <table>_<column>_idx on public.<table> (<column>);
```

- **Risk level:** Low for adding indexes; validate table/column names from the audit.

---

## 3. PRIORITY ORDER

- **Critical**
  - Fix **RLS gaps (audit B)** on any table that holds tenant or user data (e.g. companies, profiles, orders, agreements, company_locations, and any billing/analytics table that is tenant-scoped). Enable RLS and add policies in the same or follow-up migration.
  - Fix **RLS with no policies (audit C)** so that tables that should be readable/writable have at least one policy; otherwise document deny-all.

- **Important**
  - Add **primary keys (audit A)** for `invoice_exports`, `daily_company_rollup`, `daily_employee_orders` so schema is consistent and tooling/replication behave predictably.
  - Add **index for `content_experiments.variant_id`** (and any other FK reported by audit D) to avoid lock and performance issues on referenced tables.

- **Nice to have**
  - Review index/trigger/policy overview (audit E–G) for key backoffice tables and add any missing indexes or policies that you discover from the output; no generic change required.

---

## 4. WHAT NOT TO TOUCH

- **Tables that already have PK + RLS + policies:** Core tenant tables (`companies`, `company_locations`, `agreements`, `profiles`, `orders`) already have RLS and tenant-scoped or self-scoped policies from `tenant_rls_hardening` and related migrations. Do not relax policies or disable RLS on them.
- **`profiles_company_id_idx`:** Already added in a prior migration; do not duplicate.
- **Content/backoffice tables with RLS and superadmin policies:** `content_pages`, `content_page_variants`, `media_items`, `forms`, `form_submissions`, and other CMS/backoffice tables already have RLS and policies; only add indexes or policies if the audit shows a gap (e.g. missing index on FK).
- **Outbox, idempotency, system tables:** RLS and policies for these are often minimal or service-role-only; change only after confirming with the audit and your runbook.
- **Schema and migrations:** Do not modify schema outside of new, reviewable migrations. Do not run the suggested SQL in this document until you have run the audit and decided which fixes to apply.

---

**Next step:** Run the [Supabase Health Check Audit Pack](./SUPABASE_HEALTH_CHECK_AUDIT_PACK.md) in the Supabase SQL Editor, capture the results, then apply only the fixes that correspond to the rows returned (and in the priority order above).
