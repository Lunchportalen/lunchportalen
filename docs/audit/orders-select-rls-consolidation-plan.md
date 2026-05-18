# Orders SELECT RLS Consolidation Plan

**Fase:** P3.D4-SELECT-DESIGN  
**Opprettet:** 2026-05-18  
**Status:** Plan — implementering krever eksplisitt godkjenning  
**Prod-ref:** `hkpokyapzarefrgqzkos`

---

## Bakgrunn

**P3.D4** er hygiene-arbeid mot Supabase advisor-lint **`multiple_permissive_policies`** (lint `0006`) på `public.orders`. PostgreSQL evaluerer flere PERMISSIVE policies for samme `(table, cmd, role)` med **OR** — hver policy kjøres per rad, noe som gir unødvendig overhead uten tilgangsgevinst når policies overlapper.

**P3.D4-PARTIAL** (commit `546eccec`, migrasjon `20260518200000_drop_orders_permissive_none_policies.sql`) fjernet tre semantisk døde policies:

- `orders_delete_none` (`USING false`)
- `orders_insert_none` (`WITH CHECK false`)
- `orders_update_none` (`USING false`, `WITH CHECK false`)

Dette reduserte advisor-warnings på `orders` fra **4 til 1**. Ingen tilgang endret — policies med `false` er null-policies, ikke «default deny».

**SELECT-siden ble bevisst utsatt** fra D4-PARTIAL fordi de to gjenværende SELECT-policies **ikke er duplikater**. De dekker overlappende, men **ikke-identiske** auth-paths via to parallelle autorisasjonsmodeller. Feil konsolidering (f.eks. «behold kun den nyeste») kan gi tenant-lekkasje eller brutt tilgang — verste bug-klasse i systemet.

**Advisor-warning som gjenstår:**

| Lint | Tabell | cmd | Policies |
|------|--------|-----|----------|
| `0006_multiple_permissive_policies` | `public.orders` | SELECT | `{orders_select, orders_select_bridge_scoped}` |

Kilde: [docs/performance-baseline-rev-a.md](../performance-baseline-rev-a.md) rad 176 (Rev A snapshot; DELETE/INSERT/UPDATE `_none`-par fjernet i prod 2026-05-18).

---

## Nåværende tilstand (per 2026-05-18)

Etter P3.D4-PARTIAL har `public.orders` **5 policies** (RLS aktivert, `relforcerowsecurity=false`):

| policyname | cmd | USING (qual) | WITH CHECK |
|------------|-----|--------------|------------|
| `orders_delete` | DELETE | `private.can_edit_order(orders.id)` | — |
| `orders_insert` | INSERT | — | employee + location / manage / platform_admin\|ops |
| `orders_select` | SELECT | `private.can_view_order(orders.id)` | — |
| `orders_select_bridge_scoped` | SELECT | se under | — |
| `orders_update` | UPDATE | `private.can_view_order(orders.id)` | employee + location / manage / platform roles |

### Policy 1 — `orders_select`

```
USING ( SELECT private.can_view_order(orders.id) AS can_view_order )
```

`private.can_view_order(_order_id)` (SECURITY DEFINER, `search_path = ''`) returnerer true når ordren finnes og:

1. `o.user_id = auth.uid()` — eier
2. `private.can_finance_company(o.company_id)` — finance membership eller platform `finance_internal`
3. `private.can_manage_location(o.location_id)` — platform_admin/ops ELLER aktiv `company_memberships` med `role_is_location_manager`
4. `private.has_platform_role(platform_admin, platform_ops, kitchen, courier, finance_internal)` — global platform-tilgang via `platform_user_roles`

### Policy 2 — `orders_select_bridge_scoped`

```
USING (
  is_platform_admin()
  OR (user_id = auth.uid())
  OR can_admin_company(company_id)
  OR can_admin_location(location_id)
  OR can_kitchen_location(location_id)
  OR EXISTS (
    SELECT 1
    FROM deliveries d
    JOIN driver_runs dr ON dr.id = d.run_id
    WHERE d.company_id = orders.company_id
      AND d.location_id = orders.location_id
      AND d.date = orders.date
      AND dr.driver_user_id = auth.uid()
  )
)
```

Public bridge-helpers (SECURITY DEFINER, `search_path = 'public'`):

| Helper | Mekanisme |
|--------|-----------|
| `is_platform_admin()` | `is_superadmin()` OR `is_ops()` OR legacy `is_platform_admin_legacy()` |
| `can_admin_company(uuid)` | superadmin/ops OR `company_memberships.role = company_admin` OR `profiles.role = company_admin` |
| `can_admin_location(uuid)` | superadmin/ops OR location_admin membership OR company_admin for location |
| `can_kitchen_location(uuid)` | `profiles.role = kitchen` + aktiv `location_memberships` |

### Auth-path-kart

| Auth-path | `orders_select` | `bridge` |
|-----------|-----------------|----------|
| Eier (`user_id = auth.uid()`) | ✓ | ✓ |
| Finance (`can_finance_company` / `finance_internal`) | ✓ | ✗ |
| Location manager (`can_manage_location` / memberships) | ✓ | delvis via `can_admin_*` |
| Platform roller via PUR (`kitchen`, `courier`, …) | ✓ | ✗ |
| Legacy superadmin/ops (`profiles`, ikke PUR) | ✗ | ✓ via `is_platform_admin()` |
| Company admin via `profiles.role` (uten PUR) | delvis | ✓ via `can_admin_company` |
| Kitchen via `profiles` + `location_memberships` | ✗ | ✓ via `can_kitchen_location` |
| Driver via `deliveries × driver_runs` join | ✗ | ✓ |
| Courier global via PUR (uten aktiv run) | ✓ | ✗ |

Effektiv SELECT-tilgang i dag: **`can_view_order(id) OR bridge_expr(row)`** (permissive OR).

### 9-scenario matrise (fra P3.D4-AUDIT)

| # | Scenario | `orders_select` | `bridge` | Union (nå) |
|---|----------|-----------------|----------|------------|
| 1 | Employee — egen ordre | ✓ | ✓ | ✓ |
| 2 | Finance-bruker — company orders | ✓ | ✗ | ✓ |
| 3 | Legacy superadmin (`profiles`, ikke PUR) | ✗ | ✓ | ✓ |
| 4 | Kitchen via `profiles` + `location_memberships` (ikke PUR) | ✗ | ✓ | ✓ |
| 5 | Kitchen via PUR (ikke `profiles.role = kitchen`) | ✓ | ✗ | ✓ |
| 6 | Courier via PUR (global, uten run-join) | ✓ | ✗ | ✓ |
| 7 | Driver på aktiv run (ingen courier PUR) | ✗ | ✓ | ✓ |
| 8 | Company admin — egen tenant | ✓ | ✓ | ✓ |
| 9 | Company admin A — Company B ordre (cross-tenant) | ✗ | ✗ | ✗ |

Scenario 8–9: begge modeller bruker company/location-scope; korrekt union må **bevare deny** for cross-tenant.

---

## Problemets natur

### To parallelle auth-modeller

| Dimensjon | `private.*` (orders_select) | Public bridge (orders_select_bridge_scoped) |
|-----------|----------------------------|---------------------------------------------|
| Primær kilde | `platform_user_roles`, `company_memberships.status` | `profiles.role`, `is_superadmin()`, `location_memberships` |
| Platform admin | PUR `platform_admin` / `platform_ops` | `is_superadmin()` / `is_ops()` |
| Kitchen | PUR `kitchen` (global) | `profiles.role = kitchen` + location binding |
| Courier / driver | PUR `courier` (global) | Run-scoped via `deliveries × driver_runs` |
| Finance | `can_finance_company` + `finance_internal` | Ikke dekket |
| search_path | `''` (hard lock) | `'public'` |

### Hvorfor begge eksisterer

Bridge-policies og public helpers er **legacy** — skrevet da autorisasjon primært gikk via `profiles.role` og `is_superadmin()`. `private.*`-helpers er **nyere**, tenant-aware modell basert på `company_memberships` og `platform_user_roles`.

Capture-migrasjon `20260517000000_capture_prod_rls_drift.sql` dokumenterer at prod fortsatt har begge spor side om side; bridge ble bevisst bevart for å ikke bryte legacy-brukere under PUR-migrering.

### Hvorfor konsolidering ikke kan være «velg den nyeste»

| Feil valg | Konsekvens |
|-----------|------------|
| Behold kun `orders_select` | Brudd: legacy superadmin, kitchen (profiles), driver-run |
| Behold kun `bridge` | Brudd: finance, PUR kitchen/courier |
| OR i policy uten union-spec | Risiko for utilsiktet bredere tilgang eller manglende deny |

Korrekt mål: **én policy** som implementerer **eksakt union** av dagens effektive tilgang.

---

## Foreslått konsolidering — Fase 1 (RLS-only union)

### Strategi

1. **Utvid** `private.can_view_order(uuid)` med bridge-paths (ordre-scoped, ikke rad-basert).
2. **Behold** én SELECT-policy: `orders_select` med `USING (private.can_view_order(orders.id))`.
3. **DROP** `orders_select_bridge_scoped`.
4. Oppdater capture + golden snapshot; verifiser `body_hash` på `can_view_order` i `migrationParity.test.ts`.

Bridge-raduttrykk (`company_id`, `location_id`, `date` på rad) må **løftes inn** i funksjonen via lookup på `_order_id` — samme mønster som eksisterende `exists (select 1 from orders o where o.id = _order_id and ...)`.

### Pseudokode — utvidet `private.can_view_order`

```sql
-- Eksisterende logikk (uendret semantikk):
--   exists (select 1 from orders o where o.id = _order_id and (
--     o.user_id = auth.uid()
--     or can_finance_company(o.company_id)
--     or can_manage_location(o.location_id)
--   ))
--   or has_platform_role(admin, ops, kitchen, courier, finance_internal)

-- NYTT: bridge-union (ordre-scoped via o.*):
--   or exists (select 1 from orders o where o.id = _order_id and (
--     public.is_platform_admin()
--     or public.can_admin_company(o.company_id)
--     or public.can_admin_location(o.location_id)
--     or public.can_kitchen_location(o.location_id)
--     or exists (
--       select 1
--       from public.deliveries d
--       join public.driver_runs dr on dr.id = d.run_id
--       where d.company_id = o.company_id
--         and d.location_id = o.location_id
--         and d.date = o.date
--         and dr.driver_user_id = auth.uid()
--     )
--   ))

-- Merk: o.user_id = auth.uid() finnes allerede — ikke dupliser.
-- Merk: SECURITY DEFINER + search_path = '' krever fully-qualified public.* refs.
```

### Bevis — union dekker alle 9 scenarier

| # | Scenario | Dekkes av |
|---|----------|-----------|
| 1 | Employee egen ordre | Eksisterende `user_id = auth.uid()` |
| 2 | Finance | Eksisterende `can_finance_company` |
| 3 | Legacy superadmin | Ny: `is_platform_admin()` |
| 4 | Kitchen profiles+LM | Ny: `can_kitchen_location` |
| 5 | Kitchen PUR | Eksisterende `has_platform_role(kitchen)` |
| 6 | Courier PUR | Eksisterende `has_platform_role(courier)` |
| 7 | Driver aktiv run | Ny: deliveries join |
| 8 | Company admin egen tenant | Eksisterende `can_manage_location` og/eller ny `can_admin_company` |
| 9 | Cross-tenant deny | Ingen path matcher — union forblir false |

**Etter Fase 1:** effektiv tilgang = utvidet `can_view_order(id)` alene. Advisor SELECT-warning på `orders` → **0**.

### Migrasjonsrekkefølge (impl-fase, ikke nå)

1. `CREATE OR REPLACE FUNCTION private.can_view_order` (utvidet union)
2. `GRANT EXECUTE` (uendret — allerede til `authenticated`)
3. `DROP POLICY orders_select_bridge_scoped ON public.orders`
4. Smoke + testmatrise
5. Regenerer capture + golden

---

## Forutsetninger for Fase 1

| # | Forutsetning | Verifisert i audit |
|---|--------------|-------------------|
| F1 | Alle bridge-helpers finnes i prod og er stabile | ✓ `is_platform_admin`, `can_admin_company`, `can_admin_location`, `can_kitchen_location` |
| F2 | `deliveries`, `driver_runs` finnes for driver-join | ✓ brukt i dagens bridge-policy |
| F3 | `can_view_order` forblir SECURITY DEFINER, `search_path = ''` | ✓ dagens definisjon |
| F4 | Public helpers kan kalles fra `private.*` med fully-qualified navn | ✓ mønster brukt andre steder i capture |
| F5 | Eksisterende callers av `can_view_order` må ikke brytes | ✓ se under |

### Callers av `can_view_order` (må beholde semantikk eller få bevisst utvidelse)

| Objekt | Bruk |
|--------|------|
| `orders_select` | SELECT USING |
| `orders_update` | UPDATE USING (ser rad før endring) |
| `order_items_select` | SELECT USING |
| `order_items_update` | UPDATE USING |

**Viktig:** Utvidelse av `can_view_order` påvirker også UPDATE USING på `orders` og `order_items`. Det er **ønsket** hvis bridge i dag indirekte gir SELECT-tilgang som UPDATE USING også trenger (PostgreSQL krever SELECT-policy for UPDATE). Verifiser at ingen UPDATE WITH CHECK-regler åpnes utilsiktet — `can_edit_order` / INSERT WITH CHECK er separate gates.

---

## Testmatrise

Per scenario: definer testbruker, seed-data, forventet SELECT-resultat **før** og **etter** konsolidering (identisk).

### 10 konkrete testbrukere

| ID | Bruker | Oppsett | Mål-ordre | Før | Etter | Isolasjon |
|----|--------|---------|-----------|-----|-------|-----------|
| T1 | `employee_self` | Employee Company A, `profiles.location_id = LocA1` | Egen ordre O1 | SELECT ✓ | SELECT ✓ | — |
| T2 | `company_admin_a` | `profiles.role = company_admin`, Company A | Company A ordre O2 (annen employee) | SELECT ✓ | SELECT ✓ | Ser ikke Company B |
| T3 | `company_admin_b` | Samme som T2, Company B | Company A ordre O2 | SELECT ✗ | SELECT ✗ | **Cross-tenant deny** |
| T4 | `kitchen_pur` | PUR `kitchen`, ingen `profiles.role = kitchen` | LocA1 ordre O3 | SELECT ✓ | SELECT ✓ | — |
| T5 | `kitchen_profiles` | `profiles.role = kitchen` + `location_memberships` LocA1, **ingen** PUR kitchen | LocA1 ordre O3 | SELECT ✓ (bridge) | SELECT ✓ | — |
| T6 | `courier_pur` | PUR `courier`, ingen aktiv run | Vilkårlig ordre O4 | SELECT ✓ | SELECT ✓ | — |
| T7 | `driver_active` | Ingen PUR courier; `driver_runs.driver_user_id = uid` + matching `deliveries` for O5 `(company, location, date)` | O5 | SELECT ✓ (bridge) | SELECT ✓ | — |
| T8 | `driver_inactive` | Samme bruker som T7, run på annen dato / annet company | O5 | SELECT ✗ | SELECT ✗ | Run-scope |
| T9 | `finance` | `company_memberships` finance-rolle Company A, **ingen** admin | Company A ordre O6 | SELECT ✓ | SELECT ✓ | Ser ikke Company B |
| T10 | `legacy_superadmin` | `profiles.role = superadmin`, **ingen** PUR-rad | Any ordre O7 | SELECT ✓ (bridge) | SELECT ✓ | Platform-wide read OK |

### Testimplementering (impl-fase)

- **Manuell smoke:** MCP `execute_sql` med `set local role authenticated; set local request.jwt.claim.sub = ...` (eller staging branch med seed).
- **`tests/rls/tenantIsolation.final.test.ts`:** må forbli grønn — ingen cross-company leakage (T3 kritisk).
- **`tests/rls/migrationParity.test.ts`:** oppdater golden — `body_hash` for `private.can_view_order` endres; `orders`-policy_count 5 → 4; fjern `orders_select_bridge_scoped` key.
- **Negativ kontroll:** T3, T8 må returnere 0 rader / permission denied — identisk før/etter.

---

## Risiko og fallback

| Risiko | Mitigering |
|--------|------------|
| Union for bred — tenant-lekkasje | T3 cross-tenant + full `tenantIsolation.final.test.ts` før commit |
| Union for smal — brutt tilgang | T5, T7, T10 (bridge-only paths) |
| `can_view_order`-endring påvirker UPDATE USING uventet | Verifiser UPDATE WITH CHECK uendret; test read-only roller |
| search_path / SECURITY DEFINER regression | Behold `search_path = ''`; fully-qualified `public.*` |

### Rollback (pre-saved i impl-migrasjon header)

```sql
-- 1. Gjenopprett original can_view_order fra capture/pre-migration dump
-- 2. Gjenopprett bridge policy:
CREATE POLICY orders_select_bridge_scoped ON public.orders
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (
    is_platform_admin()
    OR (user_id = auth.uid())
    OR can_admin_company(company_id)
    OR can_admin_location(location_id)
    OR can_kitchen_location(location_id)
    OR (EXISTS (
      SELECT 1
      FROM deliveries d
      JOIN driver_runs dr ON dr.id = d.run_id
      WHERE d.company_id = orders.company_id
        AND d.location_id = orders.location_id
        AND d.date = orders.date
        AND dr.driver_user_id = auth.uid()
    ))
  );
```

Kilde for eksakt `can_view_order`-body: `supabase/migrations/20260517000000_capture_prod_rls_drift.sql` (pre-Fase-1 versjon) eller git `546eccec^`.

### Hvis Fase 1 brytes i prod

1. Kjør rollback SQL manuelt via MCP (read-only verify først).
2. Ikke fortsett med capture-regenerering før smoke grønn.
3. Ingen «hotfix» ved å legge til bredere OR uten testmatrise.

---

## Fase 2 (senere — auth-modell unifikasjon)

**Mål:** Én autoritativ auth-modell — enten PUR + memberships **eller** profiles-bridge, ikke begge.

| Aspekt | Fase 1 | Fase 2 |
|--------|--------|--------|
| Scope | RLS union i `can_view_order` | Migrer brukere/data til én modell |
| Kompleksitet | Høy (korrekt union) | Medium–høy (data + app + RLS) |
| Risiko | Begrenset til RLS-funksjon | App-routes, onboarding, role assignment |
| Avhengighet | Ingen | Krever inventory av alle `profiles.role` vs PUR vs memberships |

Fase 2 er **eksplisitt avgrenset** fra Fase 1. Fase 1 skal ikke vente på full auth-unifikasjon.

Estimat Fase 2: egen design-fase + migrasjonsplan (uker, ikke timer).

---

## Akseptansekriterier

- [ ] `multiple_permissive_policies` for `public.orders` SELECT = **0** (prod advisor)
- [ ] `tests/rls/tenantIsolation.final.test.ts` grønn
- [ ] 10-bruker testmatrise (T1–T10) identisk før/etter
- [ ] `migrationParity.test.ts` golden oppdatert (`can_view_order` hash, 4 orders policies)
- [ ] Capture + generator snapshot sync
- [ ] Ingen cross-tenant SELECT (T3 feiler korrekt)
- [ ] Rollback SQL dokumentert i migrasjon og testet på staging/branch

---

## Status

| Milepæl | Dato | Tilstand |
|---------|------|----------|
| P3.D4-AUDIT (read-only kartlegging) | 2026-05-18 | ✓ Fullført |
| P3.D4-PARTIAL (`*_none` drop) | 2026-05-18 | ✓ Prod + commit `546eccec` |
| P3.D4-SELECT-DESIGN (dette dokument) | 2026-05-18 | ✓ Plan |
| P3.D6 implementering | — | **ÅPEN** — krever eksplisitt godkjenning + frisk hode |

**Estimat impl-fase (P3.D6):** 2–4 timer design-review + migrasjon + apply + tester (staging før prod).

**Relaterte filer:**

- Backlog: [docs/performance-p-backlog.md](../performance-p-backlog.md) — P3.D4, P3.D6
- Partial migrasjon: `supabase/migrations/20260518200000_drop_orders_permissive_none_policies.sql`
- Capture: `supabase/migrations/20260517000000_capture_prod_rls_drift.sql`
