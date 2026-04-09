# UMBRACO_GAP_REPORT

Sammenligning mot **Umbraco-lignende** plattformmodenhet: tydelig innholdsmodell, forutsigbar redaksjonell UX, trygg preview/publish, tillit og utvidbarhet. **Stacken trenger ikke være .NET** — prinsippene gjelder.

---

## 1. Content modeling

| Umbraco-forventning | Nåsituasjon (repo) | Gap | Kodebevis / peker |
|---------------------|---------------------|-----|-------------------|
| Dokumenttyper først, eksplisitt schema | Innhold modellert som **DB-rader + `jsonb` + blokker**; delvis kontrakter i `lib/cms/blocks/` | Modellen er **implisitt** spredt på migrasjoner, TypeScript-typer og editor | `supabase/migrations/20260421000000_global_content.sql` (`data jsonb`); `lib/cms/blocks/blockContracts.ts` |
| Én sannhet per document type | Flere lag (variants, pages, global rows) — **koherent når disiplinert**, men krever disiplin | **Gap:** risiko for felt som kun finnes i JSON uten migrasjonskontroll | — |

**Hva som må til:** Eksplisitt **content schema layer** (Zod/TypeScript + DB constraints) som **alle** skrivebaner bruker — ikke valgfritt per API-route.

---

## 2. Editorial UX

| Umbraco-forventning | Nåsituasjon | Gap | Bevis |
|---------------------|-------------|-----|--------|
| Fokuserte views per oppgave | Én massiv workspace-komponent | **Alvorlig gap:** kognitiv og teknisk monolitt | `ContentWorkspace.tsx` **~6401 linjer** (PowerShell måling) |
| Konsistent panelstruktur | Delvis modulært (`ContentWorkspaceShell`, panels) men **domineres** av hovedfil | Redaktør opplever **ikke** "én produktfølelse" som Umbraco — mer "én mega-komponent" | ESLint: **mange** `exhaustive-deps` warnings i samme fil (lint-logg) |

---

## 3. Block / modular architecture

| Umbraco-forventning | Nåsituasjon | Gap | Bevis |
|---------------------|-------------|-----|--------|
| Gjenbrukbare komponenter med tydelig kontrakt | `BlockCard`, `Grid*`, `blockContracts` + `componentRegistry` | **Delvis** — men `enforceBlockComponentSafety` **muterer** `data` in-place for layout | `lib/cms/blocks/blockContracts.ts` `enforceBlockComponentSafety` |
| Forutsigbar rendering | Preview-parity testet | **Styrke** | `tests/cms/publicPreviewParity.test.ts` — men `// @ts-nocheck` undergraver kontrakttillit |

---

## 4. Preview trust

| Umbraco-forventning | Nåsituasjon | Gap | Bevis |
|---------------------|-------------|-----|--------|
| Preview = produksjon + kontekst | Testet intensjon om samme pipeline | **God retning** | `tests/cms/publicPreviewParity.test.ts` header-kommentar linjer 1–6 |
| Type-sikkerhet i tester | `any` i mock, `@ts-nocheck` | **Gap** — testen "lyver" for TypeScript | `tests/cms/publicPreviewParity.test.ts` linje 7–8, 27+ |

---

## 5. Validation / guardrails

| Umbraco-forventning | Nåsituasjon | Gap | Bevis |
|---------------------|-------------|-----|--------|
| Feltvalidering sentralt | `zod` i deps; plattform-guards i `npm run ci:platform-guards` | **Delvis** — men `app/api/something` bruker `any` i JSON-hjelpere | `app/api/something/route.ts` `ok(..., data?: any)` |
| Enterprise release gate | `build:enterprise`, `audit:api`, `audit:repo` | **Styrke** | `package.json` scripts linjer 11, 32–33, 51 |

---

## 6. Media / references

| Umbraco-forventning | Nåsituasjon | Gap | Bevis |
|---------------------|-------------|-----|--------|
| Dedikert mediebibliotek med referansesjekk | Tester for stale media refs | **Styrke** | `tests/cms/staleMediaRef.test.ts` (referert i repo-indeksering) |
| `<Image />` | `<img>` i flere editor-komponenter | **Lighthouse/performance gap** | ESLint `@next/next/no-img-element` warnings inkl. `BlockCollapsedPreview.tsx`, `ContentWorkspace.tsx` |

---

## 7. Permissions

| Umbraco-forventning | Nåsituasjon | Gap | Bevis |
|---------------------|-------------|-----|--------|
| Rollebasert, server-sannhet | `lib/http/routeGuard.ts`, `requireRoleServer`, `profiles.company_id` | **Styrke** i prinsipp (AGENTS.md) | `app/api/auth/post-login/route.ts` + `lib/auth/*` |
| Lav risiko for "feil fil redigeres" | Duplikat `superadmin/.../route.ts` utenfor `app/` | **Gap** — to kopier av system motor | `superadmin/system/repairs/run/route.ts` vs `app/api/...` |

---

## 8. Maintainability

| Umbraco-forventning | Nåsituasjon | Gap | Bevis |
|---------------------|-------------|-----|--------|
| Navigerbar kodebase | `lib/ai` **295 filer** | **Ekstrem** vedlikeholdskost | `git ls-files lib/ai \| Measure-Object` → 295 |
| API-katalog | **314** API-ruter | **For stor** for menneskelig review | `git ls-files "app/api/**/route.ts"` → 314 |

---

## 9. Extensibility

| Umbraco-forventning | Nåsituasjon | Gap | Bevis |
|---------------------|-------------|-----|--------|
| Plugin-punkter | `lib/cms/plugins/runHooks.ts` | **Finnes** — men må ikke overskygges av mega-editor | grep-treff i kodebase |
| Trygg utvidelse | Ny funksjon = ny fil | Ofte **korrekt**; risiko når alt kobles inn i `ContentWorkspace` | — |

---

## 10. Workflow maturity

| Umbraco-forventning | Nåsituasjon | Gap | Bevis |
|---------------------|-------------|-----|--------|
| Draft/Publish workflow | `global_content` har `draft`/`published`; `page_versions` migreringer finnes | **Delvis** | `20260421000000_global_content.sql`; `20260430100000_page_versions.sql` (navn fra migrering) |
| Tydelig "publish" knapp og tilstand | **Ikke verifisert** i UI uten manuell kjøring | **Ikke verifisert** | — |

---

## 11. Developer ergonomics

| Umbraco-forventning | Nåsituasjon | Gap | Bevis |
|---------------------|-------------|-----|--------|
| `npm run dev` fungerer | Antatt OK | **Build** OOM lokalt | `npm run build` heap out of memory (exit 134) |
| Klar feil | Typecheck + tester grønne | **Styrke** | `npm run typecheck` 0; `npm run test:run` 1133 pass |

---

## Oppsummering

| Kategori | Umbraco-nivå? | Hovedårsak |
|----------|----------------|------------|
| Content modeling | **Under** | JSONB + spredte kontrakter |
| Editorial UX | **Langt under** | 6k+ linjer i én editorfil |
| Preview | **Nær** (testet) | `@ts-nocheck` i parity-test |
| Validation | **Delvis** | `any` i enkelte API, ellers guards |
| Permissions | **God retning** | Server guards + RLS |
| Maintainability | **Under** | AI- og API-eksposjon |
| Operations | **Delvis** | CI sterkt; lokal bygg OOM |

**Konklusjon:** Prosjektet har **brikker** som ligner på profesjonell CMS (parity-tester, migreringer, RLS), men **redaksjonell modenhet og strukturell klarhet** når **ikke** Umbraco-nivå på grunn av **monolittisk editor og plattform-oversvømmelse** (AI/API).
