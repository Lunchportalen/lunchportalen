# Docs drift report (V2)

**Prinsipp:** Kode i repo er **source of truth**. Dokumenter som motstrider kode er **DOC_DRIFT** eller **HISTORICAL**.

## Klassifiseringsnøkkel

| Kode | Betydning |
|------|-----------|
| **CURRENT** | Stemmer med observerbar kode (stikkprøver + gates). |
| **PARTIALLY_CURRENT** | Delvis riktig; noen seksjoner utdatert. |
| **HISTORICAL** | Nyttig kontekst, ikke gjeldende sannhet. |
| **SUPERSEDED** | Erstattet av nyere doc (f.eks. phase2d over 2b). |
| **ARCHIVE_CANDIDATE** | Bør flyttes til `docs/archive/` eller merkes. |

## `docs/hardening/*` (utvalg)

| Dokument | Vurdering | Kommentar |
|----------|-----------|-----------|
| `RESOLVED_BASELINE_ITEMS.md` | **CURRENT** | Matcher `lib/week/availability.ts` (15:00) og employee `next` — **verifiser** ved endring. |
| `DELTA_AUDIT_FROM_BASELINE.md` | **PARTIALLY_CURRENT** | Avhenger av baseline-dato. |
| `GO_LIVE_READINESS_CHECKLIST.md` | **PARTIALLY_CURRENT** | Levende sjekkliste — må oppdateres ved pilot-scope. |
| `OPEN_PLATFORM_RISKS.md` | **CURRENT** | Åpne risikoer fortsatt relevante (strict mode, middleware-roller). |

## `docs/phase2a`–`2d` (surface docs)

| Område | Vurdering |
|--------|-----------|
| `docs/phase2b/*` (CONTENT_TREE, MEDIA) | **PARTIALLY_CURRENT** — detaljer kan avvike fra siste refaktor i `ContentWorkspace`. |
| `docs/phase2c/*` (towers) | **PARTIALLY_CURRENT** — IA/UX kan ha endret seg. |
| `docs/phase2d/*` (SEO/Social/ESG runtime) | **CURRENT** som **design intent**; kode må **re-verifiseres** per release. |

## `docs/audit/full-system/*` og `docs/audit/CMS_*`

| Dokument | Vurdering |
|----------|-----------|
| `WHOLE_REPO_AUDIT_REPORT.md`, `REBASELINE_*` | **HISTORICAL** / **SUPERSEDED** av **FULL_REPO_AUDIT_V2** — behold som referanse. |
| `CMS_AUDIT_REPORT.md` | **PARTIALLY_CURRENT** — stor CMS-endring siden. |

## Rot-nivå `.md` (repo root)

| Mønster | Vurdering |
|---------|-----------|
| `AGENTS.md` | **CURRENT** (policy — låst) |
| `README.md` | **PARTIALLY_CURRENT** |
| `*_POLICY.md`, `*_PLAN.md`, `ENTERPRISE_*` | **ARCHIVE_CANDIDATE** eller **HISTORICAL** — mange overlapper `docs/`; **DOC_DRIFT** |

## `docs/refactor/*`

| Vurdering |
|-----------|
| **HISTORICAL** — beslutningshistorikk; ikke automatisk sannhet for nåværende filplassering. |

## Studio

| `studio/lunchportalen-studio/DEPRECATED.md` | **SUPERSEDED** / **HISTORICAL** — eksplisitt |

## Konklusjon

- **Minst én** ny **kanonisk** audit: `FULL_REPO_AUDIT_V2.md` (denne leveransen).  
- **Eldre** full-system rapporter: **ikke** slett; merk som **SUPERSEDED** ved behov.  
- **Rot-policyfiler:** **DOC_DRIFT** mot `docs/` — strukturert opprydding **senere** (ikke i denne fasen).
