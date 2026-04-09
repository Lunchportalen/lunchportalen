# CP7 — Execution plan

**Fase:** CP7 Native CMS menu publish + action routing closure  
**Status:** Utført (dokumentasjon + begrenset kode)  
**Dato:** 2026-03-29

## Mål

- Flytte fra «CMS-led med betingelser» til **native in-CMS publish control** for operativ meny (`menuContent`), uten ny menymotor og uten dobbel sannhet.
- Bevare **operativ runtime-sannhet** i Supabase for ordre/avtale; **Sanity** for publisert menyinnhold.
- Utvide **action routing** og **kontekst** i eksisterende control plane (ingen parallelle systemer).

## Leserekkefølge (repo)

1. `docs/cms-control-plane/CP6_*` og `CMS_OPERATIONAL_PUBLISH_CHAIN_RUNTIME_CP6.md`
2. `app/api/week/route.ts`, `lib/cms/menuContent.ts`, `lib/sanity/queries.ts`
3. `components/cms/control-plane/CmsWeekMenuPublishOrchestrator.tsx`
4. `lib/cms/controlPlaneDomainActionSurfaces.ts`

## Leveranser (arbeidsstrømmer)

| WS | Beskrivelse | Dokument |
|----|-------------|----------|
| 1 | Native menu publish | `CMS_NATIVE_MENU_PUBLISH_CONTROL.md`, `CMS_MENU_PUBLISH_SAFETY.md` |
| 2 | weekPlan containment | `CMS_WEEKPLAN_CONTAINMENT_RUNTIME.md` |
| 3 | Company / agreement / location routing | `CMS_COMPANY_AGREEMENT_LOCATION_ACTION_ROUTING_CP7.md` |
| 4 | Control towers | `CMS_CONTROL_TOWERS_CONTEXTUALIZATION_CP7.md` |
| 5 | Growth honesty | `CMS_GROWTH_MODULE_HONESTY_CP7.md` |
| 6 | Enterprise hardening | `CMS_ENTERPRISE_HARDENING_CP7.md` |
| 7 | Verifikasjon | `CMS_CONTROL_PLANE_VERIFICATION.md` |

## Kode (CP7)

- `lib/sanity/menuContentPublishOps.ts` — Sanity Actions `document.publish` for `menuContent` draft per dato.
- `app/api/backoffice/sanity/menu-content/publish/route.ts` — superadmin + `SANITY_WRITE_TOKEN` gate.
- `components/cms/control-plane/CmsMenuContentNativePublishPanel.tsx` — UI på `/backoffice/week-menu`.
- Oppdatert `CmsWeekMenuPublishOrchestrator.tsx`.

## Stoppregler

- Ingen ny produktfase; ingen v2/v3-filer; ingen auth/onboarding/ordre-motor endret utover trygg CMS-broker.
