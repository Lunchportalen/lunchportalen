## Summary

- Re-layout `/leverandor/meny` to match `2-leverandor-editor-slutt.html`: horizontal top nav shell (1280px wrap), tier lens + priceline, light status strip, 5-column day cards, dual side-by-side panels (varmrett + katalog).
- Tier lens reframes priceline and hides premium rows on Basis; Enterprise-upgrade row only on Enterprise tier.
- Economy panel shows tier ex − råvarekost − Lunchportalen 5% = margin per porsjon (**display-only** in `ProviderMenuEditorPanel.tsx`).
- Presentation-only: existing Sanity varmrett/kost/badges, Supabase lock/counts, catalog COW, and API wiring unchanged.

## Golden Path (A — urørt)

**Detector:** `scripts/ci/guard-protected-golden-path.mjs` (`npm run ci:protected-path-guard:test`)

**Vokter (prefix-liste):** `app/api/orders/**`, `app/api/order/**`, `app/api/week/**`, `lib/orders/**`, `lib/providers/kitchenOrderStatus.ts`, `lib/admin/orderStatus.ts`, `KitchenOrderCard.tsx`, `app/leverandor/ordrer/**`, menu-publish sync paths, cutoff/agreement/auth guards, active `supabase/migrations/*.sql`.

**PR #285 diff:** 0 beskyttede filer (`protected-golden-path-guard touched=0` på head).

**5% økonomi:** Kalkyl `ex·0.05` og margin-visning lever **kun** i `ProviderMenuEditorPanel` (panel layout). Ingen endring i `computeMarginEstimate`, billing, `lp_order_set`, Tripletex eller ordre-write.

## Provider Meny Visual (B — gate kjører)

| Bevis | Detalj |
|-------|--------|
| Job kjørte | `provider-meny-visual` workflow **ikke** passthrough-skipped på PR (run 27913314388 — full job, ikke `detect` skip) |
| Path-filter fix | `ProviderMenyEditorShell.tsx` lagt til i `ci-provider-meny-visual.yml` + `required-check-path-patterns.mjs` (`ProviderMeny*` + `ProviderMenu*`) |
| Baselines | Regenerert på **Linux** (`mcr.microsoft.com/playwright:v1.58.2-noble`, workflow_dispatch `update_snapshots=true`, run 27914016628) |
| Determinisme | Stub `GET /api/provider/menu-days` + hardcoded Sanity `staging` (ingen prod-Sanity) |

**Baseline-filer:** `e2e/provider-meny-visual-regression.e2e.ts-snapshots/provider-meny-desktop/*.png` (Linux-rendered)

## Test plan

- [x] `npm run typecheck`
- [x] `npm run lint`
- [x] `npm run test:run` (preflight on push)
- [x] `npm run ci:protected-path-guard:test`
- [x] `node scripts/ci/verify-required-check-path-drift.mjs`
- [x] Linux baseline regeneration (workflow_dispatch)
- [ ] CI green on head: `provider-meny-visual`, `build`, `e2e`, `agents_gate`
- [ ] Manual: tier lens Basis/Luxus/Enterprise premium visibility
- [ ] Manual: locked day lockbar + «Se dag»
- [ ] Mobile 360px: no horizontal scroll, 48px touch
