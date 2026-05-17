# Multi-Tenant Pen-Test Discovery (Rev A)

## Metadata

- **Sesjon:** 2026-05-17 / 2026-05-18  
- **Repository-basis (før denne leveransen):** `5357d516dab810ab3a2ac4c080f65283ce397181`  
- **Full sporbarhet etter commit:** kjør `git log -1 --format=%H -- docs/multitenant-pen-test-discovery.md` for SHA som inneholder dette dokumentet.  
- **Eksisterende dekning (fra tidligere arbeid):**  
  - `tests/tenant-isolation-api-gate.test.ts` (3 ruter)  
  - `tests/rls/` (3 tester)  
  - `tests/security/` (5 filer)  
  - `tests/auth/` (21 filer)  

## Viktig presisering (heuristikk)

Ruter som **ikke** inneholder strengene `routeGuard`, `readScopeOr401`, `requireAuthedScope`, `resolveScope`, `ScopeOr401`, `scopeOr401` eller `getScope`, er **ikke** automatisk uautoriserte. Mange bruker **`supabaseServer()` + `auth.getUser()`**, **`requireCronAuth`**, **`isSuperadminProfile`**, invite-token, API-nøkkel (`getTenantContext`), eller ren redirect. Tallet **204** betyr «uten de valgte søkestrengene», **ikke** «uten auth».

## Auth-overflate (grep-basert, Rev A)

| Måling | Antall |
|--------|--------:|
| Totalt `app/api/**/route.ts` | 581 |
| Med `routeGuard` / `scopeOr401` / `getScope`-mønster (samme regex som i journal) | 377 |
| Med `getAuthContext` eller `requireAuth` | 8 (sekundært mønster) |
| Uten kjente auth-strings over (≈ **bucket**) | **204** — krever manuell bucket / stikkprøver |
| `route.ts` som importerer `@/lib/supabase/admin` (server-side `service_role`) | ~290+ filer — **forventet** på serversiden; risiko ligger i **feil bruk** (spørring uten binding til session-scope), ikke i selve importen |

## Bucket av 204 ruter uten «kjent auth-mønster» (per `app/api/<segment>/`)

Klassifisering: **Forventet auth** er kort forklart. **Status** etter stikkprøve (der utført): *OK* / *P1* (nærmere gjennomgang anbefalt). **Ingen P0** er påvist i stikkprøvene under; eventuelle kritiske funn skal behandles utenfor dette dokumentet til eier har revidert.

| Segment | Antall | Forventet auth | Status | Action |
|---------|-------:|----------------|--------|--------|
| `cron/*` | 61 | `requireCronAuth` e.l. / hemmelig header | OK i stikkprøve (`cron/week-visibility`: `requireCronAuth` på GET) | P1: bekreft alle 61 mot samme mønster |
| `superadmin/*` | 35 | `getUser` + `isSuperadminProfile` e.l. | OK i stikkprøve (`superadmin/audit-write`) | P1: verifiser at alle 35 følger plattform-admin-mønster |
| `ai/*` | 27 | Ofte `withApiAiEntrypoint`; variabel session | P1 | Klassifiser per rute (No-RLS/egen risiko for abuse) |
| `auth/*` | 13 | Auth-flyt (session, login, tokens) | OK forventet | Verifiser at ingen eksponerer tenant-data uten session |
| `public/*` | 10 | Offentlig med validering / rate limit | OK i stikkprøve (`public/analytics`) | P1: bekreft ingen lekkasje av tenant-data |
| `admin/*` | 6 | Invite-token / `getAdmin` / roller | OK i stikkprøve (`admin/accept-invite/complete`) | P1: full gjennomgang |
| `experiments/*` | 3 | Validering + ofte `supabaseAdmin` | P1 (`experiments/track`: ingen user-session; skriver via admin etter validering) | Avvei abuse vs. tenant |
| `health/*` | 3 | Ofte åpen health (drift) | P1 (`health`: bruker `supabaseAdmin` for ping — operativ risiko, ikke nødvendigvis tenant-lekk) | Begrens informasjonsinnhold i svar |
| `kitchen/*` | 3 | Redirect eller delegering | OK i stikkprøve (`kitchen/today`: 307 til `/api/kitchen/day`) | Verifiser at mål-route har auth |
| `order/*` | 3 | Cookie/session server client + company-guards (`assertCompanyActiveOr403`, `orderWriteGuard` m.m.) | OK i stikkprøve (`order/cancel`: `createServerClient` + guard-lag + `supabaseAdmin` der påkrevd) | P1: bekreft alle tre filer eksplisitt |
| `system/*` | 3 | Varierende (tid, kontrollplan, etc.) | P1 | Stikkprøve / liste |
| `address/*` | 2 | Typisk offentlig søk / autoutfyll | P1 | — |
| `content/*` | 2 | Cache / offentlig header? | P1 | — |
| `edge/*` | 2 | Metrics / edge | P1 | — |
| `me/*` | 2 | Session-bruker | P1 | — |
| `onboarding/*` | 2 | Offentlig / delvis auth | P1 | — |
| `orders/*` | 2 | **Eksempel:** `orders/[orderId]/toggle` har **ikke** `scopeOr401`-streng, men **har** `getUser`, rolle-gate, `company_id`-filter på ordre | OK i stikkprøve | Inkluder i fremtidig gate som «auth via annet mønster» |
| `outbox/*` | 2 | Intern / retry | P1 | — |
| `profile/*` | 2 | Session + scope | P1 | — |
| `accept-invite` | 1 | Token-flyt | P1 | — |
| `agreements` | 1 | `getUser` + RLS + admin for signert URL (`agreements/my-latest`) | OK i stikkprøve | — |
| `backoffice` | 1 | Secret / `withApiAiEntrypoint` + auth (eks.: `backoffice/experiments/event`: `x-lp-experiment-secret`) | OK i stikkprøve | P1: verifiser konsistens |
| `company` | 1 | Registrering / admin | P1 | — |
| `contact` | 1 | Offentlig skjema | P1 | — |
| `driver` | 1 | Operativ bekreftelse | P1 | — |
| `integrations` | 1 | Sannsynligvis hemmelig trigger | P1 | — |
| `internal` | 1 | Intern scheduler | P1 | — |
| `observability` | 1 | Observabilitet | P1 | — |
| `pitch` | 1 | Salg/marked | P1 | — |
| `register` | 1 | Registrering | P1 | — |
| `sales` | 1 | Salgs-endepunkt | P1 | — |
| `scope` | 1 | Scope options (ofte admin + session) | P1 | — |
| `social` | 1 | Redirect/sporing | P1 | — |
| `support` | 1 | Support-rapport | P1 | — |
| `saas` | 1 | Webhook / billing | P1 | — |
| `track` | 1 | Klikk-sporing | P1 | — |
| `v1` | 1 | **API-nøkkel** (`getTenantContext`) — `v1/public/orders` | OK i stikkprøve | P1: nøkkelrotasjon / rate limit |
| `webhooks` | 1 | Signatur / hemmelighet (Sanity) | P1 | — |
| `week` | 1 | Uke-data | P1 | — |

**Stikkprøver (Rev A, filsti → funn):**

1. `app/api/cron/week-visibility/route.ts` — `requireCronAuth` før kjernelogikk (GET).  
2. `app/api/superadmin/audit-write/route.ts` — `getUser` + `isSuperadminProfile`; deretter `service_role` for audit-insert.  
3. `app/api/ai/continue/route.ts` — `withApiAiEntrypoint`; ingen session i filen; statisk generering (ingen tenant-DB i stikkprøve).  
4. `app/api/auth/session/route.ts` — bevisst token-sett session (`setSession`).  
5. `app/api/public/analytics/route.ts` — offentlig POST med validering og rate limit.  
6. `app/api/admin/accept-invite/complete/route.ts` — invite-token + `supabaseAdmin` for oppslag.  
7. `app/api/agreements/my-latest/route.ts` — `getUser` + RLS mot `profiles`/`companies`; admin kun for signert lagrings-URL.  
8. `app/api/kitchen/today/route.ts` — redirect til `/api/kitchen/day` uten egen auth (avhengig av mål-route).  
9. `app/api/v1/public/orders/route.ts` — `getTenantContext(req)` (API-nøkkel) + `getOrdersByTenant`.  
10. `app/api/orders/[orderId]/toggle/route.ts` — `getUser`, rolle-gate, `.eq("company_id", companyId)` på ordre.  

**P0:** Ingen observerte P0 i disse stikkprøvene. (Kritiske funn rapporteres til eier før innføring i dokumentasjon.)

## 10 attack vectors — relevans for Lunchportalen

| # | Vektor | Relevant | Beskyttelse-status (overflate) |
|---|--------|----------|----------------------------------|
| 1 | Direkte cross-`company_id` / `location_id` | Ja | Server-scope (`profiles` / memberships), RLS, `routeGuard` på mange ruter; stikkprøve `orders/[orderId]/toggle` binder ordre til profilens `company_id`. |
| 2 | Rolle-eskalering (employee → admin) | Ja | Rolle-sjekker i handlers; `tests/security/roleIsolationEndpoints.test.ts` m.fl. |
| 3 | RLS-bypass via browser-klient (anon) | Ja (teoretisk) | Anon + RLS; avhenger av policy-dekning på alle tabeller. |
| 4 | Auth-bypass på beskyttede ruter | Ja | Offentlige/cron/webhook må være eksplistitte; middleware beskytter ikke de fleste `/api/*` for roller. |
| 5 | JWT-manipulering | Standard | Signaturverifisering hos leverandør; lav app-spesifikk avvik utover standard. |
| 6 | Mass enumeration / ID-lekkasje | Ja | Krever konsistent 404/403 og ens responsformer (runtime). |
| 7 | Stjålet session / cookie | Ja (generisk) | Standard session-risiko; ikke app-unikt. |
| 8 | Sub-resource uten egen RLS | Ja | DB-gjennomgang (foreldre-tabell vs. direkte SELECT). |
| 9 | Storage uten company-scope | Mulig | Buckets/policy review (ikke fullført i Rev A). |
| 10 | Realtime cross-company | Mulig | Avhengig av filter + RLS på publications (ikke fullført i Rev A). |

## 10 konkrete pen-test cases (foreslått, **ikke kjørt** i denne økten)

| # | Beskrivelse | URL (eksempel) | Payload / headers | Forventet | Prod-risiko |
|---|-------------|-----------------|-------------------|-----------|-------------|
| 1 | Cross-company admin summary | `GET /api/admin/company/{companyId}/summary` | Session firma A, `companyId` for B | 403/404 | Middels (lesing) |
| 2 | Employee mot `/api/superadmin/system/health` | `GET /api/superadmin/system/health` | Employee-cookie | 403 | Lav |
| 3 | Ordre toggle annet firma | `POST /api/orders/{orderId}/toggle` | Body `{"wantsLunch":true}`, session A, `orderId` fra B | 403/404 | Middels |
| 4 | Bulk-set / window (allerede i api-gate) | `POST /api/order/bulk-set`, `POST /api/order/window` | Forsøk å sende annet tenant (skal ikke leses fra client) | Avvist | Høy på staging først |
| 5 | Kitchen-day annet selskap | `GET /api/kitchen/day?date=…` + ev. query | Kitchen-rollen, annen tenant | Tom/403 | Middels |
| 6 | Driver stops annet selskap | `GET /api/driver/stops` | Driver A | Ingen data fra B | Middels |
| 7 | Enumeration ordre-ID | `GET /api/orders/{uuid}` | Tilfeldig UUID | 404 konsistent | Lav–middels |
| 8 | Cron uten hemmelighet | `GET /api/cron/week-visibility` | Uten gyldig cron-header | 403 | Høy — kun staging / kontrollert |
| 9 | Public API uten nøkkel | `GET /api/v1/public/orders` | Ingen `Authorization` / header per `getTenantContext` | 401 | Lav |
| 10 | Experiments track ugyldig variant | `POST /api/experiments/track` | Gyldig JSON, ukjent variant | 404 | Lav (abuse/load) |

---

*Rev A — kun dokumentasjon og statisk kode-innhenting; ingen runtime pen-test, ingen endring i RLS, ingen nye automatiserte tester.*
