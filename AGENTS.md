# LUNCHPORTALEN — AGENTS.md
**“THIS FILE IS LOCKED. EDIT ONLY BY EXPLICIT OWNER INSTRUCTION.”**  
Enterprise Command System · Commercial Excellence · System Truth

You are working on **Lunchportalen.no**  
(Stack: Next.js App Router · Supabase · Sanity)

This system is **LIVE (RC)**.  
All work is **enterprise-hardening, system integrity, and commercial dominance**.

If something is only “correct”, it is **NOT DONE**.  
It must be **correct, resilient, elegant, deterministic, and inevitable**.

---

# 0) AGENT BOOT (HARD LOCK)

## 0.1 Read-first law (MANDATORY)
Before changing ANY code:
1) Read this file: **AGENTS.md** (authoritative)
2) Identify whether the target area is **FROZEN**
3) Identify impacted flows (10 back / 10 forward)
4) Confirm the exact gate you are trying to pass:
   - `typecheck`
   - `lint`
   - `build:enterprise`
   - `sanity:live`
5) If gates are already PASS → **DO NOT propose changes**
   - No “confirm?” prompts
   - No “optional improvements”

**Violation → INVALID CHANGESET**

## 0.2 No-confirmation rule (LOCKED)
If the required commands are GREEN/PASS, the agent must:
- stop
- report “PASS”
- change nothing

Agent must NEVER ask for confirmation when the goal is already satisfied.

## 0.3 Fail-closed rule (LOCKED)
If uncertain about role, tenant scope, contracts, data presence, env/runtime, or redirects:
- block actions
- show safe read-only UI
- never guess
- never silently fallback

---

# A) OPERATING MODE (HARD LOCK)

## A0) RC STATUS (LOCKED)
Lunchportalen is in **RC (Release Candidate)** mode until explicitly promoted to **Release**.

### RC laws (LOCKED)
- **Do not regress** anything currently working
- **No speculative refactors**
- **One fix per change-set** unless issues are inseparable
- Every bugfix MUST include:
  - exact repro steps
  - expected vs actual
  - root cause
  - fix
  - verification checklist

Missing any item → **INVALID CHANGESET**

### Change-set format (MANDATORY)
Every change-set must begin with:

- Title:
- Scope:
- Repro:
- Expected:
- Actual:
- Root cause:
- Fix:
- Verification:

---

## A1) FREEZE PROTOCOL (LOCKED)

### Freeze definition
A flow is **FROZEN** when it passes:
- correct role gating
- correct navigation
- correct data isolation
- no loops
- no crashes
- mobile sanity

### Freeze rules
Frozen code may ONLY be changed if:
1) required to fix regression or security
2) change is minimal and localized
3) non-regression checklist is provided
4) impact on adjacent flows is explicitly verified

### Current frozen flows (update only by explicit instruction)

#### A1.1 Frozen: Superadmin Firma
- `/superadmin/companies`
- Route logic LOCKED
- Guards & redirects LOCKED
- Pagination LOCKED (25)
- Data contracts LOCKED
- No client-side auth checks
- No layout/header behavior changes

#### A1.2 Frozen: Admin Firma (Company Admin)
- `/admin/companies`
- Scope = `profiles.company_id` (server truth)
- No scope relaxation
- No redirect changes
- Pagination LOCKED (25 if list exists)

#### A1.3 Frozen: Superadmin System (Health)
- `/superadmin/system`
- Health aggregation logic LOCKED
- WARN ≠ OK
- DEGRADED ≠ DOWN
- Env/runtime checks are authoritative
- UI copy may clarify — logic may NOT change

#### A1.4 Frozen: Superadmin System — Flytdiagnostikk (Flowcheck)
- `/superadmin/system` → **Flytdiagnostikk**
- Flytsjekk er **system truth** (ingen grønnvasking)
- **OK / WARN / FAIL**-klassifisering er **LOCKED**
- Status-aggregering er **LOCKED**
- **RID** må alltid vises ved kjøring (sporbarhet)
- Tekst skal være **UTF-8** med korrekt norsk: **æ / ø / å**
- Flytsjekk skal aldri:
  - skjule FAIL
  - nedgradere FAIL → WARN/OK
  - anta at leveranser finnes hvis de ikke gjør det
  - introdusere client-side auth/redirect-logikk
- Tillatt etter freeze:
  - **TEXT ONLY** (språk/UTF-8/duplikater)
  - **UI ONLY** (spacing/visuell ro)
- Forbudt etter freeze:
  - endre sjekkers semantikk
  - endre datakilder/DB-kontrakter uten eksplisitt instruks
  - endre API-kontrakt `{ ok, rid, data }` / `{ ok:false, ... }`

Violation → **STOP**

#### A1.5 Frozen: Onboarding / Registration (NORWAY)
- `/onboarding`
- `POST /api/onboarding/complete` (or equivalent)
- **Norwegian phone UX is LOCKED**
  - Users enter **8 digits** (with or without spaces)
  - **No requirement** to type `+47` in UI
  - System must normalize (digits-only) deterministically
- **Validation behavior is LOCKED**
  - Phone validation errors must return **422** with clear message/field
  - Validation errors must **never** return 500
  - No partial writes: **all-or-nothing**
- **No scope creep**
  - No new fields
  - No new business rules
  - No refactors
- Allowed after freeze:
  - **TEXT ONLY** / **UI ONLY** improvements
- Forbidden after freeze:
  - changing onboarding data contracts
  - altering auth/role flow
  - changing DB schema without explicit instruction

Violation → **STOP**

---

# B) WOW REVIEW (LOCKED)

## B2) WOW REVIEW

### WOW bar
UI must feel:
- expensive
- calm
- predictable
- years ahead
- self-explanatory

If UI needs explanation → **FAIL**  
If system guesses → **FAIL**  
If data can leak → **FAIL**

### 1–3–1 RULE (LOCKED)
Each view must contain:
- **1** H1
- **3** meaningful signals (status / KPI / list)
- **1** primary action

More → **FAIL**

---

# C) NON-NEGOTIABLE ENTERPRISE LAW

## C3) ENTERPRISE LAW (LOCKED)
These rules override speed, convenience, and shortcuts.

- **Avensia-level quality — no exceptions**
- **Single source of truth**
  - server-side `profiles.company_id` (+ `location_id` where relevant)
- **Fail-closed everywhere**
  - If uncertain → block actions, show safe read-only UI
- **Zero cross-company leakage**
  - Never trust client-sent `company_id`
  - Every query MUST filter by `company_id` (and `location_id`)
- **API contract (LOCKED)**
  - Success: `{ ok: true, rid, data }`
  - Error: `{ ok: false, rid, error, message, status }`
- **Idempotent by default**
- **No silent fallbacks**
- **No new product features outside scope**

All changes must pass:
- `build:enterprise`
- `typecheck`
- `lint`
- `sanity:live`
- required tests

Violation → **INVALID IMPLEMENTATION**

---

# D) SECURITY & TENANT ISOLATION (LOCKED)

## D4) SECURITY & TENANT ISOLATION

### Strict role model
- `superadmin` → full system access
- `company_admin` → own company only
- `employee` → own orders + week view
- `driver` → driver tools only
- `kitchen` → tenant-bound production only (read-only)

**No role confusion. Ever.**

### Gate rules (LOCKED)
- Server-side role guard in layouts (NOT client)
- Middleware gates unauthenticated access only
- Middleware never decides role landing
- No client “session guess” redirects

### Required tests (LOCKED)
- Company A never sees Company B
- Company admin sees only own agreement & staff
- Kitchen output never mixes tenants
- Driver output never mixes tenants

---

# E) AUTH & REDIRECT TRUTH (LOCKED)

## E5) AUTH & REDIRECT TRUTH

### One canonical post-login resolver (LOCKED)
Landing resolved server-side:
`/api/auth/post-login?next=...`

### next allowlist (LOCKED)
- superadmin → `/superadmin*`
- company_admin → `/admin*`
- employee → `/orders*`, `/week*`
- kitchen → `/kitchen*`
- driver → `/driver*`

### HARD STOP: Login loops (LOCKED)
- `/login` must never redirect to `/login`
- `next` must never point to `/login`
- middleware must never gate `/api/*` or `/login`
- header must never redirect

---

# F) UI SYSTEM (LOCKED)

## F6) UI SYSTEM

### Visual intent
- Calm base: white / warm cream
- Strong hierarchy
- ONE accent only: **HOT PINK**
- No clutter
- No “admin-tool look”

### Hot pink rules (LOCKED)
Allowed ONLY:
- hover glow
- focus ring
- active underline
- micro-highlight on ONE primary action

Forbidden:
- large backgrounds
- body text
- multiple CTAs

Exactly ONE primary action may carry hot-pink effects.

---

# G) LAYOUT LAW (LOCKED)

## G7) LAYOUT LAW

### Admin views
- Max width: **1440px**
- Airy rhythm
- Calm cards
- Tables breathe
- No nested card chaos

### Auth views
- Full-bleed immersive mode
- Centered premium card
- No admin layout bleed-through

Admin ≠ Auth. Never mix.

---

# H) LOCKED UI PRIMITIVE — CANONICAL HEADER (FASIT)

## H8) CANONICAL HEADER (LOCKED)

### Canonical definition
- Exactly **ONE** header implementation (ONE shell)
- Reused across all admin/role pages
- Only `tabs`, `email/name`, `areaLabel` vary
- Role determines visible tabs (no cross-role buttons)

### Mandatory primitives
- `components/nav/HeaderShell.tsx` (SERVER)
- `components/nav/RoleTabs.tsx` (CLIENT)
- `components/nav/MobileMenu.tsx` (CLIENT)
- `components/auth/LogoutClient.tsx` (CLIENT)

### Layout law (NON-NEGOTIABLE)
True centering:
- `grid-cols-[1fr_auto_1fr]`
- Left: `justify-self-start`
- Center: `justify-self-center`
- Right: `justify-self-end`
- Tabs: `inline-flex` (never `w-full`)

### Pill law
```ts
const pill = "rounded-full border px-3 py-1 text-sm";

Email pill uses pill
Logout uses pill (exact same size)

Mobile law

< md: tabs hidden, hamburger visible

Dropdown closes on select / outside / Escape

Touch targets ≥ 44px

Header behavior (LOCKED)

Display-only:

No redirects

No getSession() checks

No auth logic

Header → Content gap (LOCKED)

EXACT visual gap: 7mm ≈ 27px
Applied at admin shell wrapper
Required class: pt-[27px]
No per-page spacing hacks

Any deviation → INVALID IMPLEMENTATION

I) TEXT & LANGUAGE LAW (LOCKED)
I9) TEXT & LANGUAGE LAW

One H1 per view

No duplicated headings or labels

Norwegian correctness

Correct UTF-8: æ, ø, å
Mojibake forbidden: Ã, Â, â†’ → FAIL

Use:

“Søk”

“Åpne”

“Aktivér” (é if used)

Encoding rule

All source files UTF-8
Prefer literal UTF-8 over escaped sequences

Violation → INVALID

J) CHANGE CONTROL (LOCKED)
J10) CHANGE CONTROL — “10 BACK · 10 FORWARD”

Before implementing:

Map existing architecture & contracts

Identify affected flows/modules

Verify no breakage of:

role model

tenant isolation

API contracts

date truth

UI law

After implementing:

Scales

Reusable

Future-ready

No hacks

Signals correctness

Do NOT break frozen flows

K) CI / RELEASE GATE (LOCKED)
K11) CI / RELEASE GATE

A change is DONE only when:

build:enterprise passes

typecheck passes

lint passes

sanity:live passes

required tests pass

no TODO / FIXME

no silent fallbacks

no UI regressions

mobile flawless

no loops

no cross-tenant leakage

Fail → STOP AND FIX

Mandatory RC command sequence (LOCKED)

Run in this order:

npm run typecheck

npm run lint

npm run build:enterprise

If all PASS and goal is satisfied → STOP (no changes).

L) DEBUGGING STANDARD (LOCKED)
L12) DEBUGGING STANDARD

Capture server logs

Capture full URL chain (incl. next)

Identify redirect source: middleware vs server vs client

Eliminate client-side auth redirects first

Normalize .map() targets:

Array.isArray(x) ? x : []

Fail closed — never guess

M) LOCKED FILE POLICY (RC SAFE)
M13) LOCKED FILE POLICY

High-risk files require explicit justification:

middleware.ts

/api/auth/post-login

/login

admin & superadmin layout guards

canonical header primitives

frozen flow files

Edits require:

minimal diff

explicit reasoning

non-regression checklist

proof of no impact on frozen flows

Shared normalization utilities (LOCKED)

lib/phone/no.ts is the single place for Norwegian phone normalization.
No duplicate phone logic elsewhere.

N) RUNTIME / ENV TRUTH (LOCKED)
N14) RUNTIME ENV LAW

Required runtime env:

SYSTEM_MOTOR_SECRET

Missing env ⇒

Health: WARN or FAIL

System status: DEGRADED or DOWN

Repairs that require env must be blocked.

Restart law

Env changes require process restart or redeploy.

Verification

/superadmin/system must show:

“Env / runtime config OK”

“Ingen degraderingsårsaker”

Status: NORMAL

Secrets must never be logged or exposed.

O) PROMPT BLOCKS (LOCKED)
O15) PROMPT BLOCKS
O15.1 UI ONLY

UI ONLY.
Do NOT change middleware, auth, guards, redirects, API routes, data fetches, or page logic.

O15.2 TEXT ONLY

TEXT ONLY.
Change string literals only. Ensure correct Norwegian UTF-8.

O15.3 NO LOGIN LOOP

Ensure:

/login never redirects to /login

next never points to /login

middleware does not gate /api or /login

no client redirects based on getSession()

O15.4 API CONTRACT ENFORCEMENT

All API responses MUST match the locked contract.

O15.5 FAIL-CLOSED

If uncertain → block actions, show safe read-only UI.

P) COMPANY LIFECYCLE (FROZEN) — RC SAFE
P16) FROZEN: Company Lifecycle A–I (LOCKED)

This project includes a frozen enterprise lifecycle:

Archive (kill access) + history

Restore (without users)

Audit events

Invoice basis (readonly)

ESG summary (readonly)

Incidents logging (if present)

All related files/routes are FROZEN unless explicitly stated:

app/superadmin/companies/**

app/api/superadmin/companies/**

docs/rc/company-archive-rc.md

docs/rc/company-lifecycle-rc.md

Frozen changes allowed ONLY for:

regression/security

minimal localized diff

explicit non-regression checklist

verified impact on adjacent flows

Q) ENTERPRISE ROADMAP SCOPE (K1–K4) — ALLOWED WORK AFTER FREEZE
Q17) Allowed scope (LOCKED)

Allowed without new approval:

K1: Enterprise groups / multi-location governance

K2: CFO dashboard (readonly, performance-safe)

K3: Observability v1 (incidents + audit wiring)

K4: Documentation pack (technical/security overview + SSO roadmap + commercial one-pager)

No marketplace. No employee-economy. No feature-bloat.

R) FINAL INSTRUCTION (HARD STOP)
R18) FINAL INSTRUCTION

Do not patch.
Do not compromise.
Do not simplify.

Build something competitors envy.
Build something that feels inevitable.

S) IMMUTABLE PRODUCTION RULES (HARD LOCK)
S1) MOBILE + BRAND + SEO/CRO IMMUTABLE RULES (PRODUCTION)

Mobile must NEVER allow horizontal scrolling.

All content must be full width on mobile.

No element may render outside viewport on mobile.

Logout and primary actions must always be visible.

Login must redirect instantly and deterministically without refresh loops.

Buttons must maintain readable contrast in all states.

Hero image and logo must be mobile-safe and non-overflowing.

Copy must follow calm, warm, professional style.

SEO and CRO must remain 10/10, especially the front page.

Any change violating these rules is a BLOCKING DEFECT.

S1.1) Mobile super-optimization (LOCKED) — Forside + Week

Forside (/) og Week (/week) er mobil-kritiske og skal være superoptimalisert for:

iPhone (iOS Safari)

Android (Chrome)

Dette er production law.

Absolutte krav (BLOCKING ved brudd):

0 horisontal scroll (alltid)

Ingen viewport overflow, heller ikke ved:

lange ord / e-post / firmalogo

tabeller/lister

knapper i header

Touch targets ≥ 44px (alle primærinteraksjoner)

All tekst og CTA lesbar uten zoom (minst 16px body)

Ingen layout shift ved first paint (logo/hero stabilt)

Performance: rask first paint, ingen scroll-jank

Keyboard-safe (iOS/Android):

inputfelt må ikke hoppe ut av viewport

primærknapp må være tilgjengelig når tastatur er oppe

Week må være scannbar med én hånd:

tydelig status

én primær handling

ingen tettpakket UI

Minimum testmatrise (MÅ verifiseres før DONE):

iPhone (iOS Safari): 375×812 og 390×844

Android (Chrome): 360×800 og 412×915

Test både: ikke innlogget + employee + admin (dersom header shell vises)

Brudd på S1.1 → BLOCKING DEFECT (STOP THE LINE)

S1.2) Mobile alignment law (LOCKED) — Alt innhold midtstilles

Alt innhold på mobil (iPhone Safari og Android Chrome) skal være visuelt og strukturelt midtstilt.

Gjelder spesielt:

Forside (/)

Week (/week)

Onboarding

Login

Alle employee-visninger

Midtstillingskrav (BLOCKING ved brudd):

Hovedcontainer: mx-auto + balansert horisontal padding (min px-4)

Ingen elementer skal “henge” til venstre/høyre uten bevisst designvalg

H1, primær KPI og primær handling skal være visuelt sentrert

Cards skal være symmetrisk plassert med lik luft på begge sider

Tabell-lignende lister på mobil skal:

stackes vertikalt

være sentrert

aldri brekke layout

Forbudt:

Desktop left-align layout som bare “skaleres ned”

Negative margins for å “fikse” mobil

Manuell px-justering per side

Innhold som ser forskjøvet/asymmetrisk ut

Testkrav:

iPhone 390px bredde

Android 360px bredde

Ingen visuell ubalanse, ingen asymmetrisk whitespace, ingen clipping

Brudd på S1.2 → BLOCKING DEFECT

S2) ONBOARDING & REGISTRATION CRO IMMUTABLE RULES

Onboarding must be mobile-first and distraction-free.

One primary action per screen.

Copy must be calm, warm and professional.

Expectations must be clear before registration is completed.

No sidewise scroll or offscreen elements are allowed.

Conversion clarity is more important than feature explanation.

Any change violating these rules is a BLOCKING DEFECT.

S3) KITCHEN & OPERATIONS IMMUTABLE RULES

Kitchen view is read-only and represents system truth.

No manual overrides or exceptions are allowed.

Orders are grouped deterministically by date, slot, company and location.

Totals must always be visible and correct.

UI must be scannable under time pressure.

Mobile and desktop must both be production-safe.

Any change violating these rules is a BLOCKING DEFECT.

S4) DRIVER & DELIVERY IMMUTABLE RULES

Driver view is mobile-first and must never allow horizontal scroll.

Stops are grouped and ordered deterministically (date → slot → company → location).

Each stop must show address, window/slot, contact and contents summary.

Delivery actions (if present) must be explicit, traceable and idempotent.

No manual exceptions or hidden overrides.

UI must be scannable under time pressure with one-hand use.

Any change violating these rules is a BLOCKING DEFECT.

S5) ADMIN INSIGHTS & ROI IMMUTABLE RULES

Reports must show real, traceable numbers only.

No vanity metrics or decorative charts.

Insights must be understandable in under 10 seconds.

Calm, enterprise tone is mandatory.

Mobile and desktop must both be readable without zoom.

Reports are read-only and reflect system truth.

Any change violating these rules is a BLOCKING DEFECT.

S6) TYPOGRAPHY IMMUTABLE RULES (PRODUCTION)

Headings (H1–H4 and title/heading classes) must use Inter for enterprise clarity.

Decorative or character-heavy display fonts are forbidden for headings.

Letterforms must remain neutral, readable, professional.

Body text font must remain unchanged unless explicitly approved as a separate change.

Any change violating these rules is a BLOCKING DEFECT.

S7) COMMERCIAL & SALES IMMUTABLE RULES

Lunchportalen selges på kontroll, forutsigbarhet og mindre administrasjon.

Ingen hype, buzzwords eller urealistiske løfter er tillatt.

Salgsbudskap skal alltid reflektere faktisk systematferd.

Tone skal være rolig, varm og profesjonell.

Beslutningstakere skal forstå verdien på under 10 sekunder.

Endringer som bryter disse reglene er BLOCKING DEFECTS.

S8) PASSWORD RESET IMMUTABLE RULES

Passord tilbakestilles kun via «Glemt passord».

Ingen admin-resetter eller manuelle inngrep er tillatt.

Reset skjer via tidsbegrenset engangslenke (mål: 30 minutter).

Samme bekreftelsestekst vises uansett om e-post finnes (ingen brukerenumerering).

Lenker skal være single-use (ny forespørsel erstatter gammel).

Systemet er én sannhetskilde. Brudd på dette er en BLOCKING DEFECT.

S9) BRAND ASSET IMMUTABLE RULES

Official Lunchportalen logo must be rendered from /public/brand.

Placeholder text-only logos are forbidden in production header.

Favicon + app icons must be wired via Next metadata conventions and must not regress.

Brand assets must never introduce layout shift or horizontal scroll.

Any change violating these rules is a BLOCKING DEFECT.

S10) LOGO IMMUTABLE RULE (PRODUCTION)

Lunchportalen logo must be rendered as an image in the header on all pages.

Text-only branding in production headers is forbidden.

Logo must use /public/brand assets and must never cause overflow or layout shift.

Any change violating this is a BLOCKING DEFECT.

S11) HEADER LOGO IMMUTABLE RULES

Header must contain exactly ONE brand element: the logo image.

Text-based logos are forbidden in production.

Logo asset must be /public/brand/LP-logo-uten-bakgrunn.png.

Logo height is locked to 64px (mobile) and 120px (desktop).

Logo must always link to "/" (home).

Any overflow/layout shift is a BLOCKING DEFECT.