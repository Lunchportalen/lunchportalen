# Brand Logo + Favicon Fix

## Files changed
- `components/layout/AppChrome.tsx`
- `app/layout.tsx`
- `AGENTS.md`
- `docs/reports/brand-logo-favicon-fix.md`

## What was wired
- Header logo: `components/layout/AppChrome.tsx` now renders `/brand/lunchportalen-logo.svg` with fixed dimensions and responsive sizing.
- Metadata icons: `app/layout.tsx` now includes favicon, 16x16, 32x32, Apple touch icon, and manifest link.

## Verification checklist
- Desktop: logo visible in header; favicon visible in tab.
- Mobile Safari: logo visible; no horizontal scroll; apple-touch icon set.
- Android Chrome: app icon resolved from manifest.
