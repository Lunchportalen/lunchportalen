# CP13 — Management vs delivery parity

## Skille (uendret sannhet)

| Lag | Eierskap | Eksempler |
|-----|----------|-----------|
| **Management / control plane** | CMS backoffice + Postgres content + Sanity-menykjede | Content publish, week-menu forklaring, SEO review |
| **Delivery / runtime** | Supabase, ordre, faktura, `/api/week`, `/admin`, `/kitchen` | Ordre, avtale-mutasjon, leveranse |

## CP13-forbedring

- **Extension registry** kobler `domainSurfaceId` → eksisterende **CONTROL_PLANE_DOMAIN_ACTION_SURFACES** for forklaring.
- **modulePostureId** → **MODULE_LIVE_POSTURE_REGISTRY** for ærlig modulstatus.

## Ikke gjort

- Ny Management API / Delivery API — **forbudt** i CP13.

## Replatforming-gap

- Umbraco **Content Delivery API** som egen CDN-lag — LP har egen public pipeline (`lib/cms/public/**`).
