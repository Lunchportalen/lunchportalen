# MASTER_REMEDIATION_PLAN

Prioritert, **hard** plan. Ingen kosmetikk uten å adressere struktur der det er nødvendig.

---

## 0–2 uker: Akutt stabilisering

| Tiltak | Hvorfor | Berørte områder | Risiko | Prioritet | Type |
|--------|---------|-----------------|--------|-----------|------|
| **Dokumenter og fiks Node heap for build** | CI og utviklere må reprodusere bygg | `package.json` scripts / CI env / README | Lav | P0 | Quick win |
| **Fjern eller arkiver duplikat** `superadmin/system/repairs/run/route.ts` | Én sannhet for system motor | `superadmin/system/repairs/run/route.ts`, `app/api/superadmin/system/repairs/run/route.ts` | Medium — må verifisere import | P0 | Grunnmur |
| **Kjør `build:enterprise` i CI** (allerede i `ci-enterprise.yml`) | Bekreft at gate er reell | **Ikke endre** hvis grønt — **ikke verifisert lokalt** | — | P0 | Verifikasjon |
| **Sikkerhetsreview: `global_content` RLS** | Policy åpner bred skriveflate for `authenticated` | `supabase/migrations/20260421000000_global_content.sql` | Medium | P0 | Sikkerhet |
| **Stopp bruk av `lint:ci` som blokerende** hvis den brukes slik | `lint:ci` er definert som `next lint \|\| exit 0` i `package.json` — **skjuler feil** | CI workflows | Lav | P1 | Quick win |

---

## 2–6 uker: Strukturell opprydding

| Tiltak | Hvorfor | Berørte områder | Risiko | Prioritet | Type |
|--------|---------|-----------------|--------|-----------|------|
| **Splitt `ContentWorkspace.tsx`** i domene-moduler (maks ~300–500 linjer per fil) | Eneste bærekraftige vei for redaksjonell kvalitet | `app/(backoffice)/backoffice/content/_components/` | Høy — må gjøres inkrementelt | P0 | Grunnmur |
| **Fjern `@ts-nocheck` fra `publicPreviewParity.test.ts`** | Kontrakttester må være type-sikre | `tests/cms/publicPreviewParity.test.ts` | Medium | P1 | Grunnmur |
| **Konsolider API: intern vs ekstern** | 314 ruter er ikke bærekraftig | `app/api/**` | Høy | P1 | Strategisk |
| **Sanity studio: én sannhet** | `studio/lunchportalen-studio/DEPRECATED.md` indikerer forvirring | `studio/` | Medium | P2 | Opprydding |

---

## 6–12 uker: Re-arkitektur (innenfor samme stack)

| Tiltak | Hvorfor | Berørte områder | Risiko | Prioritet | Type |
|--------|---------|-----------------|--------|-----------|------|
| **Innfør "Content Command" lag** — alle mutasjoner gjennom tjenester | Samme mønster som Umbraco services | `lib/cms/*`, `app/api/backoffice/content/*` | Høy | P1 | Strategisk |
| **Grense `lib/ai` med eksplisitt feature flag + kill-switch** | Stopp ukontrollert vekst | `lib/ai/**`, config | Medium | P1 | Strategisk |
| **Eksplisitt draft/publish state machine** | Redaktør-workflow må være deterministisk | DB + API + editor | Høy | P1 | Strategisk |

---

## 3–6 måneder: Plattformmodning

| Tiltak | Hvorfor | Type |
|--------|---------|------|
| **Reduser APIflate** — konsolider til `v1` offentlig API og interne kommandoer | Angrepsflate, dokumentasjon, testing | Strategisk |
| **Observability** — spore RID på tvers av CMS-mutasjoner | Drift og redaktør-tillit | Strategisk |
| **E2E på publish + preview + login** | Fange regressions utenfor unit | Strategisk |

---

## Må stoppes umiddelbart

1. **Nye store features i `ContentWorkspace.tsx` uten modulær utspaltning** — forsterker kollaps.
2. **Nye API-ruter uten `audit:api`-kompatibilitet** — bryter enterprise gate.
3. **Dupliserte route-filer** utenfor `app/` — vedlikeholdskatastrofe.

---

## Teknisk gjeld som ikke må videreføres

- **6k+ linjer i én React-fil** for CMS-editor.
- **`any` i API-responser** der kontrakter finnes (`app/api/something/route.ts`).
- **Duplikat system motor-filer** (root `superadmin/` vs `app/api/`).
- **Tester med `@ts-nocheck`** for kritiske kontrakter.

---

## Standardiser

- API response shape via `lib/http/respond.ts` (allerede mønster — **håndhev**).
- Norsk UTF-8 og copy (allerede i AGENTS.md).
- Én måte å gjøre media på (`next/image` der mulig).

---

## Sentraliser

- **Innholdsvalidering** (Zod) på alle skrivebaner.
- **Preview/publish** beslutninger (ikke spredt i `useEffect`).

---

## Konsepter som må inn (Umbraco-nivå)

1. **Document type** ekvivalens — eksplisitt schema per type.
2. **Editor views** — én oppgave per skjerm, ikke 40 faner i én fil.
3. **Tjenestelag** for innhold — UI kaller tjenester, ikke 50 fetch-stier inline.
4. **Klar skillelinje** mellom **kjerne lunsj** og **eksperimentell AI** (grenser, budsjett, kill-switch).
