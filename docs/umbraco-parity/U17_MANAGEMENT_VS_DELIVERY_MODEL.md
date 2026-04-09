# U17 — Management vs delivery model

## Umbraco-referanse

- **Management API** — styring, redigering, struktur.
- **Content Delivery API** — optimalisert **levering** av publisert innhold til kanaler.

## Lunchportalen

| Lag | Ansvar | Eksempler |
|-----|--------|-----------|
| **Management / control plane** | Backoffice, Postgres content, Sanity-menykjede (publisering), review | `/backoffice/*`, `app/api/backoffice/**` |
| **Delivery / runtime** | Lese-API for uke, ordre, faktura, portal | `/api/week`, `/api/orders`, `lib/cms/public/**`, portal-sider |

## Surfaces (styring)

- `CONTROL_PLANE_DOMAIN_ACTION_SURFACES` — beskriver **lesing**, **review**, **runtime-ruting** per domene.

## Skal aldri flyttes ut av runtime (uten eget arkitekturvedtak)

- Ordrehendelser, fakturagrunnlag, uke-API som bestillingssannhet, auth/session.

## UI-tydeliggjøring (U17)

- `BackofficeExtensionContextStrip` viser **modulposture** + **mutationPosture** + **sourceOfTruth** fra eksisterende registers — **lesing fra sannhet**, ikke ny sannhet.
