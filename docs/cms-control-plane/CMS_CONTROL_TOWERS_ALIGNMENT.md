# Arbeidsstrøm 4 — Control towers under CMS

**Dato:** 2026-03-29

## Prinsipp

Control towers (**company admin**, **kitchen**, **driver**, **superadmin**) forblir ** operative eller administrative** med **server-side sannhet**. CMS/backoffice er **redaksjonelt og styringsmessig** kontrollplan — de møtes i **navigasjon, innsyn og narrativ**, ikke i én felles database.

## Tower — kilde — CMS-rolle

| Tower | Primær kilde | Brukerflate | CMS-kobling (ønsket/aktuell) |
|-------|----------------|-------------|------------------------------|
| **Company admin** | `profiles.company_id` scope, admin APIs | `app/admin/**` | Lenker til backoffice for innhold/markedsføring; **read-only** avtale/meny-status |
| **Kitchen** | Menyer/ordreaggregater | `app/kitchen/**` | Meny **fra samme Sanity/operativ kjede** som `GET /api/week` konsumerer — dokumentert i `CMS_WEEK_RUNTIME_SYNC.md` |
| **Driver** | Stop-lister, leveranser | `app/driver/**` | Ingen CMS-redigering; eventuelt **content** for interne instruksjoner (fremtid) |
| **Superadmin** | System/agreements/companies | `app/superadmin/**` | **Hub** for alt: companies, growth, pekere til backoffice, `weekplan/publish` policy |

## Visuell align (uten å bryte AGENTS H8)

- **Admin/superadmin/kitchen/driver** bruker **canonical header** der påkrevd — **ikke** bytt til backoffice chrome for disse rollene uten eget produktvedtak.
- **Backoffice** bruker **BackofficeShell** — **forskjell er OK** så lenge **merkevare-DNA** (farger, ro, hot pink-disiplin) er lik phase2a.

## Operativ sannhet (uendret)

- Kitchen **read-only** sannhet — jf. AGENTS S3.
- Driver **deterministisk** gruppering — jf. S4.

## CP1

- Bro-lenker fra `/backoffice/control` til sentrale superadmin-ruter (firma, system, oversikt, faktura, social engine).
- Statusstrip forklarer at operative tårn har **egen** runtime-sannhet.

## Konklusjon

«Alignment» = **klar systemfortelling + delte datakjeder (meny)** + superadmin som bro — **ikke** én React-root for alle roller.
