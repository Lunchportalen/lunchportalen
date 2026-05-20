# Patch 2.2 — billing_products kirurgisk apply (staging + prod)

**Dato:** 2026-05-20  
**Autorisert av:** Bruker (eksplisitt «GO Metode B»)  
**Metode:** MCP `apply_migration` (kirurgisk slice, ikke full `20260218`)

---

## Discovery (pre-apply)

| Funn | Detalj |
|------|--------|
| Kilde-migrasjon | `supabase/migrations/20260218_norwegian_standard_billing.sql` (340 linjer, 7 seksjoner) |
| `20260218` i `schema_migrations` (prod) | **Nei** |
| Delvis prod-state | `invoice_lines`, `tripletex_customers`, `outbox.payload` finnes; billing-tabeller manglet |
| Staging vs audit | PROVIDER-AUDIT antok staging hadde tabellen — **begge miljø manglet** `billing_products` / `billing_tax_codes` |
| Full fil risiko | `ALTER companies`, `ALTER outbox`, m.m. — **ikke** applyet i Patch 2.2 |

---

## Kirurgisk slice (seksjon 1+2 fra 20260218)

**Repo-fil:** `supabase/migrations/20260520140000_patch_2_2_billing_products_minimal.sql`

**DDL:** Eksakt kopi av `20260218` seksjon 1–2 (ikke forenklet utkast med `name`/`rate` som prosent):

- `billing_tax_codes`: `id`, `rate numeric(6,4)`, `tripletex_vat_code`, `description`, tidsstempler
- `billing_products`: `tier` CHECK (`BASIS`,`LUXUS`), FK til `billing_tax_codes`, seed «Firmalunsj LUXUS/BASIS»
- **ENTERPRISE:** ikke i CHECK; bevisst fail-closed (Patch 2.1)

**RLS:** Ingen policies (tom `pg_policies`; tilgang via service role i app).

---

## Apply-rekkefølge

| Steg | Miljø | `project_ref` | MCP `apply_migration` | Resultat |
|------|--------|---------------|------------------------|----------|
| 1 | Staging | `uigxsboqeruxflgzqztl` | `patch_2_2_billing_products_minimal` | `success: true` |
| 2 | Verifiser staging | — | `execute_sql` | PASS (se under) |
| 3 | Prod | `hkpokyapzarefrgqzkos` | `patch_2_2_billing_products_minimal` | `success: true` |
| 4 | Verifiser prod | — | `execute_sql` | PASS (se under) |

**Merk:** MCP registrerte migrasjon med tidsstempel-versjon (`20260520103552` staging, `20260520103602` prod). Repo-fil bruker `20260520140000` som sporbar kilde i git; SQL-innhold er identisk.

---

## Pre-state

| Miljø | `billing_tax_codes` | `billing_products` |
|-------|---------------------|-------------------|
| Staging | Nei | Nei |
| Prod | Nei | Nei |

---

## Post-state (verifisert 2026-05-20)

### Tabeller eksisterer

| Miljø | `billing_tax_codes` | `billing_products` |
|-------|---------------------|-------------------|
| Staging | Ja | Ja |
| Prod | Ja | Ja |

### Seed (begge miljø)

**`billing_tax_codes` (4 rader):** MVA_0, MVA_12, MVA_15, MVA_25 (rate 0.0000–0.2500, beskrivelse «Outgoing VAT …%»)

**`billing_products` (2 rader):**

| tier | product_name | tax_code_id | unit |
|------|--------------|-------------|------|
| BASIS | Firmalunsj BASIS | MVA_15 | stk |
| LUXUS | Firmalunsj LUXUS | MVA_15 | stk |

### ENTERPRISE guard

- `INSERT … tier='ENTERPRISE'` → `check_violation` (blokkert)
- `SELECT count(*) … WHERE tier='ENTERPRISE'` → **0** (staging + prod)

### Schema staging vs prod (`billing_products`)

Identisk (7 kolonner): `tier`, `product_name`, `tripletex_product_id`, `revenue_account`, `tax_code_id`, `unit`, `updated_at`.

### `schema_migrations` (topp etter prod-apply)

```
20260520103602  patch_2_2_billing_products_minimal
```

---

## Ikke inkludert (20260218 seksjon 3–6)

Vurderes i **egne patches** etter dedikert risikovurdering:

- `ALTER companies` billing-felt
- `invoice_exports`
- Videre `invoice_lines` / `tripletex_customers` constraints

---

## Referanser

- `scripts/audit/provider-audit-v1.md`
- `docs/audit/provider-plan-v1.md` (commit `08b3cf49`)
- Patch 2.1 (commit `37c51080`)

**Neste:** Patch 3 (Provider domain type).
