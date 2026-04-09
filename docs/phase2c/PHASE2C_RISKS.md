# Phase 2C0 — Risk map

## Lav risiko (kan styrkes først)

| Område | Hvorfor |
|--------|---------|
| **Company admin** lesing | Scope allerede `company_id`; aggregater fra eksisterende API |
| **Kitchen** liste/rapport | Primært GET; alignert med S3 read-only |
| **Driver** lesing av stopp | Eksisterende GET; tenant-/driver-scope tester finnes |

## Medium risiko

| Område | Risiko | Mitigasjon |
|--------|--------|------------|
| **Driver** `confirm` | Feil leveringsstatus | Idempotens, tester, kun dagens dato |
| **Kitchen** batch | Uønsket produksjonsendring | Rolle-guard, audit, ingen «skjult» knapp |
| **Company admin** metrics | «Vanity» tall | S5 — kun sporbar data |

## Høy risiko (sent i sekvens)

| Område | Risiko |
|--------|--------|
| **Superadmin** selskap/avtale/bruker | Global blast radius, påvirker onboarding |
| **Company admin** binding / oppsigelse / cron | Krever modell + juridisk + varslingskanal |
| **Billing** / faktura-mutasjoner | Økonomisk sannhet |

## Berører auth / order / billing (krever ekstra review)

- Alt som endrer **pending onboarding** eller **superadmin-aktivering**  
- Alt som endrer **ordre** eller **vindu** for employee  
- Alt som **poster** til faktura / ledger  

## Cron / påminnelse

- **Binding 3 mnd** — typisk **ny** jobb + lagring av forfallsdato + outbound — **høy risiko** og egen workstream.

## Eksisterende tester som reduserer risiko

- `tests/security/*` — rolle og scope
- `tests/tenant-isolation*.test.ts` — tenant
- `tests/api/superadmin*.test.ts` — livsløp
- `tests/kitchen*.test.ts`, `tests/driver-flow-quality.test.ts` — operativ atferd

## Etter 2C1 (company admin MVP)

| Risiko | Merknad |
|--------|---------|
| Flere ansatt-ruter | Nav bruker `/admin/users`; `people`/`employees` finnes fortsatt — ikke slettet. |
| Superadmin på `/admin` | Tower-nav skjules; kontekst kan fortsatt være begrenset — uendret semantikk. |
| KPI vs faktisk økonomi | Oversikt viser **antall ordre**, ikke beløp; faktura = CSV-eksport. |

## Etter 2C2 (kitchen runtime MVP)

| Risiko | Merknad |
|--------|---------|
| `KitchenReportClient.tsx` er ikke lenger routet | Død kode — kan fjernes i egen opprydding; ingen funksjonell avhengighet. |
| Linjevis Basis/Luxus | API setter `tier: null` — ikke brukt som operativ sannhet før avtalekobling er utvidet. |
| Dobbelt lasting ved tab/redirect | Akseptabelt for MVP; kan optimaliseres med delt cache senere. |

## Etter 2C3 (driver runtime MVP)

| Risiko | Merknad |
|--------|---------|
| `bulk-set` ikke eksponert | Med vilje — høyere risiko; egen review før feltbruk. |
| `deliveredBy` som rå id | Kan forveksles med visningsnavn — dokumentert; evt. profil-oppslag senere. |
| CSV for superadmin på annen dato | Tillatt av API; sjåfør fortsatt låst til i dag — uendret. |

## Etter 2C4 (superadmin runtime MVP)

| Risiko | Merknad |
|--------|---------|
| Signal-feil på hjem | Ved DB-feil vises banner — ikke falske KPI; bruker må gå til dedikerte sider. |
| Misforståelse «én knapp» | Forsiden har **ingen** approve/activate — reduserer utilsiktede globale handlinger. |
| capabilities inkluderer vekst/SoMe | Lenker finnes; 2C4 utvider ikke SoMe/SEO-runtime. |
