# Typography: Heading Inter Fix

## Files Changed
- app/layout.tsx
- app/globals.css
- AGENTS.md

## What Changed
- Added Inter (headings only) via next/font and exposed as `--lp-font-heading`.
- Applied Inter to H1–H4 and heading classes (`.lp-h1`, `.lp-h2`) with safe wrapping.
- Body font left unchanged.

## Verification Checklist
- iPhone Safari: no horizontal scroll; headings wrap correctly
- Desktop: headings look calm; F/J letterforms are clean
- Key pages verified: front page, login, admin, kitchen, driver, insights
