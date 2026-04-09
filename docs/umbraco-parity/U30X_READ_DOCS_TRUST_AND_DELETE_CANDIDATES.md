# U30X-READ-R2 — Docs trust & delete candidates

**Regel:** Kode > runtime > docs. **Ingen filer slettet i U30X-READ-R2.**

## Klassifisering (prinsipper)

| Klasse | Betydning |
|--------|-----------|
| **CANONICAL** | Matcher implementasjon; trygg å bruke ved planlegging |
| **SUPPORTING** | Riktig retning, kan være delvis utdatert på detaljer |
| **HISTORICAL** | Nyttig kontekst, ikke sannhet |
| **SUPERSEDED** | Erstattet av nyere U30/U30R/U30X-* |
| **DUPLICATE** | Samme budskap som annen fil |
| **MISLEADING** | Motstridende kode eller lover Umbraco-paritet som ikke finnes |
| **DELETE_CANDIDATE** | Trygg å slette etter menneskelig review |

## docs/umbraco-parity/ (utvalg)

| Fil / mønster | Klasse | Kommentar |
|---------------|--------|-----------|
| `U30X_*_RUNTIME.md`, `U30X_CONTENT_WORKSPACE_RUNTIME.md` | **SUPPORTING → CANONICAL-nær** | Align med siste kode; ved avvik vinner kode |
| Eldre `U23_*`, `U21_*` uten referanse i kode | **HISTORICAL** | Behold til arkiv eller merk SUPERCEDED |
| Flere `*_SIGNOFF.md` / `*_VERIFICATION.md` for samme release | **DUPLICATE risk** | Konsolider senere |
| `U30X_REPLATFORMING_GAPS.md` | **SUPPORTING** | Strategi — ikke implementasjonsliste alene |

## docs/cms-control-plane/

| Klasse | Kommentar |
|--------|-----------|
| **SUPPORTING / CANONICAL** for **meny/operativ kjede** | Mange `CP*` filer; verifiser mot `lib/cms/operationalWeekMenuPublishChain.ts` |
| **DUPLICATE risk** | `CMS_CONTROL_PLANE_*` vs `CP*` overlap |
| **DELETE_CANDIDATE (senere)** | Fil som kun gjentar beslutning allerede i `AGENTS.md` + nyere U30X uten unik detalj |

## studio/**

| `lunchportalen-studio/DEPRECATED.md` | **CANONICAL** for at underprosjekt er deprecated |

## DELETE_CANDIDATE-tabell (forslag — må verifiseres manuelt)

| Fil | Hvorfor kandidat | Bedre kilde | Trygt senere? |
|-----|------------------|-------------|---------------|
| Duplikat `*_EXECUTION_LOG.md` / `*_CHANGED_FILES.md` fra gamle faser | Støy, historikk | Nyeste U30X_READ_* eller git history | Ja, etter bekreftelse |
| U29/U30 “target model” hvis fullt erstattet av U30R/U30X runtime docs | Overlapp | `U30X_READ_*` serien | Delvis |
| Markdown som beskriver **Editor2** som aktiv | **MISLEADING** | `_stubs.ts` (Editor2 null) | Ja etter rewrite eller slett |

**Advarsel:** Ikke slett **AGENTS.md** eller låste policy-filer uten eierinstruks.

## Mest skadelige mønstre (generelt)

1. Dokumenter som sier **“Umbraco 17 parity”** uten å liste **konkrete** gaps (document type store, infinite editor, variants UX).  
2. Dokumenter som ignorerer **Sanity Studio** som fortsatt operativ for menyer.  
3. Flere **signoff**-filer med motstridig status.
