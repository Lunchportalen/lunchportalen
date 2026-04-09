# Bred live — endelig beslutning

**Dato:** 2026-03-29

---

## 1. Endelig beslutning

**GO WITH CONDITIONS** — Kjerneplattformen og CI-gatene er sterke nok for kontrollert bred utrulling, men drift, secrets, økonomi-QA og forventningsstyring (særlig growth/worker) må være eksplisitt akseptert og begrenset før trafikk skaleres.

---

## 2. Hva som er godt nok til bred live

- **Enterprise release-kjeden** (`build:enterprise`) med plattform-guards og SEO-sjekker.
- **Omfattende Vitest-dekning** (1191+ tester) på auth, tenant, kitchen, driver, CMS, cron, helse-API.
- **Kjerne lunch-flyt** (uke, ordre/vindu, kjøkken, driver, company admin) implementert og testet i stor grad.
- **Fail-closed mønstre** på flere API-er (401/403, cron `CRON_SECRET`, helse uten «fake OK»).
- **Baseline-forbedringer** dokumentert i `LIVE_READY_BASELINE_DELTA.md` (bl.a. dev-order i prod, outbox SLI-tekst, fredag 15:00).

---

## 3. Hva som fortsatt er svakt

- **Middleware** uten full rolle-gating — risiko må mitigeres med layout/API-sannhet (se åpne risikoer).
- **`strict: false` i TypeScript** — redusert statisk sikkerhet.
- **Stor API-flate** — vedlikehold og review-byrde.
- **To spor uke (B1)** — arkitektonisk kompleksitet; krever eierskap og ev. konsolidering senere.
- **Billing hybrid** — krever økonomi-QA utover ren kodekorrekthet.
- **Worker**: deler er **STUB**; ikke forretningskritisk avhengighet uten videre.
- **Ingen dokumentert bred lasttest** — skala er antatt, ikke bevist.
- **Growth ekstern effekt** (SoMe publish): ofte **DRY_RUN** / nøkkelavhengig.

---

## 4. Hva som er akseptabelt for bred live

- Kjernefunksjoner med **server-side sannhet** og **testet isolasjon** kan tas i bruk for flere tenants når secrets og DB er riktig konfigurert.
- **Backoffice/CMS** med rolle og eksisterende API-kontrakter — akseptabelt med opplært redaksjon og begrenset superadmin-tilgang.
- **ESG lesing** — akseptabelt når tom data og estimater kommuniseres ærlig (ingen greenwashing).
- **SEO-verktøy** som **review-first** — akseptabelt som beslutningsstøtte, ikke som stille auto-produksjon.

---

## 5. Hva som ikke er akseptabelt

- Å **love** full ekstern SoMe-reach eller automatisk publisering uten bekreftet kanal + nøkler.
- Å **markedsføre** worker e-post/AI-jobs som produksjonsklare når de er stub eller interne.
- Å **ignorere** manglende `SYSTEM_MOTOR_SECRET` / `CRON_SECRET` i produksjon — helse og cron må være reelle.
- **Bred live uten** definert support-eier og rollback-forståelse (se runbook).

---

## 6. Vilkår for GO WITH CONDITIONS

1. Alle **påkrevde secrets** satt og verifisert i målmiljø (inkl. `SYSTEM_MOTOR_SECRET`, cron-secrets der aktuelt).
2. **Vercel cron** matcher `vercel.json` / `lib/pilot/vercelScheduledCrons.ts`; ingen «skjulte» jobber antatt live uten review.
3. **Superadmin**-tilgang begrenset til navngitte personer.
4. **Billing/økonomi**: eksplisitt QA på fakturaflyt for pilotkunder før full bred skala.
5. **Growth**: salg/support bruker samme narrativ som i `LIVE_READY_GROWTH_POSTURE.md` (ingen skjult dry-run).
6. **CI grønn** på `typecheck`, `build:enterprise`, `test:run` før deploy til bred live.

---

## 7. Hva som må være deaktivert eller begrenset ved bred live

| Element | Posture |
|---------|---------|
| Ekstern **social publish** uten nøkler | **DRY_RUN** / kanal av — forventningsstyring i UI |
| **Worker** `send_email`, `ai_generate`, `experiment_run` | **STUB** — ikke drift kritisk |
| Eksperimentelle **cron**-navn (interne) | **INTERNAL_ONLY** — ikke kundefunksjon |
| **Dev**-endepunkter | Allerede blokkert i Vercel prod der implementert |

---

## 8. Hva som må vente til senere

- Full **TypeScript strict**-migrering.
- **Middleware**-basert rolle-gating (hvis ønskelig) — stor endring; egen beslutning.
- **Konsolidering B1** (uke-spor) — arkitektur.
- **Bevist last- og kapasitetstest** — egen aktivitet.
- **Observability plattform** utover dagens minimum — roadmap (K3), ikke denne leveransen.

---

**Se også:** `BROAD_LIVE_TRAFFIC_LIGHT_MATRIX.md`, `BROAD_LIVE_OPEN_RISKS.md`, `LIVE_READY_NEXT_STEPS.md`.
