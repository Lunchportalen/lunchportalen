# CMS — Week / menu governance (runtime)

**CP4:** Én eksplisitt **operativ** kjede dokumentert i UI (`CmsWeekMenuPublishControlsPanel`, `CmsWeekRuntimeStatusPanel`, `/backoffice/week-menu`).

## Operativ kjede

1. DB: aktiv avtale (`company_current_agreement`) + leveringsregler.
2. Sanity: `menu` / `menuContent` konsumert av `GET /api/week`.
3. **Ikke** Sanity `weekPlan` for ansatt-bestilling.

## Governance uten ny motor

- Studio-lenker for menykilde og editorial weekPlan.
- Ingen duplikat tabell i Postgres for menytekst.

Se `CP4_WEEK_MENU_GOVERNANCE_CONTRACT.md`.
