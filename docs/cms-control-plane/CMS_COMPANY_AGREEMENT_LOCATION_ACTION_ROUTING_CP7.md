# CMS — Company / agreement / location action routing (CP7)

## Prinsipp

- **Sannhet** i Supabase; CMS viser **read**, **review** og **routing** til eksisterende runtime-sider.

## CP7 endringer

- Ingen store refaktorer av `controlPlaneDomainActionSurfaces`.
- Dokumentasjon utvider matrise i `CP7_ACTION_ROUTING_EXPANSION.md`.

## Anbefalt mønster

- **Firma/kunde:** lenke til `/admin/*` eller superadmin der mutasjon er definert.
- **Avtale:** aldri «fake save» fra CMS; forklar hvor avtale endres.
- **Lokasjon:** samme — routing til etablert admin-flate.

## Risiko å unngå

- Dobbelt submit til avtale-API fra CMS og admin samtidig uten koordinering.
