# Multi-tenant pen-test — P-backlog (Rev A)

Prioritering etter risiko og skala. Ingen oppgaver i denne listen er startet som del av Rev A-leveransen (kun dokumentasjon).

## P0 (umiddelbar utbedring)

- *(Ingen registrerte P0 fra statisk stikkprøve i Rev A. Kritiske funn meldes til eier før dokumenteres her.)*

## P1 (før første 1000 firma)

- Utvid `tests/tenant-isolation-api-gate.test.ts` fra 3 → 30–50 prioriterte ruter (ordre, admin, kitchen, driver, superadmin-delsett) — **egen sesjon / eier-OK**.
- Verifiser cron-auth-mønster i alle **61** `app/api/cron/**/route.ts` (konsistens med `requireCronAuth` eller tilsvarende).
- Verifiser `public/*`-ruter returnerer **ingen** sensitive tenant-data; vurder rate limits der det mangler.
- DB: gjennomgang av RLS på **child-tabeller** (f.eks. `order_items`, leveranse-relaterte tabeller) og eventuelle views.
- Storage policies-review (multi-tenant for relevante buckets / signerte URL-er).

## P2 (før 5000 firma)

- Realtime / Supabase subscriptions: eksplisitt cross-tenant negativ test (staging).
- JWT / token-manipulering: standard negatives (for ferdigstillelse av sikkerhetsarkivet).
- Mass enumeration: konsistens i **404 vs 403** og respons-kropper på tvers av endepunkter.

## P3 (årlig / før større release)

- Ekstern pen-test (OAuth, infra, forretningslogikk, session hardening).
- Vurdering av bug bounty-program.
- Dedikert staging med to test-firma + automatisk «tenant matrix» (runtime, CI) — **etter eksplisitt OK på testdata**.

---

*Rev A — vedlikeholdes av eier ved endring i auth-overflate eller etter eksterne funn.*
