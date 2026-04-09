# Applied tracked diff — `components/site/**` deletion KEEP slice

**Date:** 2026-04-09  
**Decision reference:** `docs/audit/COMPONENTS_TRACKED_SPLIT_DECISION_2026-04-09.md` (`components/site/**` = **KEEP IN BASELINE PATH NOW**, tre rene slettinger)

## What was committed

| Item | Detail |
|------|--------|
| **Parent HEAD** | `0be26c74d557302877680b67e960ccfb12060bf2` |
| **Commit** | `5d559861ded7e7964798fcf4779d97be9869b692` |
| **Message** | `components/site: commit tracked deletion slice` |
| **Change** | **3** filer slettet fra repo (`451` linjer fjernet) |

### Paths included (exact)

- `components/site/AdminHeader.tsx`
- `components/site/AdminHeaderClient.tsx`
- `components/site/PublicHeader.tsx`

### Explicitly excluded (not in this commit)

- Alle andre `components/**`-filer (week, registration, layout, ui/toast, seo/RelatedLinks, orders/OrderActions, auth, superadmin-nav/trio, rot-marketing, m.m.)
- `superadmin/system/repairs/run/route.ts` (utenfor `components/`, **HOLD**)
- Tracked `docs/**`, `tests/**`, `e2e/**`, `app/**`, `lib/**`

### Staging / verification

- `git add -u --` kun de tre pathene; `git diff --cached --name-status` kun `D` for hver.
- Ingen pathspec-fil etter behov (tre eksplisitte stier).

## What this is not

- **Ikke** baseline freeze.
- **Ikke** mechanical +2/0-slice (allerede historisert).
- **Ikke** løsning på HOLD (week/registration) eller MUST SPLIT-flater.

## Gates (etter commit `5d55986…`)

| Command | Result |
|--------|--------|
| `npm run typecheck` | PASS |
| `npm run lint` | PASS (eksisterende advarsler) |
| `npm run test:run` | PASS |
| `npm run build:enterprise` | PASS (exit 0) |

## Next package (single)

**Navn:** **Apply tracked components superadmin Nav/MobileMenu/Tabs slice** (tre filer med reell navigasjonsendring, ikke +2/0).

**Hvorfor:** `components/superadmin/**` er **MUST SPLIT FURTHER**; mechanical +2/0 er allerede committet; site-slettinger er nå historisert — naturlig neste isolerbare bøtte er nav-trio før større rot-/auth-flater.

**Closes:** Historiserer de tre `SuperadminNav` / `SuperadminMobileMenu` / `SuperadminTabs`-diffene som én navngitt slice (egen pathspec-verifisering).
