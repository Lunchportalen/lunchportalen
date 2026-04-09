# CP6 — Publish orchestration (beslutning)

## Employee runtime leser (uendret)

- **`GET /api/week`** + avtale + **Sanity menu/menuContent** — som i `app/api/week/route.ts`.

## Publisert sannhet

- **Operativ meny:** Sanity-dokumenter som API leser.
- **Innholdssider:** Postgres publish (annen kjede).
- **weekPlan:** Editorial — egen boundary.

## Er Studio publish-kilde for operativ meny?

**Ja** — mutasjon av menydokumenter skjer i **Sanity Studio**; runtime leser publisert resultat.

## Hvordan CMS styrer uten ny sannhet

- **In-CMS orkestrering** (`CmsWeekMenuPublishOrchestrator`): kjede → **readiness** (telling fra samme data som tabellen) → **eksplisitt handoff-kort** til Studio (stor CTA).
- **Ikke iframe** av Studio (ofte blokkert / dårlig UX) — **trygg handoff** er mer pålitelig enn «fake embedded».
- **Ingen** duplikat publish-motor i Lunchportalen.

## Publish skjer via

- **Operativ meny:** Eksisterende **Sanity publish** (bruker åpner Studio fra handoff).
- **Innhold:** Eksisterende **content workspace**.
- **Proxy/trigger:** Ikke introdusert som egen motor — kun lenker og forklaring.

## Preview vs publish

- Tabell + readiness på `/backoffice/week-menu` bruker **samme** `getMenusByMealTypes` som viser dokumenttilstedeværelse — konsistent med hva runtime kan hente.
- Content preview er **annen** kjede — dokumentert i eksisterende paneler.

## Read-only / review / publish-control

- **CMS:** orkestrerer, viser readiness, sender til Studio for **publish** av meny.
- **Runtime:** uendret eierskap for ordre/avtale.

## CP6 implementert (kode)

- `CmsWeekMenuPublishOrchestrator`, `CmsMenuPublishReadinessSummary`, `CmsSanityPublishHandoffCard`.
- `moduleLivePosture.ts` + `CmsModuleLivePostureTable` på domener.
- `whyMatters` på domain surfaces + kort på kunder-siden.

## Må vente

- Én felles automatisk publish-knapp som skriver både Sanity og Postgres uten migrering.
- Innbygget Studio uten å åpne ny fane (krever produkt-/sikkerhetsbeslutning).
