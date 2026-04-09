# U30X-READ-R3 — AI governance parity proof

## Modulposture (CODE_GOVERNED)

Kilde: `lib/cms/moduleLivePosture.ts`

| id | Posture | Relevant for editor/AI |
|----|---------|-------------------------|
| `worker_jobs` | **STUB** | AI Center / workers — eksplisitt «delvis ikke implementert» |
| `seo_growth` | LIMITED | |
| `social_calendar` | LIMITED | |
| `social_publish` | DRY_RUN | Ekstern publish |
| `esg` | LIMITED | |

`BackofficeExtensionContextStrip` viser posture-badge for manifest-entries med `modulePostureId`.

## AI-flater (utvalg — ikke eks. alle filer)

| AI Surface | Files / Routes | Posture | Governance model | Human approval | Provider flexibility | Cost visibility | Parity class | Notes |
|------------|----------------|---------|------------------|----------------|---------------------|-----------------|--------------|-------|
| Intelligence dashboard | `app/api/backoffice/ai/intelligence/dashboard/route.ts` → `getSystemIntelligence` | Avhenger av event store | Server-only aggregation | Indirekte (apply skjer andre steder) | Låst til intern pipeline (`lib/ai/intelligence`) | Ikke i denne ruta | **PARTIAL** | 500 ved `INTEL_LOAD_FAILED` |
| Intelligence events | `app/api/backoffice/ai/intelligence/events/route.ts` | — | Logging | — | — | — | **PARTIAL** | Les detaljer i fil |
| Block/page AI | `app/api/backoffice/ai/*`, `ContentWorkspace` + `useContentWorkspaceAi` | Mixed | Metrics `logEditorAiEvent` | Apply flows i UI | OpenAI/etc via server | Ikke dokumentert her | **PARTIAL** | |
| Cron/autonomous | `app/api/cron/autonomous/route.ts` (refs `content_pages`) | INTERNAL_ONLY / cron | — | — | — | — | **STRUCTURAL_GAP** vs Umbraco AI governance | |

## Umbraco AI-prinsipper — avvik

- **Optional AI:** LP har mange AI-innganger; noen moduler er **STUB/LIMITED** — **CODE_GOVERNED** ærlighet via `MODULE_LIVE_POSTURE_REGISTRY`.  
- **Human approval:** Delvis — full-page AI modal har `onApply`; detaljert audit krever lesing av `useContentWorkspaceAi` / apply routes (**PARTIAL** uten full trace i denne crawl).  
- **Provider flexibility:** Sentralt i `lib/ai/*` — **ikke** Umbraco provider abstraction — **STRUCTURAL_GAP**.

## Sluttdom

**PARTIAL** governance-ærlighet (posture); **STRUCTURAL_GAP** mot Umbraco AI **produktarkitektur**. `worker_jobs` **STUB** er kritisk å ikke feiltolke som LIVE.
