# U30X — CMS repo crawl baseline

**Dato:** 2026-03-30  
**Kilde:** Kodelesing i `app/(backoffice)`, `app/api/backoffice`, `lib/cms`, `components/backoffice`, `components/cms`, `docs/umbraco-parity`, eksisterende U23–U30R-dokumenter.

## Hva som utgjør CMS / backoffice (primært)

| Område | Rolle |
|--------|--------|
| `app/(backoffice)/**` | Superadmin-only shell (`BackofficeShell`, `TopBar`, `SectionShell`), content workspace, settings hubs, AI/SEO/ESG-flater |
| `app/api/backoffice/**` | Tree, pages CRUD, publish, workflow, media, experiments, AI jobber — **control plane** mot Postgres/Sanity der relevant |
| `lib/cms/**` | Extension registry (`backofficeExtensionRegistry`), tree/audit helpers, governance, document types |
| `components/cms/**`, `components/backoffice/**` | Control plane UI (audit timeline, history strip, command palette) |

## Indirekte støtte (ikke CMS-sannhet)

| Område | Merknad |
|--------|---------|
| `app/api/orders/**`, `lib/week/**` | Operativ runtime — CMS leser/ruter, muterer ikke ordresannhet |
| `app/kitchen/**`, `app/driver/**` | Runtime towers — lenket fra registry, ikke CMS-motor |
| `app/admin/**`, `app/superadmin/**` (utenfor `/backoffice`) | Egen runtime/admin — skilles bevisst fra backoffice-content |

## Aktive surfaces (hovedtrekk)

- **Nav:** `BACKOFFICE_NAV_GROUP_ORDER` + `TopBar` (seksjon `select` + modul-lenker per gruppe).
- **Content:** `/backoffice/content` — `ContentWorkspace` + `SectionShell` (tre | workspace).
- **Settings:** `/backoffice/settings` — hub med lenker til document types, data types, create policy, governance.
- **Tree API:** `GET /api/backoffice/content/tree` — virtuelle røtter (Hjem, overlays, global, design) + `content_pages`.
- **Audit API:** `GET /api/backoffice/content/audit-log` — Postgres `content_audit_log`, degradert når tabell mangler.

## Halvferdige / degraderte / sårbare

- **Schema/cache:** Tree og audit må tåle manglende kolonner/tabeller uten 500 der det er forsvarlig.
- **Editor:** Tri-pane (struktur | canvas | inspektør) er kompleks; mange mikrolag i chrome (topbar, save, mode strip).
- **Dokumentasjon:** Mange `Uxx_*` og `CPxx_*` filer — noen overlappende; kode er autoritativ.

## Komponenter som styrer editoropplevelsen mest

- `ContentWorkspace.tsx` (state-hub)
- `ContentWorkspaceChrome` / `ContentWorkspaceTriPaneSection` / `ContentWorkspaceWorkspaceShell` (layout)
- `ContentWorkspaceMainCanvas` + `LivePreviewPanel` (canvas + preview)
- `RightPanel` + `ContentWorkspacePropertiesRail` (inspektør)
- `ContentTree.tsx` + `SectionShell` (ytre tre)

## U30X endringsområder (denne fasen)

1. Tree-API: ærlig degradering + fiks `isMissingTableError` som feiltolket kolonne-feil som «manglende tabell».
2. Klient: `parseTreeFetchEnvelope` + varsler i `ContentTree`.
3. Workspace: bredere innholdssøyle, større preview, roligere inspektør-labels, tettet kontekst-strip.
4. Audit: utvidet klassifisering av «unavailable»-feil.
5. Tester: `treeRouteSchema`, `parseTreeEnvelope`, `treeRouteDegradable`.
