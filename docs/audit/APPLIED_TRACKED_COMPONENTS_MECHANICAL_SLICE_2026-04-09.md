# Applied tracked diff — components mechanical +2/0 KEEP slice

**Date:** 2026-04-09  
**Decision reference:** `docs/audit/COMPONENTS_TRACKED_SPLIT_DECISION_2026-04-09.md` (seksjon **G** — eksplisitt liste)

## What was committed

| Item | Detail |
|------|--------|
| **Parent HEAD** | `36000acf03a10355fa587306a3bca97658b94109` |
| **Commit** | `b29a443b402e8ddc84e4fa30ac3b995dca06d455` |
| **Message** | `components: commit mechanical KEEP slice` |
| **Files** | **34** |
| **Insertions** | +68 (alle rader `2<TAB>0` i `git diff --cached --numstat`) |

### Paths included (exact)

Identisk med seksjon **G** i `COMPONENTS_TRACKED_SPLIT_DECISION_2026-04-09.md` (34 stier under `components/**`).

### Explicitly excluded (not in this commit)

- `components/site/**` (egen slettings-slice)
- `components/week/WeekMenuReadOnly.tsx` (**HOLD**)
- `components/registration/PublicRegistrationFlow.tsx` (**HOLD**)
- `components/layout/PageSection.tsx`
- `components/ui/toast.tsx`
- `components/seo/RelatedLinks.tsx`
- `components/orders/OrderActions.tsx`
- `components/auth/LogoutClient.tsx`, `components/auth/LoginForm.tsx` (sletting)
- `components/superadmin/SuperadminNav.tsx`, `SuperadminMobileMenu.tsx`, `SuperadminTabs.tsx` (ikke-mekanisk diff)
- Øvrig `components/**` (rot-marketing, nav, m.m.)
- `superadmin/system/repairs/run/route.ts` (utenfor `components/`, **HOLD**)
- Tracked `docs/**`, `tests/**`, `e2e/**`, `app/**`, `lib/**`

### Staging / verification

- Pathspec: `.tmp-components-slice1.txt` (UTF-8 **uten BOM**) — **slettet** etter commit.
- Staget sett = eksplisitt liste; `git diff --cached --numstat` kun `2<TAB>0` for alle rader.

### Antall avvik fra tidlig omtale «35» filer

Ved faktisk `git diff --numstat -- components/` på apply-HEAD var det **34** filer med `+2/0`. Beslutningsdokumentet er oppdatert med seksjon **G** som kanonisk liste.

## What this is not

- **Ikke** baseline freeze.
- **Ikke** full `components/**`-disposisjon (gjenstår MUST SPLIT / HOLD).

## Gates (etter commit `b29a443…`)

| Command | Result |
|--------|--------|
| `npm run typecheck` | PASS |
| `npm run lint` | PASS (eksisterende advarsler) |
| `npm run test:run` | PASS |
| `npm run build:enterprise` | PASS (exit 0) |

## Next package (single)

**Navn:** **Apply tracked components site-deletion slice** (`components/site/**` — tre slettinger, egen commit).

**Hvorfor:** KEEP besluttet for site i decision-record; ikke blandet med mechanical +2/0; reduserer fortsatt tracked diff uten å røre week/registration HOLD.

**Closes:** Historiserer de tre `components/site/*`-slettingene som egen, navngitt slice.
