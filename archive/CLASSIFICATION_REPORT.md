# Dead file classification (audit snapshot)

- Generated: 2026-03-21 (see git history for exact run)
- Source: `dead-files.json` from `audit-v4.cjs` (199 paths)

## Policy

- **KEEP**: Wire into the live import graph (routes, APIs, workspace, canonical shell). Comment only; file stays in place.
- **ARCHIVE**: Moved under `/archive` with the same relative path. **Not** type-checked (`tsconfig.json` excludes `archive/**`).
- **DELETE**: Safe removal candidates (duplicate or unused alternate). **Not** deleted by the script — manual follow-up.

## Important correction

Initial run moved `lib/ai/**` and related `lib/*` into `archive/`, which **broke** production code that uses **dynamic** `import("@/lib/ai/...")` (not visible in the static audit graph). Those modules were **restored** to `lib/**` and re-labelled `// STATUS: KEEP`.

## Counts (final)

| Category | Count |
|----------|-------|
| **KEEP** | 176 |
| **ARCHIVE** | 20 |
| **DELETE** | 3 |

## Archived paths (under `/archive`)

- `app/(backoffice)/backoffice/content/ContentPageClient.tsx`
- `app/(backoffice)/backoffice/_shell/BackofficeTenantsContext.tsx`
- `app/(backoffice)/backoffice/_shell/ModulesRail.tsx`
- `app/(backoffice)/backoffice/_shell/panelHeaderClasses.ts`
- `app/(public)/registrering/components/CreateCompanyForm.tsx`
- `app/today/todayClient.tsx`
- `app/today/TodayView.tsx`
- `components/AppHeader.tsx`
- `components/Control.tsx`
- `components/FAQ.tsx`
- `components/FinalCTA.tsx`
- `components/HowItWorks.tsx`
- `components/Pricing.tsx`
- `components/Problem.tsx`
- `components/PublicHeader.tsx`
- `components/Solution.tsx`
- `components/Sustainability.tsx`
- `components/site/AdminHeader.tsx`
- `components/site/AdminHeaderClient.tsx`
- `components/site/PublicHeader.tsx`

## DELETE candidates (still in tree; remove after review)

- `app/(auth)/login/loginClient.tsx`
- `components/auth/LoginForm.tsx`
- `lib/grouping.ts`
