# IMPLEMENTATION ORDER — Prioritert rekkefølge etter Truth Audit

Dato: 2026-07-13 · INGEN implementering er startet. Dette er kun plan. Venter på: «GO IMPLEMENT FROM FULL END-TO-END AUDIT».

Prinsipp: (1) release-sannhet før funksjonalitet, (2) pengeflyt E1 før E2, (3) én kanonisk vei per flyt, (4) språk/global til slutt (er allerede CODE_COMPLETE lokalt).

## Fase 1 — Release-sannhet og deploy-hygiene (blokkerer alt annet)
1. Avklar og fest produksjonsbranch: production kjører `ada0183b` som ikke er i main. Merge `fix/go-operator-open-pr`-linjen + de to upushede commitene (`4e17bb70`, `a9c3e0fd`) inn i main via PR, eller re-deploy fra main. Én sannhet: main == production.
2. Push lokal branch (den er kun lokal i dag — tap-risiko).
3. Kjør migrasjonene `20260815`–`20260817` kontrollert mot staging → prod (21-lands-korreksjon av markets, nl/pl/ro/cs/pt/el-locales). Verifiser med `verify-21-country-markets.mjs`.
4. Oppdater utdaterte sannhetsdocs (TECH-DEBT pending-liste, GO-evidence) så de matcher runtime.

## Fase 2 — E1: Provider → company-fakturering operativ (første pengeflyt)
5. Onboard minst én reell provider i Tripletex (credentials-wizard finnes) i staging → prod; verifiser outbox-kjeden DRAFT→SYNC→SENT→PAID.
6. Rydd Tripletex-outbox: håndter 15 PENDING + 1 FAILED_PERMANENT (retry/void med audit).
7. Bygg provider-UI for agreement-fakturaer (liste + status) — i dag usynlige for provider.
8. Kreditnota-/korreksjonsflyt for agreement_invoices (i dag kun manuell VOID).
9. Koble kansellering → fakturagrunnlag-korreksjon (policy: før fakturagenerering = utelates; etter = kreditlinje).

## Fase 3 — E2: Plattformprovisjon (5 %) aktiverbar
10. Konfigurer Stripe i Vercel prod (SECRET_KEY + 2 webhook-secrets); registrer webhooks. (Kode klar.)
11. Backfill/valider `organization_billing_profiles` for alle 9 providers (snapshot-forutsetning).
12. Cron for periodestenging + commission-invoice-opprettelse (i dag kun manuell RPC) + invoice_deliveries/e-post-wiring.
13. Wire negativ-ledger ved kansellering ETTER delivered-posting (auto-korreksjon).
14. Superadmin-UI for commission-perioder/-fakturaer/betalingsfeil (i dag kun CSV + Tripletex-kø).
15. Kontrollert staging-E2E: delivered-ordre → snapshot → ledger → close → invoice → dry-run-charge → webhook. (Det som i dag er UNVERIFIED.)

## Fase 4 — Provider-onboarding selvbetjent
16. Lead → provider-konvertering: superadmin-side for provider-leads med «Opprett provider»-handling som gjenbruker Phase C-fabrikken.
17. Invitasjonstoken-flyt for første provider-admin (erstatt direct-createUser + lokal passordlagring).
18. Provider-UI for prisregler, cutoff og pakke-entitlements + resolver-cutover (fjern inert-status), inkl. MVA per provider.

## Fase 5 — Company/employee-flyt konsolidering
19. Materialiser registrerings-plan (weekday_meal_tiers, leveringsvindu, binding/oppsigelse) inn i avtalen ved superadmin-godkjenning (eller fjern feltene fra skjemaet).
20. Konsolider til ÉN registrerings-/godkjenningsvei (A vs B) med samme avtalesemantikk.
21. Konsolider accept-invite: én side, ett API, én TTL, én e-poststack; route invite-login gjennom post-login-resolveren.
22. Company-admin: lokasjons-CRUD, fakturaprofil-redigering, ansattantall, koststed (eller eksplisitt beslutt at disse er utenfor scope).
23. FirmaOnboardingWizard: koble til server-persistens eller fjern.
24. Ukesbestilling: beslutt om bulk skal gjeninnføres (RPC-loop server-side) eller kravet frafalles.
25. Provider-ordreliste: default-ekskluder CANCELLED (med filter for å vise).

## Fase 6 — Global/i18n-aktivering
26. Aktiver 15-språks-kataloger i prod (etter Fase 1-migrasjoner) og verifiser locale-kjeden cookie→profil→company→market.
27. Superadmin-oversettelseslag: vis originalspråk-indikator + lagret/maskinoversettelse med audit for utenlandske registreringer og fritekst (i dag MISSING — kanonisk krav).
28. Flerspråklig faktura-/e-postgenerering per markets.invoice_language (i dag kun datamodell).
29. Native + legal review-prosess for 14 språk (kun nb er reviewed).
30. Flerspråklig menyinnhold: beslutt SMART-3 (server-lesemodell) og SOT-cutover-plan (flaggene er OFF; behold fail-closed til bevist).

## Fase 7 — Sikkerhet/tenant-herding (nye funn fra fullesning)
31. Fiks `canAccessCompany`/location-guard for kitchen/driver (fjern alltid-true) og legg company/location-filter i `/api/kitchen/companies`.
32. Stram GRANT-flaten i baseline (fjern anon-EXECUTE på `lp_order_advance_status` og anon-GRANTs på ordretabeller; RLS forblir).
33. Auth på `POST /api/ai/track`, rate-limit/auth på `api/address/*` og `onboarding/terms-pdf`; gjør `support/report`-tenant-avvik blokkerende.
34. Konsolider superadmin-gates til `profiles.role` (fjern `user_metadata.role`-lesing i superadmin/auth.ts, invoices/export, admin/dashboard).
35. Konsolider batch-modellen (delivery_batches vs kitchen_batches) og break-glass-skjemaene (actor_user_id vs actor_id).
36. Erstatt prosesslokal rate-limit/API-nøkler/approval-kø med varige lagre.
37. Ensrett passordpolicy (10 tegn overalt) og API-kontrakt-avvikene (dobbel-ok, {ok,rows}, manglende rid).

## Fase 8 — AGENTS-lov-compliance
38. Gjenopprett frossen paginering 25 i superadmin-flater; logo-bilde i admin-sidebar (S11); avklar/dokumentér hotpink→gull-token.
39. Rut invite-/register-login gjennom post-login-resolveren (E5).
40. Reaktiver inerte guards (lint-ci.mjs, check-admin-no-hardcoded-text.mjs) eller fjern dem ærlig.

## Fase 9 — Test-/verifikasjonsgjeld
41. Browser-E2E for ordre place/endre/cancel + invite-accept (staging); i dag finnes 0 e2e-referanser til ordre-skrivebanen.
42. Ta full RLS-suite + golden-path-suiten inn i påkrevd CI; vurder CMS-proof-lane.
43. Ny i18n-innholdsgate som flagger fremmedspråklige literals i ikke-nb-kataloger (verify-21 er strukturell); rydd de 10 kontaminerte katalogene.
44. Produksjons-smoke (read-only) for E1/E2-kjedene når de aktiveres.
45. Synk stale kodekataloger/kommentarer mot runtime-sannhet (phaseCLocales.ts, featureFlag.ts-header, immutability 08:05-kommentar).

## Ikke gjør (bekreftet utenfor scope)
- Umbraco/Azure-endringer (0 endringer i denne auditen; forblir frosset).
- Nye markeder utover de 21 kanoniske (AU/SG/LU forblir retirert).
- SOT-runtime-cutover uten egen GO.
