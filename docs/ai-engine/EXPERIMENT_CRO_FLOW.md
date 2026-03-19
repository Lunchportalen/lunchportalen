# CRO / Experiment flow (Phase 3)

**Én sannhetskilde for hvordan A/B-eksperimenter opprettes, måles og leses.**

## Opprettelse av experimentId

- **Kilde:** Redaktør bruker «Structured intent (A/B)» i AI-verktøy (ContentWorkspace).
- **Verkty:** `lib/ai/tools/abGenerateVariants.ts` — `generateAbVariants()` returnerer per variant et objekt med `experiment.id` (f.eks. `exp_<uuid>`).
- **Lagring:** experimentId er felles for alle varianter i samme eksperiment; brukes ved innlasting av statistikk.

## Innsending av events (ingest)

- **Endpoint:** `POST /api/backoffice/experiments/event`
- **Auth:** Header `x-lp-experiment-secret` må matche `EXPERIMENT_INGEST_SECRET` (miljøvariabel). Uten gyldig secret → 401.
- **Body:** `{ experimentId: string, variant: string, event: "view" | "click" | "conversion" }`
- **Validering:** experimentId og variant valideres (lengde, tegn); ugyldig → 400. Rate limit per IP.
- **Effekt:** Oppdaterer `experiment_results` (views/clicks/conversions per variant) og logger til `ai_activity_log`.

## Lesing av statistikk

- **Endpoint:** `GET /api/backoffice/experiments/stats?experimentId=<id>`
- **Auth:** Innlogget bruker med rolle `superadmin` (routeGuard).
- **Respons:** `{ ok: true, data: { views, clicks, conversions, variants, byVariant[] } }`

## Backoffice UI

- **AI Control** (`/backoffice/ai`): Felt «Experiment ID» + knapp for å laste statistikk. Viser views/clicks/conversions og per-variant tabell.

## Fail-closed

- Ingest krever secret; stats krever superadmin.
- experimentId tillater kun `[a-zA-Z0-9_-]`, max 80 tegn.
- Variant trunkeres til 40 tegn.
