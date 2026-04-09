# Superadmin — systemoversikt (2C4 runtime)

## Eksisterende kilder (autoritative)

| Behov | Rute / API | Merknad |
|-------|------------|---------|
| Systemhelse, env, flytdiagnostikk | `/superadmin/system` | **Frosset** semantikk for OK/WARN/FAIL — ikke endret |
| Driftsoversikt (KPI, tid) | `/superadmin/overview` | Bruker bl.a. dashboard-feed; separat fra system-siden |
| Dashboard-tall (firma/ordre) | `GET /api/superadmin/dashboard` | Samme logikk som `loadSuperadminHomeSignals` for firma/ordre |
| Kontrolltårn / AI | `/superadmin/control-tower` | Operativt konsept — ikke «ny driftmotor» i 2C4 |

## Hva signalene på `/superadmin` viser

- **Firma (venter)**, **Avtaler (venter godkjenning)**, **Ordre i dag / uke** — direkte fra Supabase-admin lesning (samme mønster som dashboard).  
- Hvis lesing feiler: **fail-open** med informativ banner — ingen falske tall.

## Ikke vist

- Innhold som krever nye aggregeringer eller tredjeparts health — ikke lagt til.
