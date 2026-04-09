# U30X-READ-R2 — Settings & governance map

## Flater som finnes (Next routes)

| Flate | Path | Typisk rolle |
|-------|------|----------------|
| Settings root | `/backoffice/settings` | Oversikt / entry |
| Document types | `/backoffice/settings/document-types`, `.../[alias]` | Viser/definerer typer (UI) |
| Data types | `/backoffice/settings/data-types`, `.../[kind]` | Presets / kind |
| Schema | `/backoffice/settings/schema` | Oversikt |
| Create policy | `/backoffice/settings/create-policy` | Policy copy / rules |
| Create options | `/backoffice/settings/create-options` | Tillatte valg |

**Chrome:** `settings/layout.tsx`, `SettingsSectionChrome.tsx`.

## Hva er “reelle” vs read-only vs code-governed

| Område | Reell DB-administrasjon? | Code-governed? | Kommentar |
|--------|---------------------------|----------------|-----------|
| **Block allowlist** | Delvis (gjennom body + governance scan) | **Ja** — `blockAllowlistGovernance.ts`, `documentTypes` | Server/klient må enes |
| **Document types (lib)** | **Nei** — tynn liste i `lib/cms/contentDocumentTypes.ts` | **Ja** | Ikke full Umbraco-lignende DB-modell |
| **Envelope vs legacy** | Varianter i DB | **Ja** — `legacyEnvelopeGovernance.ts`, `bodyEnvelopeContract.ts` | governance-usage API måler |
| **Create restrictions** | `ContentWorkspace` state (`allowedChildTypes`, `createDocumentTypeAlias`) | **Delvis** | Henting ved create panel |
| **Governance usage** | Read-only scan | API | Superadmin innsikt |
| **AI governance** | Events, capability | `moduleLivePosture`, AI routes | Ærlig posture nødvendig |

## Filer som styrer policy (kanonisk)

- `lib/cms/blockAllowlistGovernance.ts` — **hvilke blokker** for dokumenttype.  
- `lib/cms/contentDocumentTypes.ts` — **allowedChildren / allowedBlockTypes** (minimal).  
- `lib/cms/backofficeSchemaSettingsModel.ts` — settings-modell (kontekst for backoffice).  
- `lib/cms/contentGovernanceUsage.ts` — oppsummering fra variant-rader.  
- `app/api/backoffice/content/governance-usage/route.ts` — eksponerer scan.  
- `app/api/backoffice/content/governance-registry/route.ts` — registry (les route for detaljer).

## First-class vs “ser first-class ut”

| First-class (faktisk brukt i lagring/validering) | Ser first-class ut (UI eller docs) |
|--------------------------------------------------|-------------------------------------|
| Block body + PATCH pages | Mange AI- og insights-paneler (avhenger av API + posture) |
| Allowlist + parse/serialize envelope | “Umbraco 17” manifest-språk i registry |
| Governance scan | Noen settings-sider kan være mer forklarende enn muterende — **verifiser per page** før endring |

## Modulposture (må ikke feiltolkes)

Se `lib/cms/moduleLivePosture.ts` — **LIVE / LIMITED / DRY_RUN / STUB / INTERNAL_ONLY**. Settings- og vekst-flater skal **ikke** presenteres som full produksjon uten å matche denne sannheten.
