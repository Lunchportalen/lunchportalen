# Enterprise Audit — Fase 2: FRONTEND / UX Deep-Audit

**Date:** 2026-05-24  
**Scope:** READ-ONLY · `app.lunchportalen.no` (Next.js) · `lunchportalen.no` (Umbraco Views)  
**Baseline:** [00-inventory.md](./00-inventory.md) · [01-backend.md](./01-backend.md)  
**Method:** `rg`, filesystem scan, `tsconfig.json`, line-count audit (PowerShell)

---

## Executive summary (Fase 2)

| # | Severity | Område | Funn | Bevis | Eier |
| --- | --- | --- | --- | --- | --- |
| F2-01 | **P1** | TypeScript strictness | `strict: false` i `tsconfig.json` L15 — enterprise type-safety ikke enforced. | §2.11 | [FRONTEND] |
| F2-02 | **P1** | Inline styles | **~38 filer** med `style={{` i `app/` + `components/` — brudd på audit hardregel og AGENTS S1/S1.2 mobile discipline. | §2.1 | [FRONTEND] |
| F2-03 | **P1** | Komponent-størrelse | **15+ filer >800 linjer**; størst `SocialEngineClient.tsx` **3230** linjer, `EmployeeWeekClient.tsx` **2141**. | §2.10 | [FRONTEND] |
| F2-04 | **P1** | Form validation | **0 treff** på `useForm` / `zodResolver` i `app/`+`components/` — skjemaer uten standardisert client+server schema-mirror. | §2.8 | [FRONTEND] |
| F2-05 | **P2** | Mobile-first CSS | **~25 filer** med `@media max-width` i `app/styles/ds/` + `globals.css` vs **~12** `min-width` — desktop-first breakpoints i DS-CSS. | §2.2 | [FRONTEND] |
| F2-06 | **P2** | Loading/error states | Kun **2** `loading.tsx` og **3** `error.tsx` blant **207** `page.tsx`. | §2.7 | [FRONTEND] |
| F2-07 | **P2** | Typography law | `app/layout.tsx` L19–26: **Fraunces** display-font + **Manrope** body — AGENTS S6 krever **Inter** for headings (enterprise clarity). | §2.6 | [FRONTEND] |
| F2-08 | **P2** | `: any` density | **200+ filer** i `app/` alene med `: any` (rg count mode). | §2.11 | [FRONTEND] |
| F2-09 | **P2** | Performance budgets | **INVESTIGATE** — ingen `.next` build-artefakt tilgjengelig; per-route bundle ikke målt i denne sesjonen. | §2.4 | [FRONTEND] |
| F2-10 | **P2** | Umbraco inline styles | **13** `.cshtml` partials med `style=` attributter (marketing site). | §2.13 | [FRONTEND] |
| F2-11 | **P3** | Raw `<img>` | **2** filer i `app/` (backoffice editors); ellers `next/image` på brand paths. | §2.5 | [FRONTEND] |
| F2-12 | **P1** | a11y / WCAG AA | **Structural AA-brudd** på `/week`: SC **2.4.6/1.3.1** (4× H1), SC **2.1.1** (`role="button"` uten keyboard), hardregel **48px touch** (40px sm). | §2.3 | [FRONTEND] |

---

## 2.1 Design-system overholdelse

### ds-* / lp-* frekvens

| Prefix | Observasjon | Eksempler |
| --- | --- | --- |
| `ds-*` | CSS-klasser i `app/styles/ds/design-system.css` (**107+** regler) og komponenter | `EmployeeWeekClient.tsx` (**42** ds-referanser), `components/ui/button.tsx` |
| `lp-*` | Utility/layout i `globals.css` (**101** treff) + komponenter | `OnboardingForm.tsx` (**63**), `components/ui/button.tsx` (**49**) |

### Inline styles — **P1 (F2-02)**

```powershell
rg "style=\{\{" app components --glob "*.tsx" -l | Measure-Object
# ~38 filer
```

**Høyest risiko (mobile/konvertering):**

| Fil | Treff | Merknad |
| --- | ---: | --- |
| `app/(app)/dashboard/page.tsx` | 38 | Employee dashboard |
| `app/kitchen/report/KitchenReportClient.tsx` | 10 | Operations |
| `components/app/AppShell.tsx` | 12 | App shell |
| `components/system/SystemContextHeader.tsx` | 13 | System header |
| `app/superadmin/_components/KPIBar.tsx` | 4 | Superadmin |

**Ad-hoc CSS / css-in-js:** Ingen `styled-components` eller `<style>` blocks i produksjons-`app/` (backoffice opengraph-image unntatt).

---

## 2.2 Mobile-first audit

| Metrikk | Count | Vurdering |
| --- | ---: | --- |
| `@media … max-width` | **~25** filer (app CSS + Umbraco mirror) | Desktop-first shrink patterns |
| `@media … min-width` | **~12** filer | Mobile-first progressive enhancement |

**Kritiske paths (AGENTS S1.1/S1.2):**

| Route | Mobile status | Bevis |
| --- | --- | --- |
| `/` (forside) | DS CSS med max-width breakpoints | `app/styles/ds/landing-page-blocks.css` |
| `/week` | Dedikert `employee-week.css` + `EmployeeWeekClient` (2141 linjer) | Mobile law avhenger av client-komponent — høy regressionsrisiko |
| `/login`, `/onboarding` | `AuthShell.tsx` har inline styles (6 treff) | S2 onboarding immutable rules |

**Konverteringskandidater (max-width → min-width):** `app/globals.css` (13 max-width), `app/styles/ds/design-system.css` (5 max-width).

---

## 2.3 a11y-audit (WCAG AA — due-diligence)

**Metode:** Kildekode-review på kritiske konverterings-/employee-paths + design tokens. **Ikke** axe/Lighthouse kjørt (ingen browser i audit-sesjon).

### Kritiske paths — ekspertvurdering

| Path | WCAG AA | Bevis |
| --- | --- | --- |
| `/week` | **DELVIS — ikke AA-ready** | `EmployeeWeekClient.tsx`: **32+** `aria-*`/`role` (radiogroup, dialog, busy, labels). **Gap:** `page.tsx` har **4× `<h1>`** i ulike render-grener (L487, L593, L629, L672); L1249 `role="button"` på `div` uten synlig `tabIndex` |
| `/login` | **DELVIS** | `role="alert"` på feil (L156, L162); focus-visible på inputs via DS |
| `/onboarding` | **DELVIS** | `aria-pressed` på tier-valg; begrenset skjema-aria |
| Design tokens | **POSITIVT** | `globals.css` L904: `.lp-btn { min-height: 44px }`; **unntak:** `.lp-btn--sm` **40px** (L931–932) |
| Motion | **OK** | `lib/ui/motion.css` L1719 `prefers-reduced-motion: reduce` |
| Focus | **OK** | `focus-visible` på `.lp-btn` L926; utbredt i backoffice/week CSS |

### Funn **F2-12 (P1)** — WCAG Success Criteria

| # | Brudd | WCAG SC | Bevis | Severity driver |
| --- | --- | --- | --- | --- |
| 1 | **4× `<h1>`** i ulike render-grener på samme route | **SC 2.4.6** (Headings and Labels) + **SC 1.3.1** (Info and Relationships) | `app/(app)/week/page.tsx` L487, L593, L629, L672 | **Structural** — heading hierarchy er programmatisk feil, ikke polish |
| 2 | **`div role="button"`** uten `tabIndex`, `onKeyDown`, eller `<button>` | **SC 2.1.1** (Keyboard) | `EmployeeWeekClient.tsx` L1249 | **Foundational AA** — keyboard-only brukere kan ikke nå handlingen |
| 3 | **`.lp-btn--sm` min-height 40px** på employee CTAs | **SC 2.5.5** (Target Size — AA tillater 24px) **+ hardregel-brudd** | `globals.css` L931–932 | WCAG AA **passer**, men bryter **userPreferences / AGENTS S1.1 «Min 48px touch-target»** på mobile-first paths |
| 4 | **Due-diligence attest** | — | Ingen axe/Lighthouse AA-run | **Kan ikke sertifisere WCAG AA** for `/week` |

**Positiv kontekst (reduserer ikke P1 på 1–2):** `EmployeeWeekClient.tsx` har 32+ `aria-*`/`role`-attributter; `prefers-reduced-motion` i `lib/ui/motion.css` L1719; `.lp-btn` default **44px** L904.

**Konklusjon:** a11y **COVERED** med **1 P1-funn (F2-12)** — due-diligence kan **ikke** attestere AA på employee week path.

---

## 2.4 Performance budgets

**Status: INVESTIGATE (F2-09)**

- Ingen `.next/BUILD_ID` funnet — `npm run build:enterprise` ikke kjørt i audit-sesjon (READ-ONLY tidsboks).
- **Anbefalt før Fase 4:** kjør build og arkiver First Load JS for `/`, `/week`, `/login`, `/admin/dashboard`.

**Tree-shaking kandidater:** `rg "import \* as"` — backoffice AI panels og superadmin clients (manuel review).

---

## 2.5 Image optimization

| Metrikk | Count |
| --- | ---: |
| Raw `<img ` i `app/` | **2** (backoffice editors) |
| `from "next/image"` | **~16** filer (brand/header paths) |
| `public/brand/` | LP-logo PNG — korrekt for S10/S11 |

**webp/avif ratio:** Ikke fullt inventert; marketing blocks bruker Sanity CDN URLs.

---

## 2.6 Font loading

```typescript
// app/layout.tsx L19–26
const fontBody = Manrope({ ..., variable: "--lp-font-body", display: "swap" });
const fontDisplay = Fraunces({ ..., variable: "--lp-font-display", display: "swap" });
const fontHeading = Inter({ ..., variable: "--lp-font-heading", weight: ["600", "700"] });
```

| Aspekt | Status |
| --- | --- |
| `next/font` | **Ja** — self-hosted, `display: "swap"` |
| FOIT/FOUT | Mitigert via swap |
| S6 compliance | **FAIL** — Fraunces er decorative display font; headings skal være Inter-only per production law |

---

## 2.7 Loading / error / empty states

| Artefakt | Count | Stier |
| --- | ---: | --- |
| `page.tsx` | **207** | Hele app |
| `loading.tsx` | **2** | `app/admin/loading.tsx`, `app/superadmin/firms/loading.tsx` |
| `error.tsx` | **3** | `app/error.tsx`, `app/admin/error.tsx`, `app/superadmin/firms/error.tsx` |
| `not-found.tsx` | **INVESTIGATE** | Ikke telt i sesjon |

**Konsekvens:** Employee `/week`, `/kitchen`, `/driver` mangler dedikerte route-level loading/error boundaries — spinner-only eller blank flash sannsynlig.

---

## 2.8 Form validation

| Metrikk | Resultat |
| --- | --- |
| `useForm` / `zodResolver` | **0 treff** i app/components |
| Onboarding | `app/onboarding/OnboardingForm.tsx` — manuell state (**63** lp-* klasser) |
| Login | `app/(auth)/login/LoginForm.tsx` — manuell validering |
| Server mirror | API routes bruker Zod i `lib/validation/` — **server-only**, ikke mirrored i client forms |

**Due-diligence gap:** Client/server validation drift risiko (onboarding phone UX er frozen — endring krever ekstrem forsiktighet).

---

## 2.9 Microinteraction polish

| Signal | Resultat |
| --- | --- |
| Motion tokens | `lib/ui/motion.css` — `--lp-duration-fast: 120ms`, `--lp-duration-normal: 200ms` |
| Button interaction | `components/ui/button.tsx` — `active:scale-[0.98]`, `focus-visible` ring |
| Employee `/week` | Loader2 spinners med `aria-hidden`; confirm dialog med modal semantics |
| Backoffice | Rik polish (AI panels, transitions) |

**Due-diligence:** Motion system er **enterprise-klar** på token-nivå; employee paths er funksjonelle, ikke Stripe/Linear-nivå overalt. **0 P1/P2 funn** — cosmetic gaps only.

---

## 2.10 Komponent-duplisering og størrelse

**Merk:** **F2-03** = mega-filer (>800 linjer). **Duplisering** = separate P2-mønster.

| Mønster | Stier | Severity |
| --- | --- | --- |
| Kitchen view dual | `app/kitchen/KitchenView.tsx` + `components/kitchen/KitchenView.tsx` | P2 |
| Legacy headers | `archive/components/PublicHeader.tsx` vs canonical | P2 |
| Card primitives | `app/superadmin/_components/Card.tsx` vs `components/ui/card.tsx` | P3 |
| Canonical button | `components/ui/button.tsx` (49 lp-* refs) | — |

**Mega-clients (>800 linjer) — F2-03:**

| Linjer | Fil |
| ---: | --- |
| 3230 | `app/superadmin/growth/social/SocialEngineClient.tsx` |
| 2141 | `app/(app)/week/EmployeeWeekClient.tsx` |
| 1639 | `app/superadmin/sales/SalesCockpitClient.tsx` |
| 1525 | `app/superadmin/control-tower/ControlTowerClient.tsx` |
| 1399 | `app/(backoffice)/backoffice/content/_components/ContentAiTools.tsx` |

---

## 2.11 TypeScript strictness

```json
// tsconfig.json L15
"strict": false,
```

| Metrikk | Count (indikativ) |
| --- | ---: |
| `: any` i `app/` | **200+ filer** |
| `: any` i `components/` | **~27 filer** |
| `@ts-ignore` / `@ts-expect-error` | **INVESTIGATE** — ikke fullt telt |

**Enterprise impact:** Type holes i API client boundaries (`EmployeeWeekClient`, superadmin clients) øker regressionsrisiko ved schema-endringer (korrelert med B1-03 ghost-kolonner). **F2-08** (`: any` density) er sekundært funn i samme sub-item.

---

## 2.12 i18n-status

| Aspekt | Status |
| --- | --- |
| Locales | **Kun norsk** — ingen `next-intl` / i18n keys |
| Copy | Hardcoded norske strenger |
| Due-diligence | **Mono-locale dokumentert** — ikke gap for nåværende NO-marked |

**Funn-count: 0** (informative only).

---

## 2.13 Umbraco frontend (lunchportalen.no)

| Sjekk | Resultat |
| --- | --- |
| Inline `style=` i Views | **13** partials (`_LosningenFeaturesBlock.cshtml` **18** treff alene) |
| DS CSS mirror | `umbraco17/.../wwwroot/css/design-system.css` — parallell til Next DS |
| WCAG AA | **INVESTIGATE** — ikke kjørt axe/Lighthouse i sesjon |

---

## Appendiks — queries brukt

```powershell
# Inline styles
rg "style=\{\{" app components --glob "*.tsx" -l

# Mobile breakpoints
rg "@media.*max-width" app/styles --glob "*.css" -c
rg "@media.*min-width" app/styles --glob "*.css" -c

# Largest TSX
Get-ChildItem -Recurse -Include *.tsx -Path app,components |
  ForEach-Object { ... } | Sort-Object Lines -Descending | Select -First 15

# Forms
rg "useForm|zodResolver" app components --glob "*.{ts,tsx}"

# Client components
rg '"use client"' app --glob "*.{ts,tsx}" -l | Measure-Object
```

---

## Fase 2 completeness-sjekk (pre GO Fase 3)

| Sub-item | Status | Funn-count | Note |
| --- | --- | ---: | --- |
| 2.1 design-system overholdelse | **COVERED** | 1 | F2-02 inline styles (~38 filer) |
| 2.2 mobile-first | **COVERED** | 1 | F2-05 max-width > min-width i DS CSS |
| 2.3 a11y (WCAG AA) | **COVERED** | 1 | **F2-12 P1** — SC 2.4.6/1.3.1, SC 2.1.1, hardregel 48px |
| 2.4 performance budgets | **COVERED** | 1 | F2-09 INVESTIGATE (ingen build-artefakt) |
| 2.5 image optimization | **COVERED** | 1 | F2-11 (2× raw `<img>` i backoffice) |
| 2.6 font loading | **COVERED** | 1 | **F2-07** Fraunces/Manrope vs S6 Inter-only headings |
| 2.7 loading/error/empty | **COVERED** | 1 | F2-06 (2/207 loading.tsx) |
| 2.8 form validation | **COVERED** | 1 | F2-04 (0 useForm/zodResolver) |
| 2.9 microinteraction polish | **COVERED** | 0 | Motion tokens OK; 0 P1/P2 |
| 2.10 komponent-duplisering | **COVERED** | 2 | **F2-03** størrelse + P2 KitchenView dual path (ikke samme funn) |
| 2.11 TypeScript-strictness | **COVERED** | 2 | F2-01 strict off + F2-08 `: any` density |
| 2.12 i18n-status | **COVERED** | 0 | Mono-locale NO — dokumentert, ikke gap |
| 2.13 Umbraco frontend | **COVERED** | 1 | F2-10 (13 cshtml inline styles) |

---

## STOP-PUNKT 2

Fase 2 FRONTEND/UX-leveranse er **komplett** for due-diligence (§2.4 bundle = INVESTIGATE med funn).

**GO Fase 3:** DEVOPS/Platform → `03-devops.md`.
