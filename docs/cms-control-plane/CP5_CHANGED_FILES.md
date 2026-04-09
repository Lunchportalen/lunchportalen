# CP5 — Changed files

**Dato:** 2026-03-29

## Kode

| Fil | Hvorfor |
|-----|---------|
| `lib/cms/operationalWeekMenuPublishChain.ts` | Kanonisk operativ publish-kjede (data for UI + tester) |
| `components/cms/control-plane/CmsOperationalPublishChain.tsx` | Numnerert kjede med Studio-handling |
| `lib/cms/controlPlaneDomainActionSurfaces.ts` | `actionRouting` (les/skriv/publish/påvirker) |
| `components/cms/control-plane/CmsDomainActionSurfaceCard.tsx` | Viser `actionRouting` |
| `app/.../week-menu/page.tsx` | Inkluderer operativ publish-kjede |
| `components/cms/control-plane/CmsGrowthModuleCallout.tsx` | Felles growth-banner (SEO/social/ESG) |
| `app/.../seo-growth/page.tsx`, `social/page.tsx`, `esg/page.tsx` | Callout øverst |
| `tests/cms/operationalWeekMenuPublishChain.test.ts` | Kjedelengde + Studio-steg |

## Dokumentasjon

- `docs/cms-control-plane/CP5_*.md` + arbeidsstrøm-MD + `CMS_CONTROL_PLANE_VERIFICATION.md` (CP5)
