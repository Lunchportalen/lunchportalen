# Header Logo Correction + Hero Dedup

## Files changed
- `components/Hero.tsx`
- `components/AppHeader.tsx`
- `components/layout/AppChrome.tsx`
- `lib/admin/constants.ts`
- `docs/reports/logo-correct-and-dedup.md`

## What changed
- Removed the hero logo element above the H1 so only the header logo remains on the front page.
- Switched header logo sources to `/brand/LP-logo-uten-bakgrunn.png` for public and admin headers.
- Removed header text logo elements so only the image remains.
- Set header logo size to 24px on mobile and 32px on desktop.
- AppHeader now renders only the logo image with `h-12 md:h-[70px] w-auto max-h-[70px] object-contain`.
- Final header logo size locked: 48px mobile / 70px desktop.

## Verification checklist
- Desktop: only header logo visible; hero has no logo.
- Mobile: same; no horizontal scroll.
