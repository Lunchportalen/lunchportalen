# Arbeidsstrøm 3b — Week runtime sync

**Dato:** 2026-03-29

## Synkroniseringsmodell

```
[Sanity: menu / meal types] ──queries──► GET /api/week ──► Employee week UI
        ▲
        │ (redaksjonell, ikke runtime truth)
[Sanity: weekPlan] ──cron/publish API──► Markedsføring / låsing / Studio — separat spor
```

## Runtime-invarianter

| Invariant | Hvor |
|-----------|------|
| Autentisert bruker og `company_id` fra `profiles` | `GET /api/week` |
| Aktiv avtale (`plan_tier`, `delivery_days`, …) filtrerer hva som vises | Samme route + `normalizeDeliveryDaysStrict` |
| Neste uke låses til **torsdag 08:00** Oslo (aligned med order window kommentarer) | `week2UnlockFromWeek0Monday` i `app/api/week/route.ts` |
| Ukesynlighetsregler (fredag 15:00, overlapp, …) | `lib/week/availability.ts` brukt i order flows |

## Hva som **ikke** er «sync» fra CMS

- **CMS Postgres pages** påvirker **ikke** automatisk meny — med mindre eksplisitt integrasjon bygges (ikke påvist som én knapp «publish alt»).
- **weekPlan publish** muterer Sanity-dokument — **synk til employee** skjer **kun** hvis employee-kode leser det dokumentet (den gjør det **ikke** som primær kilde i `GET /api/week`).

## Risiko B1 (fra OPEN_PLATFORM_RISKS)

- **To spor for «uke»** — mitigeres ved: (1) tydelig produkttekst, (2) evt. deprecate/redusere `weekPlan` synlighet hvis overflødig, (3) aldri to ulike menyer for samme uke uten versjonering.

## Testpunkter (manuelle / eksisterende)

- Vitest smoke for `GET /api/week` der mulig (`tests/api/smoke-api-routes.test.ts` — delvis).
- Full pilot-QA: fredag 15:00, torsdag 08:00, samme-dag — jf. hardening docs.

## Read-only for CMS

- CMS skal **vise** «hvilken meny runtime bruker» via samme queries/helpers som server — **ikke** dupliser JSON manuelt i content.

## CP1

- `CP1_WEEK_MENU_RUNTIME_CHAIN.md` — én sides opsummering av kjeden.
- Statusstrip: **week** = LIVE, **weekplan_editorial** = LIMITED.
