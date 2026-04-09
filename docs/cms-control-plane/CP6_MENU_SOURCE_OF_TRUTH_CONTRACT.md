# CP6 — Menu source of truth contract

## Operativ menykilde

**Sanity `menu` / `menuContent`** forblir **source of truth** for det API-et konsumerer — **ingen** ny tabell i Lunchportalen.

## weekPlan

**Editorial-only** mht. employee order — vises som amber/separate spor i UI.

## Skjermer som viser weekPlan

- Sanity Studio Ukeplan-tool.
- Backoffice tekst om editorial — **ikke** som operativ bestillingskilde.

## Merking

- Operativ kjede: **grønn/nummerert orkestrering** + handoff.
- weekPlan: **LIMITED** i modulregister + amber panel.

## Produktforvirring

- Én operativ kjede dokumentert på `/backoffice/week-menu`; weekPlan beskrives eksplisitt som **ikke** `GET /api/week`.
