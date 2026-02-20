# Kitchen / Operations WOW Pass

## Files Changed
- app/kitchen/page.tsx
- app/kitchen/KitchenView.tsx
- components/superadmin/OperationsToday.tsx
- AGENTS.md

## What Was Improved
- Kitchen view hierarchy rebuilt for date → window → company → location → orders.
- Added clear status signal, principle text, and RID display in kitchen view.
- Added visible totals per window, company, and location.
- Notes now wrap safely with zero overflow; cards are calmer and more scannable.
- Operations view header aligned with production tone and clearer totals.

## Daily Production Checklist
- Date and status visible at top
- Grouping order is deterministic and clear
- Totals visible for window, company, and location
- Notes never hide other data or overflow
- Mobile view readable without zoom or sideways scroll
- Desktop view scannable in under 10 seconds
