# CP5 — Operational publish chain (beslutning)

## Employee runtime leser (uendret)

- **`GET /api/week`** kombinerer aktiv avtale (`company_current_agreement` / leveringsregler) med **Sanity `menu` / `menuContent`** per operativ logikk i kodebasen.
- **Ikke** Sanity `weekPlan` som operativ bestillingskilde.

## Publisert sannhet (i dag)

- **Operativ meny:** Sanity-dokumenter som API-et faktisk leser (via eksisterende Sanity-klient) + avtalens rammer.
- **Innholdssider:** Postgres publish (content workspace) — **annen** kjede.
- **weekPlan:** Redaksjonelt spor — **egen** publish (Studio + weekplan-API) — **ikke** blandet med `/api/week` i produktfortellingen.

## Operativ kilde

| Område | Kilde |
|--------|--------|
| Menytekst / struktur | **Sanity menu/menuContent** |
| Hva som kan vises/bestilles | **DB-avtale** + måltidstyper |
| Redaksjonell uke | **Sanity weekPlan** (editorial) |

## Er Studio allerede publish-kilde for operativ meny?

**Ja** for menydokumenter: redigering og publisering skjer i **Sanity Studio**; runtime leser publiserte dokumenter. Ingen ny publish-motor i Lunchportalen backoffice.

## Hvordan CMS control plane styrer uten ny sannhet

- **Governance-UI:** `CmsOperationalPublishChain`, `CmsWeekMenuPublishControlsPanel`, `/backoffice/week-menu` forklarer kjeden og lenker til **Studio** og **domener**.
- **Ingen duplikat:** backoffice muterer ikke meny i egen database.

## Publish via

- **Operativ meny:** Eksisterende **Sanity** publish (Studio).
- **Innhold:** Eksisterende **content workspace** publish (Postgres).
- **weekPlan:** Eksisterende **Sanity** + `app/api/weekplan/*` — editorial.

## Preview vs publish (samme forståelse)

- **Meny:** Forhåndsvisning = det som er tilgjengelig fra Sanity for samme nøkler som tabellen på `/backoffice/week-menu`; runtime bruker samme klasse data i `/api/week`.
- **Content:** Preview/publish i workspace — ikke bland med meny.

## Read-only / review / publish-control

| Modus | Uke/meny |
|-------|----------|
| Read-only | CMS muterer ikke DB-avtale her |
| Review | Menneskeleser kjede + tabell før Studio |
| Publish-control | **Studio** for meny; eksplisitt forklart i UI |

## CP5 implementasjon (kode)

- `OPERATIONAL_WEEK_MENU_PUBLISH_CHAIN` + `CmsOperationalPublishChain`.
- `actionRouting` på `CONTROL_PLANE_DOMAIN_ACTION_SURFACES` + visning i `CmsDomainActionSurfaceCard`.

## Må vente (dobbelsannhet)

- Felles én-knapp publish som skriver både Postgres content og Sanity meny uten migrering.
- Gjeninnføring av weekPlan som employee kilde uten produktvedtak.
