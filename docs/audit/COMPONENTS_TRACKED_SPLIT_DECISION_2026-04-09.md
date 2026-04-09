# Tracked `components/**` diff — split til beslutningsbare bøtter

**Date:** 2026-04-09  
**HEAD ved kartlegging:** `36000acf03a10355fa587306a3bca97658b94109`  
**Binding:** `docs/audit/BINDING_DISPOSITION_TRACKED_DIRTY_TREE_2026-04-09.md` (components/** = MUST SPLIT BEFORE DECISION)  
**Scope:** Kun `git diff` mot `HEAD` for filer under `components/` — **ikke** `src/components/**` (ikke i denne tracked restflaten).

## A) Faktiske tall (git)

| Måling | Verdi |
|--------|------:|
| Filer i `git diff --name-only` under `components/` | **61** |
| Øvrig tracked diff (ikke `components/`) | **1** (`superadmin/system/repairs/run/route.ts` — **HOLD**, ikke en del av denne beslutten) |
| `git diff --stat -- components/` (rundt) | **61 files**, **+185 −1883** |

**Gruppering nivå 1 (topp-undermapper etter `components/<segment>`):**

| Segment | Antall filer |
|---------|-------------:|
| `components/superadmin/` | 18 |
| `components/admin/` | 7 |
| `components/ui/` | 4 |
| `components/site/` | 3 |
| `components/nav/`, `components/orders/`, `components/auth/`, `components/layout/`, `components/seo/` | 2 hver |
| `components/kitchen/`, `components/week/`, `components/registration/`, `components/public/`, `components/app/`, `components/audit/` | 1 hver |
| `components/*.tsx` (rot, direkte under `components/`) | 12 |

## B) Klassifisering (brutalt)

- **Slettinger (kun `-`, helt eller nesten tom fil):** rot-marketing (`AppHeader`, `Control`, `FAQ`, `FinalCTA`, `HowItWorks`, `Pricing`, `Problem`, `PublicHeader`, `Solution`, `Sustainability`), `auth/LoginForm.tsx`, `site/*` (3×), m.m. — **høy visuell/flate-endring**, samlet **~1.6k** linjer ut.
- **Store modifikasjoner (netto mye fjernet eller strukturendring):** `week/WeekMenuReadOnly.tsx` (−156 netto), `ui/toast.tsx` (−116 netto), `AppFooter.tsx`, `auth/LogoutClient.tsx`, `seo/RelatedLinks.tsx`, `nav/AuthSlot.tsx`, `layout/PageSection.tsx`, `superadmin`-navigasjon (tre filer med reell endring).
- **Små «mechanical» modifikasjoner:** **34** filer med **+2 / 0** i `git diff --numstat` (typisk én import/linje-justering per fil) — spenner over `admin/`, `app/`, `audit/`, `kitchen/`, `layout/AppChrome.tsx`, `orders/ReceiptBanner.tsx`, `public/`, `seo/IntentLinks.tsx`, `superadmin/` (15 filer unntatt Nav/MobileMenu/Tabs), `system/`, `ui/` (pagination, separator, tooltip). **Eksplisitt liste:** seksjon **G** nedenfor.
- **Blandede klumper:** `components/ui/**` (toast vs +2-trio), `components/superadmin/**` (15× +2 vs 3 filer med navigasjonsendring), `components/layout/**` (AppChrome +2 vs PageSection 2/27), `components/orders/**`, `components/seo/**`, `components/auth/**`, rot (`AppFooter` vs rene slettinger).

**Risiko (grovt):**

- **Lav:** +2/0-filene (samme mønster, isolerbart).
- **Medium:** `site/**` slettinger, rot-slettinger (avhenger av at `app/**`-importer allerede peker riktig).
- **Høy:** `week/**` (S1.1 mobil-kritisk), `registration/**` (onboarding/RC-frys), `toast`/shell, header/auth/nav-kjeden, `superadmin` chrome-navigasjon.

---

## C) Bindende beslutning per underbøtte

Kun ett utfall per rad: **KEEP IN BASELINE PATH NOW** | **REVERT TO HEAD** | **HOLD OUTSIDE BASELINE NOW** | **MUST SPLIT FURTHER**

| Underbøtte | Beslutning | Hvorfor | Blokkerer baseline direkte? | Neste tekniske pakke får / får ikke |
|------------|------------|---------|-----------------------------|-----------------------------------|
| `components/admin/**` (7 filer) | **KEEP IN BASELINE PATH NOW** | Alle **+2/0**; lav risiko, én semantikk (mechanical alignment). | Nei. | **Får:** stage/commit kun disse syv som én KEEP-slice. **Får ikke:** blande med u-/auth-/uke. |
| `components/app/AppShell.tsx` | **KEEP IN BASELINE PATH NOW** | **+2/0**. | Nei. | **Får:** inkluderes i samme «mechanical +2»-slice som admin. **Får ikke:** endre shell-semantikk utenfor diff. |
| `components/audit/AuditFeed.tsx` | **KEEP IN BASELINE PATH NOW** | **+2/0**. | Nei. | Samme mechanical-slice. **Får ikke:** blande med superadmin nav-trio. |
| `components/kitchen/KitchenView.tsx` | **KEEP IN BASELINE PATH NOW** | **+2/0**. | Nei. | Samme mechanical-slice. **Får ikke:** scope creep mot `app/kitchen`. |
| `components/public/RegisterGate.tsx` | **KEEP IN BASELINE PATH NOW** | **+2/0**. | Nei. | Samme mechanical-slice. **Får ikke:** samme commit som `registration/PublicRegistrationFlow.tsx`. |
| `components/system/**` | **KEEP IN BASELINE PATH NOW** | **+2/0** begge. | Nei. | Samme mechanical-slice. | 
| `components/layout/**` | **MUST SPLIT FURTHER** | `AppChrome.tsx` er **+2/0**; `PageSection.tsx` er **2/27** — annen risiko og annen flate. | Ikke alene; uklarhet blokkerer *trygg* én-commit-apply av hele mappen. | **Får:** to del-slices: (1) AppChrome med mechanical-pakken, (2) PageSection egen vurdering. **Får ikke:** én commit for hele `layout/`. |
| `components/ui/**` | **MUST SPLIT FURTHER** | `pagination`, `separator`, `tooltip` = **+2/0**; `toast.tsx` = stor reduksjon (**2/116**) — annen risiko (global toasts). | Indirekte (toast kan påvirke hele UI). | **Får:** mechanical-slice for tre +2-filer. **Får:** egen slice for `toast.tsx` etter egen review. **Får ikke:** blande toast med +2-trio. |
| `components/seo/**` | **MUST SPLIT FURTHER** | `IntentLinks.tsx` **+2/0** vs `RelatedLinks.tsx` **28/4** — forskjellig art. | Nei, så lenge de ikke merges blindt. | **Får:** IntentLinks i mechanical-slice. **Får:** RelatedLinks i egen beslutning/slice. |
| `components/orders/**` | **MUST SPLIT FURTHER** | `ReceiptBanner.tsx` **+2/0** vs `OrderActions.tsx` reell endring — ikke samme beslutning. | Kan hvis begge merges uten analyse. | **Får:** ReceiptBanner i mechanical-slice. **Får:** OrderActions egen slice. **Får ikke:** én «orders»-commit uten split. |
| `components/nav/**` | **MUST SPLIT FURTHER** | `AuthSlot` + `NavActiveClient` — koblet til header/auth; ikke mechanical. | Ja for header-løkker/landing hvis feil. | **Får:** egen slice etter at rot/header/auth-strategi er avklart. **Får ikke:** blande med mechanical +2 før analyse. |
| `components/auth/**` | **MUST SPLIT FURTHER** | `LoginForm.tsx` **slettet** vs `LogoutClient.tsx` **9/80** — to forskjellige beslutninger (innlogging vs utlogging). | Ja for auth-flyt. | **Får:** egne slices per fil eller REVERT/HOLD per fil etter egen vurdering. **Får ikke:** én «auth»-commit. |
| `components/site/**` | **KEEP IN BASELINE PATH NOW** | Tre rene slettinger (samme semantikk: fjerne gammel site-header-kluster). | Kan hvis `app/**` fortsatt importerer disse — må verifiseres ved apply. | **Får:** egen «deletion-only site»-commit. **Får ikke:** blande med `src/components/**` eller nye untracked site-filer uten eksplisitt binding. |
| `components/*.tsx` (rot, ekskl. undermapper) | **MUST SPLIT FURTHER** | Blandet: **ti** rene slettinger + **`AppFooter.tsx` stor mod** — ikke én «rot»-beslutning. | Ja inntil splittet. | **Får:** (1) commit-kandidat for rene slettinger som én bøtte, (2) `AppFooter.tsx` egen slice. **Får ikke:** én commit for alle tolv. |
| `components/registration/PublicRegistrationFlow.tsx` | **HOLD OUTSIDE BASELINE NOW** | RC: onboarding/registrering er frosset funksjonelt; endring her er egen risiko og egen gate. | Ja for baseline-freeze-narrativ. | **Får:** ingen apply før eksplisitt oppdrag + ev. tekst-/UI-only scope. **Får ikke:** «bare følg components-slice» uten onboarding-unntak. |
| `components/week/WeekMenuReadOnly.tsx` | **HOLD OUTSIDE BASELINE NOW** | S1.1: `/week` er mobil-kritisk; stor diff — ikke en del av første trygge slice. | Ja. | **Får:** egen pakke med mobil-testmatrise og eksplisitt scope. **Får ikke:** blande inn i mechanical +2. |
| `components/superadmin/**` | **MUST SPLIT FURTHER** | **15** filer **+2/0** vs **3** filer med reell endring (`SuperadminNav`, `SuperadminMobileMenu`, `SuperadminTabs`). | Kan hvis Nav/MobileMenu/Tabs merges med mechanical uten review. | **Får:** mechanical +2 som egen slice (15 filer). **Får:** nav-trio som egen slice etter navigasjonsreview. **Får ikke:** én «hele superadmin»-commit. |

**Ingen** underbøtte er satt til **REVERT TO HEAD** i denne omgangen: det krever egen årsak (f.eks. feil gren/merge) og er ikke bevist av diff-stat alene.

**`superadmin/system/repairs/run/route.ts`:** **ikke** vurdert her (utenfor `components/**`); forblir **HOLD OUTSIDE BASELINE NOW** per tidligere binding.

---

## D) Baseline-status (kun én)

**BASELINE ER BEDRE, MEN FORTSATT BLOKKERT**

**Begrunnelse:** Tracked `components/**` er nå **beslutningsbar som sett av bøtter**, men resten av treet inneholder fortsatt **HOLD** (uke, registrering, repairs), og flere mapper er **MUST SPLIT FURTHER**. Ingen ærlig «baseline freeze» før minst disse er håndtert eller eksplisitt utsatt.

---

## E) Neste pakke etter mechanical-slice (kun én)

Mechanical +2/0-slice er **utført**: `b29a443b402e8ddc84e4fa30ac3b995dca06d455` — se `APPLIED_TRACKED_COMPONENTS_MECHANICAL_SLICE_2026-04-09.md`.

**Navn:** **Apply tracked components site-deletion slice** (`components/site/**` — tre slettinger).

**Hvorfor:** Egen KEEP-bøtte i tabellen C; ikke blandet med +2/0; atomisk slettings-semantikk.

**Hva den lukker:** De tre gjenværende `components/site/*`-pathsa i tracked diff.

---

## F) Verifikasjon (repo-kjede, kun observasjon)

På `36000ac`: `npm run typecheck`, `npm run lint`, `npm run test:run`, `npm run build:enterprise` — **exit 0** (lint med eksisterende advarsler). Dette **beviser ikke** at en fremtidig components-commit er trygg; det bekrefter kun nåværende arbeidstree + gates på HEAD.

---

## G) Eksplisitt liste — mechanical +2/0 (eneste tillatte staging-kilde for «mechanical KEEP slice»)

**Kriterium:** `git diff --numstat -- components/` har rad `2<TAB>0<TAB><path>`.

**Antall ved apply-forberedelse:** **34** filer (tidligere omtale «35» i seksjon B er avvik fra faktisk `numstat`-telling ved HEAD — **denne listen overstyrer**).

1. `components/admin/AdminFooter.tsx`
2. `components/admin/AdminHeader.tsx`
3. `components/admin/AgreementBlock.tsx`
4. `components/admin/CompanyStatusGate.tsx`
5. `components/admin/InsightPanel.tsx`
6. `components/admin/InviteEmployeeModal.tsx`
7. `components/admin/NextDeliveryPanel.tsx`
8. `components/app/AppShell.tsx`
9. `components/audit/AuditFeed.tsx`
10. `components/kitchen/KitchenView.tsx`
11. `components/layout/AppChrome.tsx`
12. `components/orders/ReceiptBanner.tsx`
13. `components/public/RegisterGate.tsx`
14. `components/seo/IntentLinks.tsx`
15. `components/superadmin/AlertsTable.tsx`
16. `components/superadmin/AuditTable.tsx`
17. `components/superadmin/CompanyAgreement.tsx`
18. `components/superadmin/CompanyAudit.tsx`
19. `components/superadmin/CompanyDeliveries.tsx`
20. `components/superadmin/CompanyHeader.tsx`
21. `components/superadmin/CompanyQuality.tsx`
22. `components/superadmin/FirmEmployeesClient.tsx`
23. `components/superadmin/InvoicesRunsTable.tsx`
24. `components/superadmin/StatusCards.tsx`
25. `components/superadmin/SuperadminHeader.tsx`
26. `components/superadmin/SuperadminMotorClient.tsx`
27. `components/superadmin/SuperadminTopNav.tsx`
28. `components/superadmin/SuperadminTopNavInline.tsx`
29. `components/superadmin/SystemHealth.tsx`
30. `components/system/AgreementStatusBadge.tsx`
31. `components/system/SystemContextHeader.tsx`
32. `components/ui/pagination.tsx`
33. `components/ui/separator.tsx`
34. `components/ui/tooltip.tsx`
