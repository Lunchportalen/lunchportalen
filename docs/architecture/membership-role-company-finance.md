# membership_role — `company_finance`

## Formål

Forberedelse til **company finance**-tilgang (CFO-lesing m.m.) uten å endre RLS eller app-routing i samme batch.

## Database

Migrasjon: `supabase/migrations/20260516230000_membership_role_add_company_finance.sql`

```sql
ALTER TYPE public.membership_role ADD VALUE IF NOT EXISTS 'company_finance';
```

Krever **PostgreSQL 15+** for `IF NOT EXISTS` på `ADD VALUE` (Supabase-kluster bruker typisk PG 15).

## Etter apply

1. Bekreft verdier: `SELECT unnest(enum_range(NULL::public.membership_role));`
2. Koble `company_finance` til `profiles` / auth i egne migrasjoner når roller er spesifisert.
3. Oppdater `lib/auth/role` og route guards når flyten er klar — **ikke** gjort i FASE 13-IMPL-3L.
