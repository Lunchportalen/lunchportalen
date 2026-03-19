# Test coverage — sannhet og prioriteringer

**Fasit for hva som testes, hva som ble lagt til i Phase 9, og hva som er bevisst utenfor scope.**

---

## 1. Hva som var testet før Phase 9

### Auth og rolle
- **tenant-isolation-*.test.ts:** company_admin scope låst til egen company_id; superadmin kan filtrere; employee får ikke admin/kitchen.
- **security/roleIsolationEndpoints.test.ts:** admin/orders 403 for employee; kitchen/batch 403 for company_admin; kitchen/batch/set 200 for kitchen.
- **security/kitchenDriverScopeGuard.test.ts / kitchenDriverScopeApi.test.ts:** kitchen/driver må ha companyId/locationId (SCOPE_NOT_ASSIGNED).
- **profile-company-status.test.ts:** pending vs active company.
- **registration-flow-smoke.test.ts:** sanitization, authority, employee count, valid state.
- **rls/companyAdminStatusGate.test.ts:** ACTIVE tillater, PAUSED/CLOSED blokkerer (403).

### Ordre og avtale
- **rls/ordersLifecycleGate.test.ts:** PAUSED/CLOSED → toggle 403.
- **rls/orderAgreementRulesGate.test.ts:** toggle 403 når dag ikke i delivery_days eller day_key ikke i rules.
- **rls/orderImmutability0805.test.ts:** blokk etter 08:05 for dagens dato.
- **rls/ordersLifecycleGate, orderAgreementRulesGate:** bruker `/api/orders/toggle` eller `[orderId]/toggle` med mocks.

### CMS og innhold
- **cms/publicPreviewParity.test.ts:** getContentBySlug (null ved mangler, prod-variant kun for public).
- **cms/renderBlock.test.ts:** ukjent type (prod null, staging warning), manglende data, image-block.
- **cms/publishFlow.test.ts:** copyVariantBodyToProd og at public viser publisert innhold; redigering etter publish endrer ikke public før neste publish.
- **api/contentTree.test.ts:** GET tree bygger røtter og barn, POST move syklus-sjekk og gyldig flytt.
- **api/contentHome.test.ts:** home-insert inkluderer tree_root_key og tree_sort_order.

### Media
- **api/mediaItems.test.ts:** GET filtrerer rader uten url, POST oppretter med url, POST 400 uten url.
- **api/mediaItemsId.test.ts:** GET 200/404/400, PATCH alt/400/404.

### AI
- **api/editorAiMetrics.test.ts:** 401, 400 ugyldig body/mangler type, 200 med gyldig body.
- **api/backofficeAiSuggest.test.ts:** 401, 400 mangler tool, 500 ved insert/log-feil.
- **api/backofficeAiApply.test.ts:** 401, 500 ved log-feil, 200 ved suksess.

### Kjøkken / driver / utboks
- **kitchen-batch-*.test.ts, kitchen/cutoff.test.ts, kitchen-print.test.ts:** batch, cutoff, print med tenant/dato.
- **tenant-isolation-kitchen-batch-status.test.ts:** tenant/date-låser.
- **outbox-policy.test.ts:** FAILED_PERMANENT og at de ikke claimes.

### RLS og policy (statisk / migrasjon)
- **rls/kitchenDriverScopePolicy.test.ts, orderAgreementRulesGate, orderImmutability0805, companyAdminStatusGate:** policy-innhold eller at gate gir forventet 403.

### API-gate (statisk)
- **tenant-isolation-api-gate.test.ts:** ruter må bruke scope/auth og ikke ta tenant fra klient.

---

## 2. Hva som ble lagt til i Phase 9

- **tests/api/contentPages.test.ts**
  - GET `/api/backoffice/content/pages` returnerer 401 når ikke autentisert.
  - GET returnerer 200 med `items` (array) når autentisert.
  - POST returnerer 401 når ikke autentisert.
  - POST returnerer 409 SLUG_TAKEN ved unik-slug-feil (23505).

- **tests/api/releasesWorkflow.test.ts**
  - POST `/api/backoffice/releases/[id]/schedule`: 401 når ikke autentisert; 400 når release ikke er `draft`.
  - POST `/api/backoffice/releases/[id]/execute`: 401 når ikke autentisert; 400 når release ikke er `scheduled`.

**Formål:** Lukke hull på auth for backoffice content-liste/opprettelse og på workflow-låser for planlegging og kjøring av releases (draft → scheduled → execute).

### Database integrity (tests/db/database-integrity.test.ts)

Kjøres automatisk med `npm run test:db` (krever `NEXT_PUBLIC_SUPABASE_URL` og `SUPABASE_SERVICE_ROLE_KEY`; ellers skippes).

- **Foreign key:** Insert i `orders` / `agreements` med ikke-eksisterende `company_id` (og evt. `location_id`/`user_id`) gir Postgres 23503 (FK violation).
- **Constraints:** Insert i `outbox` med ugyldig status og i `company_deletions` med ugyldig `mode` gir 23514 (CHECK) eller 23502 (NOT NULL).
- **Tenant isolation:** Anon-klient (ingen session) får tomt resultat fra `orders` og `companies` (RLS).
- **Migration replay:** Kjernetabeller (`companies`, `company_locations`, `profiles`, `agreements`, `orders`, `outbox`, `idempotency`) finnes og er spørbare etter migrasjoner.

Deterministiske tester (forventede feilkoder / tomme resultater); ingen snapshot-tester.

---

## 3. Hva som er bevisst utenfor scope (per i dag)

- **Post-login / middleware:** Ingen tester som kjører `/api/auth/post-login` eller middleware for redirect/next-allowlist. Login-loop-sikring er dokumentert (AGENTS.md) og verifiseres manuelt/sanity.
- **Faktisk ordre-toggle suksess (200 + DB-oppdatering):** Vi tester 403 ved PAUSED/CLOSED, agreement-regler og 08:05. Full suksess-path med ekte DB eller full chain er ikke i vitest (kan være i sanity/e2e senere).
- **Public [slug]-side (Next-render):** getContentBySlug og renderBlock er testet med mocks; selve sidekomponenten og routing er ikke enhetstestet.
- **Release execute full chain:** Vi tester at execute returnerer 400 når status !== scheduled; vi tester ikke at executeRelease faktisk kopierer variant-body til prod (det dekkes av cms/publishFlow mot releasesRepo/copyVariantBodyToProd).
- **E2E / Playwright:** Ingen E2E-suite i denne beskrivelsen; sanity-live og manuelle tester brukes for kritiske brukerreiser.
- **Superadmin/system, onboarding full flow, driver-app:** Delvis dekket av tenant/isolation og RLS; ikke full flyt-test i vitest.

---

## 4. Hvilke feil som nå fanges

- **Content pages:** Uautentisert GET/POST gir 401; duplikat slug ved opprettelse gir 409 (SLUG_TAKEN). Regresjon på auth eller unik-slug-håndtering fanges.
- **Releases:** Uautentisert schedule/execute gir 401; planlegging av ikke-draft gir 400; kjøring av ikke-scheduled gir 400. Regresjon på workflow-låser (draft → scheduled → execute) fanges.
- **Eksisterende:** 401/403 på AI, media, content tree, order-toggle gates; CMS public/preview-paritet og renderBlock; tenant-isolasjon og RLS-gater; outbox og kjøkken-cutoff.

---

## 5. Kjøring

- Alle vitest-tester: `npm run test:run`
- Tenant-isolasjon: `npm run test:tenant`
- Database-integritet (FK, constraints, RLS, schema): `npm run test:db` (krever Supabase-env)
- Preflight (typecheck, test, lint, audit): `npm run preflight`
