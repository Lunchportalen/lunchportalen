# U30X-READ-R3 — Runtime failures and schema gaps

**Viktig:** Ingen faktisk kjøring av `npm run dev`, `build`, eller live logger i denne fasen. Tabellen under bygger på **statisk kodegjennomgang** + eksisterende test-referanser. **Terminal-/dev-logg vedlagt:** nei.

## Obligatoriske ruter (kode-bevis)

| Route | Failure mode (kode) | Evidence | Likely schema truth | Severity | Parity impact | Next phase |
|-------|---------------------|----------|---------------------|----------|---------------|------------|
| `GET /api/backoffice/content/tree` | 200 + `degraded: true` tom/virtuelt tre | `tree/route.ts` `isMissingTableError`, `isTreeRouteDegradableSchemaError` | `content_pages` mangler eller kolonne-feil | **Høy** når tom | Tree/editor meningsløs | Migrasjon / DB |
| Samme | `page_key` fallback | `usedPageKeyColumnFallback` + `opsLog` | Kolonne kan mangle | Medium | **DEGRADED** inferens | Verifiser migrasjon `20260330120000_u30r_content_pages_page_key_if_missing.sql` |
| `GET /api/backoffice/content/audit-log` | 200 + `items: []`, `degraded: true` | `audit-log/route.ts` | `content_audit_log` mangler | Medium | Historikk strip tom | DB + RLS |
| `GET /api/backoffice/releases` (liste) | 500 `SERVER_ERROR` ved repo throw | `releases/route.ts` catch | `content_releases` finnes i migrasjon `20260304000000_content_releases.sql` | **Høy** hvis DB ikke migrert | Releases UI | Verifiser miljø |
| `GET /api/backoffice/esg/latest-monthly` | 500 generisk | `latest-monthly/route.ts` `catch` | Avhenger av `loadLatestMonthlyRollupList` | Medium | ESG backoffice | Les `lib/esg/latestMonthlyRollupList` |
| `GET /api/backoffice/ai/intelligence/dashboard` | 500 `INTEL_LOAD_FAILED` | `intelligence/dashboard/route.ts` | `getSystemIntelligence` / event store | Medium | Intelligence view | Debug `lib/ai/intelligence` store |

## Tabeller (migrasjoner funnet i repo)

- `content_releases` + `content_release_items` — `supabase/migrations/20260304000000_content_releases.sql`  
- `ai_intelligence_events` — `20260323140000_ai_intelligence_events.sql`  
- `content_pages.page_key` — `20260330120000_u30r_content_pages_page_key_if_missing.sql`  

## Kodeantakelser vs drift

- Tree antar `content_pages` eksisterer; ellers **degraded** (ikke 500) — **RUNTIME_TRUTH** god praksis.  
- Audit antar tabell; ellers **degraded** liste — **RUNTIME_TRUTH**.  
- Intelligence dashboard **fail hard** (500) på exception — **BROKEN** opplevelse ved feil kontra tree/audit fail-closed 200.

## Parity impact

- **Schema drift** undergraver Bellissima-lignende «alltid på» workspace — spesielt **tree** og **audit timeline**.  
- Klassifisering: **RUNTIME_TRUTH** (kode), **DEGRADED** (når flagg), **BROKEN** (500 paths).
