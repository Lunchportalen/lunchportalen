# Rebaseline — status for tidligere sentrale funn

**Regel:** Hver rad er **re-vurdert** mot faktisk kode/kjøring mars 2026, ikke kun mot gamle rapporter.

| Original finding | Previous source | Current status | Evidence now | Why still valid / not valid / reframed |
|------------------|-----------------|----------------|--------------|----------------------------------------|
| Monolittisk `ContentWorkspace.tsx` (6k+ linjer) | `WHOLE_REPO_AUDIT_REPORT.md` §5.2 | **STILL TRUE** | `Measure-Object -Line` → **6401** linjer; ESLint mange `exhaustive-deps` i samme fil | Refaktor (FASE 1–15) har flyttet persist/data/shell-deler, men **skallet forblir dominerende** og vanskelig å revidere. |
| Heap OOM ved `next build` | RISK_REGISTER R1, gammel audit | **NOT VERIFIED** (heap hevet) / **REDUCED** med mitigering | `build:enterprise` **PASS** med `NODE_OPTIONS=--max-old-space-size=8192` (~12,5 min). **Ikke** kjørt uten hevet heap i denne økten. | Risiko for svake miljøer består til standard Node-minne er **bevist** OK. |
| «314 API-ruter» som eneste sannhet | Gammel audit, git | **REFRAMED** | **Git:** `git ls-files` + `route.ts` under `app/api` = **314**. **Disk (denne WS):** **557** `route.ts`. **CI:** `api-contract-enforcer` rapporterte **557** filer. | Gammel rapport **underrapporterte** ikke nødvendigvis — **git vs arbeidskopi** divergerer. Profesjonell tolkning: **tell på ren branch/commit**; lokal disk kan være utvidet. |
| «295 lib/ai-filer» | Gammel audit | **REFRAMED** | **Git:** **295** `lib/ai`-filer sporet. **Disk:** **698** `.ts`-filer under `lib/ai` i denne kopien. | Samme som API: **versjonert kode** vs **lokal filflate**. AI-governance (63 filer OK i logg) er **ikke** lik «antall filer». |
| Duplikat `superadmin/system/repairs/run` utenfor `app/api` | RISK_REGISTER R2 | **RESOLVED** | `glob **/superadmin/**/repairs/**/route.ts` finner kun `app/api/superadmin/system/repairs/*/route.ts`. Ingen duplikat `route.ts` under `superadmin/` utenfor `app/api`. | Tidligere risiko ser ut til å være fikset eller feil sti i gammel rapport. |
| `global_content` RLS `authenticated` bred | RISK_REGISTER R7 | **STILL TRUE** (policy) / **NOT VERIFIED** (runtime) | Migrering `20260421000000_global_content.sql` er uendret i vurdering; **ingen** ny end-to-end penetrasjonstest i denne rebaseline. | Krever fortsatt **sikkerhetsreview** mot faktisk klientbruk (service role vs direkte klient). |
| `any` i API / `data?: any` | Gammel audit | **REDUCED** (delvis) | `api-contract-enforcer` PASS på 557 ruter; kontraktsform er **håndhevet** — men det eliminerer ikke `any` i typer. | Flyttet fra «helt ukontrollert» til «JSON-kontrakt + RID» — **ikke** full Zod-dekning. |
| `@ts-nocheck` i `publicPreviewParity.test.ts` | Gammel audit | **RESOLVED** | `tests/cms/publicPreviewParity.test.ts` starter med **ikke** `@ts-nocheck` (lesing linje 1–15). | Funn var korrekt; **nå utdatert** for denne filen. |
| `@ts-nocheck` utbredt i tester | Gammel audit R9 | **STILL TRUE** (bredere) | `grep` `@ts-nocheck` i `tests/**/*.ts` → **79** filer med treff. | **Forverret** i antall filer vs én parity-test — testkontrakttillit er fortsatt begrenset. |
| `lint:ci` maskerer lint (`|| exit 0`) | RISK_REGISTER R11 | **RESOLVED** | `package.json`: `"lint:ci": "next lint"` — **ingen** `|| exit 0`. | Gammel risiko **stale**; dagens script er **ikke** silent-fail. |
| `as unknown as` spredt | Gammel audit | **STILL TRUE** | `grep` viser treff i `lib/ai/*`, `lib/revenue/*`, `componentRegistry`, `instrumentation.ts`, m.fl. | Type-sikkerhet ved grenser (JSONB, events) fortsatt. |
| Sanity Studio duplikat | RISK_REGISTER R8 | **REDUCED** | `DEPRECATED.md` under `lunchportalen-studio`; kanon dokumentert. | **Ikke** fullt «én mappe slettet» — fortsatt **forvirringsrisiko** for nye utviklere. |
| E2E ikke kjørt i audit | RISK_REGISTER R12 | **STILL TRUE** | `npm run e2e` **ikke** kjørt i denne rebaseline. | Regresjonsrisiko for kritiske UI-flyter uavklart. |
| Preview-paritet | Gammel bekymring | **REDUCED** | `POST_IMPLEMENTATION_REVIEW.md` dokumenterer kanonisk kjede; `publicPreviewParity.test.ts` uten nocheck; tester grønne. | **Tillit økt** — men fortsatt avhengig av testdekning og ikke manuell cross-browser. |
| `next lint` deprecated | Gammel audit | **STILL TRUE** | Lint-output viser Next 16-deprecation. | **Fremtidig** verktøybrudd — planlegg ESLint CLI. |
| `<img>` vs `Image` i editor | Gammel audit | **STILL TRUE** | Samme ESLint-warnings i `BlockCollapsedPreview`, `ContentWorkspace.tsx`, m.fl. | LCP/CLS-risiko i CMS — **ikke** blokkert av gate. |

## Sammendrag

- **Klart stale:** duplikat `repairs`-route utenfor `app/api` (ikke funnet); `lint:ci` silent-fail (ikke lenger); `@ts-nocheck` på **kun** `publicPreviewParity` (fjernet).
- **Må reframes:** API- og `lib/ai`-**tall** — bruk **git** + ren **working tree** som sannhet; disk-tall i «dirty» kopier kan være misvisende.
- **Fortsatt harde:** `ContentWorkspace`-størrelse, bred RLS-grep på `global_content`, mange `@ts-nocheck` i tester, stor HTTP/AIflate, heap-avhengig build.
