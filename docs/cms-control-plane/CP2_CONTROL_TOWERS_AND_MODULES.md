# CP2 — Control towers and modules (narrativ)

**Dato:** 2026-03-29

## Principper

- **Operativ sannhet** forblir i runtime-flater (admin/kitchen/driver/superadmin).
- **CMS control plane** gir **språk, hierarki, status og broer** slik at tårnene ikke føles som «andre apper».

## Tårn — runtime — CMS-rolle (CP2)

| Tårn | Runtime | CP2 |
|------|---------|-----|
| **Superadmin** | Full system | Runtime-side + eksisterende lenker |
| **Company admin** | `app/admin/*` | Beskrevet + lenke til kontrolltårn der relevant |
| **Kitchen** | Meny/ordre-readonly | Forklaring på Uke & meny + runtime-side |
| **Driver** | Stopp/leveranse | Lenke + kort beskrivelse |
| **Growth** | SEO/Social/ESG | Modulstatus (strip) + faner |

## Moduler

- **Social / SEO / ESG**: fortsatt **LIMITED** / **DRY_RUN** der backend sier det — strip + dokumentasjon.
