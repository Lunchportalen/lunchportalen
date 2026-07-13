# CONTRADICTIONS AND GAPS — Lunchportalen Truth Audit

Dato: 2026-07-13 · Regel: kode/runtime vinner over docs og gamle rapporter.

## Kontradiksjonsregister

| # | Påstand | Kilde A | Kilde B | Faktisk kode-/runtime-sannhet | Oppløsning |
|---|---|---|---|---|---|
| 1 | «21 land / 21 språk komplett» | Commit `ada0183b` («global launch production candidate»), GO-docs | `lib/markets/supportedMarkets.ts` (lokal) | Production har 9 språkkataloger og en markets-tabell der 21 rader = 21 locales (AU/SG/LU aktive, PL/RO/CZ/PT/GR mangler, BE/CH dobbelttalt). Riktig 21-lands-modell finnes kun i 2 UPUSHEDE lokale commits (`4e17bb70`, `a9c3e0fd`) | 21-land = **CODE_COMPLETE_NOT_LIVE**. Production-modellen er feil per kanonisk krav |
| 2 | «Global Billing Engine-migrasjoner ikke på prod» | `docs/TECH-DEBT.md:52-60` + `scripts/go-operator/constants.mjs` (pending-liste) | Supabase prod `supabase_migrations.schema_migrations` | Alle migrasjoner 20260729–20260814 ER kjørt i prod; commission-tabellene finnes med commission_rules seedet | Docs er utdaterte. E2-blokkeringen er env (Stripe) + manglende cron, ikke manglende skjema |
| 3 | «Stripe configured (NO)» | prod `markets.stripe_status='configured'` for NO | Vercel prod env | Ingen STRIPE_*-variabler finnes i production | DB-feltet er aspirasjonelt/feil. Stripe = LIVE CONFIGURATION MISSING |
| 4 | «Billing live / launch candidate klar» | Release-commit-melding, GO-evidence-docs | Prod-data | 0 rader i hele commission-kjeden; agreement_invoices står i DRAFT; Tripletex-outbox PENDING/FAILED_PERMANENT | Ingen pengeflyt er LIVE_VERIFIED i dag |
| 5 | Ordre-statuskjede «confirmed→ready→in_production→packed→out_for_delivery→delivered» | Kanonisk kravtekst | DB-enum + kode | Faktisk: ACTIVE/LOCKED→PREPARED→DISPATCHED→DELIVERED + parallell kitchen_batches QUEUED→PACKED→DELIVERED | Kravtekstens navnesett finnes ikke; semantikken dekkes delvis |
| 6 | «Cutoff er hardkodet Oslo 08:00» vs «market timezone cutoff finnes» | Meny-audit (kode-lesning av /api/week) | Migrasjon `20260814120000` (kjørt i prod) | DB-cutoff er market-timezone-aware (`lp_company_cutoff_context`); enkelte lesestier i /api/week bruker fortsatt hardkodet Oslo | Begge sanne på hver sitt lag; UI-laget henger etter DB |
| 7 | «Provider onboarding self-service finnes» | Navnet `PublicProviderRegistrationForm` | Faktisk kode | Skjemaet registrerer LUNSJFIRMA (kunder), ikke cateringfirma. Provider-orgs opprettes kun via operator-CLI/`lp_provider_create` | Self-service cateringregistrering = MISSING; navngiving er misvisende |
| 8 | «Phase D SOURCE_ONLY» vs «21 locale end-to-end complete» | `phaseDLocales.ts` (applyEnabled=false) | Commit-melding 4e17bb70 | SOURCE_ONLY gjelder fortsatt; SOT-master-flagg default OFF; ingen SOT-env i Vercel prod | «End-to-end» gjelder kataloger/tester, ikke aktivert runtime |
| 9 | «menu_visibility_days er employee-lesevei» | Antakelse i tidligere docs | Kode | /api/week leser Sanity primært, MSDI-fallback; menu_visibility_days er CMS-speil | Speil, ikke sannhetskilde |
| 10 | «Kansellering korrigerer fakturagrunnlag» | Kravtekst | Kode | `lp_order_set` CANCEL kaller IKKE negativ-provisjons-RPC; ingen auto-kreditering E1 | MISSING (auto); manuelle RPC-er finnes |
| 11 | «Superadmin kan håndtere provider-registreringer» | Antakelse | Kode | Kun leads-tabell (ingen superadmin-side); company-registreringer har inbox | PARTIAL |
| 12 | «Tripletex operativt» | tpt_b*-migrasjoner + tester grønne | Prod outbox + credentials | 0 credentials, kø PENDING siden juni/juli, 1 FAILED_PERMANENT | E1 BROKEN i praksis inntil en provider onboardes i Tripletex |
| 13 | «24 locales aktivt» | DB-matrise i commit-melding a9c3e0fd («DB matrix 24 active locale rows») | Prod-DB | Prod markets har 21 rader gammel modell; 24-locale-matrisen gjelder LOKAL migrasjon som ikke er kjørt | Lokal sannhet ≠ prod |
| 14 | «Golden path beskyttet i CI» | AGENTS.md (test:golden-path påkrevd) | CI-workflows | Full golden-path-suite kjører kun i go-operator-workflow; PR-CI kjører guard-script + test:run | PARTIAL — guard ja, full suite nei |
| 15 | Post-login-resolver som eneste landingslogikk | AGENTS.md (LOCKED) | Invite-klienter | Accept-invite/registrer-klienter går direkte til `/week` uten post-login | Avvik fra locked lov (fungerer, men bryter «one canonical resolver») |
| 16 | «Alle LP_MENU_PROFILE_* er OFF i production» | docs/launch/* (P0-3, readiness-audit 2026-06-30/07-01) | Vercel prod-env (read-only) | `LP_MENU_PROFILE_RESOLVER`, `LP_LOCALIZED_FIXED_MENU_GENERATOR`, `LP_MENU_PROFILE_RUNTIME_COMPATIBILITY_HOOK` FINNES i prod (SUPERSMART Phase 4-cutover 2026-07-04) | Launch-docs er frosne snapshots; autoritativ: go-truth-state-reconciliation-2026-07-10 |
| 17 | «21 locale end-to-end complete» (språklig) | Commit 4e17bb70/a9c3e0fd + verify-21-gate PASS | Fullesning av alle 15 kataloger | Systematiske NB/EN-lekkasjer i 10 av 14 ikke-nb-kataloger; svensk i da.json; gate validerer kun nøkler/interpolasjon, ikke språkinnhold | Nøkkel-komplett ≠ språklig komplett; ny innholds-QA-gate kreves |
| 18 | Frossen superadmin-paginering 25 | AGENTS.md A1.1 (LOCKED) | superadmin-client.tsx PAGE_LIMIT=50; FirmsTable PAGE_SIZES [25,50,100]; firms pageSize 50 | 50 i kode | BROKEN lovbrudd |
| 19 | S11 logo-bilde i header | AGENTS.md (LOCKED) | AdminSidebar tekstmerke «LP» | Tekstlogo i produksjonskode | BROKEN lovbrudd |
| 20 | Hot pink som eneste aksent | AGENTS.md F6 | app/globals.css `--lp-hotpink: #f5c518` (gull) | Token peker på gull | Udokumentert rebrand eller drift |
| 21 | API-kontrakt `{ok,rid,data}` overalt | AGENTS.md C3 (LOCKED) | admin/deliveries dobbel-ok-envelope; company-paneler `{ok,rows}`/`{ok,agreement}`; pipelineNotConfigured uten rid | Flere kontraktsbrudd i superadmin-/admin-flater | PARTIAL brudd |
| 22 | CI-guards håndhever | package.json/AGENTS | scripts/lint-ci.mjs og scripts/check-admin-no-hardcoded-text.mjs | Begge exiter alltid 0 (inerte) | Falsk trygghet i to guards; next lint kjøres reelt i CI |
| 23 | «repo-deep-dive: employee-allowlist = /orders + /min-side» | docs/audit/repo-deep-dive-report.md | lib/auth/role.ts | Employee-allowlist er kun `/week` | Doc superseded |
| 24 | «ContentWorkspace 6401 linjer» | REBASELINE_AUDIT_REPORT.md | IMPLEMENTATION_LOG FASE 33 | 1 986 linjer etter refaktor | Doc superseded |
| 25 | «invoice.reverse lukket (K2)» | repo-state-2026-05-23 | runtime-route | 501 CREDIT_NOTE_NOT_IMPLEMENTED for låste perioder | «Lukket» = wiring, ikke funksjon |
| 26 | Helse-semantikk WARN/FAIL (frossen) | AGENTS.md A1.3 | lib/system/healthStatus.ts (normal/degraded) + aggregator (ok/degraded/critical) | To parallelle semantikker i lib | Tekstlig avvik; superadmin-side bruker sin egen |
| 27 | Superadmin-gates på profiles.role | AGENTS.md D4 | lib/superadmin/auth.ts, invoices/export, admin/dashboard leser user_metadata.role | Dual rollesannhet | Konsolidering kreves |
| 28 | Batch-modell én sannhet | batch_order_status_sync-migrasjon (kitchen_batches) | app/api/kitchen/batch/route.ts skriver `delivery_batches` | Splittet batch-sannhet på tvers av endepunkter; delivered-gren uoppnåelig i ett endepunkt | Konsolidering kreves |
| 29 | «Cutoff 08:05» | lib/orders/immutability.ts-kommentar | lp_order_set + mapOrderWriteError (08:00) | 08:00 er DB-sannhet | Doc/kommentar-avvik |
| 30 | phaseCLocales.ts som GO-grunnlag | lib/provider-onboarding/phaseCLocales.ts (7 pending) | Phase C-runbook: COMPLETE (9 providers) | Kodekatalog stale; runbook advarer selv | Ikke bruk phaseCLocales alene |

## Gap-register (utover matrisene)

### Kommersielt blokkerende
1. **Ingen Stripe-env i prod** → hele plattformprovisjons-innkrevingen kan ikke kjøre.
2. **Ingen cron for commission period close / invoice create** → selv med Stripe ville E2 kreve manuell kjøring.
3. **Tripletex-credentials = 0** → E1 stopper i DRAFT/PENDING; kreditnota-flyt mangler helt.
4. **Provider-UI for agreement-fakturaer mangler** (faktura-siden viser kun SaaS-abonnement).
5. **Ingen selvbetjent provider-onboarding** (lead → org-konvertering mangler; operator-CLI er eneste vei).

### Funksjonelle
6. Ukesbulk-bestilling finnes ikke (kun per-dag); deprecated 410-endepunkt.
7. Superadmin-godkjenning materialiserer ikke registrerings-planen inn i avtalen (tier/dager).
8. FirmaOnboardingWizard validerer klient-side men lagrer ingenting.
9. Koststed (cost center) finnes ikke i skjema/API/UI.
10. Company-admin kan ikke redigere fakturaprofil, lokasjons-adresser eller ansattantall.
11. Duale registrerings-/godkjenningsløp (A/B) kan gi dupliserte avtaler.
12. Duale accept-invite-APIer med ulik location-semantikk; TTL-avvik 48t vs 7d; to e-poststacker.
13. Kansellerte ordre vises fortsatt i provider-ordrelisten (ikke auto-ekskludert).
14. provider_price_rules / provider_package_entitlements / cutoff_time inert uten UI/resolver.

### Språk/global
15. Superadmin-oversettelse av utenlandsk innhold: MISSING (rå tekst, ingen språkindikator, translate-stub).
16. Native/legal review: kun nb; alle andre språk PENDING.
17. fr-CA, nl, pl, ro, cs, pt, el kun lokalt; prod mangler dem.
18. Flerspråklig fakturagenerering ikke wired (invoiceLocale finnes bare som datamodell).
19. Sanity menuDay har ingen locale-felter i prod — alt menyinnhold er enspråklig.

### Sikkerhet/tenant (fra fullesning — krever verifisering/fiks før global skala)
20. `canAccessCompany`/location-guard returnerer **alltid true** for kitchen- og driver-roller (`lib/auth/guards.ts:7-17`); kompenserende scope-gates finnes i kitchen-/driver-API-ene (SCOPE_NOT_ASSIGNED), men guard-laget er hull.
21. `/api/kitchen/companies` tillater kitchen-rolle å lese ordre på dato **uten company/location-filter** fra profil (`route.ts:83-106`) — kryss-tenant-risiko.
22. Baseline har `GRANT ALL … TO anon` på ordre-/selskapstabeller og EXECUTE til anon på `lp_order_advance_status`; RLS+assert er backstop, men grant-flaten bør strammes.
23. `POST /api/ai/track` uten sesjonskrav (telemetri-forurensning); `api/address/*` åpen proxy mot Kartverket; `onboarding/terms-pdf` uautentisert PDF-generator.
24. `support/report` logger `tenant_violation_attempt` men blokkerer ikke; `superadmin/profiles/link-company` verifiserer ikke at location tilhører company; `leveringsgrunnlag` kaller `fetchAgreementPageDataForAdmin(null)`.
25. Passordpolicy inkonsistent: admin-login godtar <6 tegn, invite-fullføring krever 10, reset 8.
26. Prosesslokal infrastruktur i produksjonskritiske paths: rate-limit, API-nøkler (Map), approval-kø, alert-cooldown — ikke multi-instans-trygt.

### Test/verifikasjon
27. Ingen browser-E2E for ordre-plassering/kansellering (0 e2e-referanser til orders/set, lp_order_set, /leverandor/ordrer); CI-E2E kjører 6 spec-er (auth/shell/mobile); CMS-proof-kjeden (u62–u98c) er lokal-only.
28. RLS-full-suite (7 filer) og ~38 integrasjonsfiler er opt-in (RUN_SUPABASE_INTEGRATION_TESTS) og kjører ikke i PR-CI.
29. Muterende staging-verifisering av E1/E2 og invitasjonsflyt: UNVERIFIED — REQUIRES CONTROLLED STAGING EXECUTION.
30. `docs/evidence/setup-*.log`/`test0-*.log` er feilprotokoller (Windows EPERM, NOT EXECUTED) — ikke PASS-bevis; dagens gates ble re-kjørt i denne auditen med PASS.
