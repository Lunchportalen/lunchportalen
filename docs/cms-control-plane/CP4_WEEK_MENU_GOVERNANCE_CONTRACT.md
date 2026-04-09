# CP4 — Week / menu governance contract

## Employee runtime (faktisk lesing i dag)

- **`GET /api/week`** er operativ inngang for ansatt-uke.
- Kombinerer **`company_current_agreement`** (ACTIVE) med **Sanity `menu` / `menuContent`** bygget i `buildEmployeeWeekDayRows` / relatert — **ikke** Sanity `weekPlan` som kilde for bestillbar uke.

## Publisert sannhet (i dag)

- **Menyinnhold** som API-et leser: tilgjengelige Sanity-menydokumenter + avtalens måltidstyper/leveringsdager (DB).
- **Innholdssider:** Postgres publish (content workspace) — eget lag.
- **`weekPlan` (Sanity):** eget spor (redaksjonelt / policy / synlighet) — **ikke** erklært som samme sannhet som `/api/week`.

## Operativ kilde (kanon)

| Data | Kilde |
|------|--------|
| Leveringsdager, tier, pris, cutoff (operativ) | DB-avtale + `agreement_json` der relevant (se `normalizeAgreement` / API) |
| Menytekst og struktur per måltidstype | **Sanity `menu` / `menuContent`** |
| Redaksjonell ukeplan, låsing, synlighet | **Sanity `weekPlan`** + `app/api/weekplan/*` — **editorial boundary** |

## CMS/backoffice som styringsflate

- **Ingen ny menymotor:** Studio-lenker + innsikt i backoffice (`/backoffice/week-menu`, publish-kontroll-panel).
- **Governance =** lesing + eksplisitt kjede + Studio-handlinger + lenke til runtime — **ikke** duplikat tabell.

## Felter / ruter / komponenter (CP4)

| Del | Rolle |
|-----|--------|
| `/backoffice/week-menu` | Hovedflate: operativ kjede, editorial-varsel, `CmsWeekMenuPublishControlsPanel`, meny-tabell |
| `CmsWeekRuntimeStatusPanel` | Kjede-oppsummering |
| `GET /api/week` | Uendret kontrakt |
| Studio `getSanityStudioBaseUrl()` | Publisering/redigering av meny; ukeplan-tool i Studio-venstremeny |

## Preview vs publish (samme forståelse)

- **Content:** preview/publish i content workspace = Postgres-sider.
- **Meny:** «publish» = Sanity-dokumenttilstand + tilgjengelighet for API — forklares eksplisitt i UI.
- **weekPlan:** publish via `/api/weekplan/publish` etc. — merket editorial — ikke blandes med employee-order.

## Read-only / review / publish-control (CP4)

| Område | Modus |
|--------|--------|
| Employee week API | Read-only fra CMS (CMS muterer ikke) |
| Menyredigering | Via Studio (ekstern publiseringsflate) |
| weekPlan | Editorial-only; tydelig UI-merking |
| Godkjenning av firma/avtale | Fortsatt superadmin/admin runtime |

## CP4 implementasjon (nå)

- Ett **publish/governance-panel** (`CmsWeekMenuPublishControlsPanel`) med kilde, kjede, handlinger.
- **Editorial-only** banner for `weekPlan` på `/backoffice/week-menu`.
- **Ingen** dobbel sannhet introdusert.

## Må vente (unngå dobbel sannhet)

- Én felles «publish-knapp» som skriver både Postgres og Sanity uten migrerings-RFC.
- Employee `weekPlan` som ordrekilde igjen uten eksplisitt produktvedtak.
