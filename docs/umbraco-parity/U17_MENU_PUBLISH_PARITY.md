# U17 — Menu / publish parity

**U17 DEEP (2026-03-29):** `BackofficeExtensionContextStrip` på `/backoffice/week-menu` viser modulposture + styringssignal fra `week_menu` domain surface (lesing — ingen ny publish-motor).

**Arbeidsstrøm 2** — mål: Umbraco-lignende publish-*opplevelse* for uke/meny **uten ny menymotor**.

## Kilde-sannhet (uendret)

| Spor | Rolle | Merknad |
|------|-------|---------|
| **Operativ meny** | `menuContent` / Sanity-broker kjede | Kilde for det kunder ser i ukevisning når publisert |
| **Redaksjonell ukeplan** | `weekPlan` | Redaksjonelt — kan være **LIMITED** vs operativ uke; ikke dobbel sannhet som «to menyer» |

## Hva CMS skal formidle

1. **Hvem eier publisering** av operativ meny — eksplisitt handling (broker/Studio der relevant).
2. **Preview vs published** — samme *forståelse* i språk (ikke nødvendigvis samme tekniske render-motor).
3. **Hvem påvirkes** — bedrifter/lokasjoner via eksisterende modell — ikke nye tabeller.

## Repo-bevis

- `app/(backoffice)/backoffice/week-menu/page.tsx` — surface + notiser (CP11).
- `CP11_PUBLISH_HISTORY_ROLLBACK_DECISION.md`, `CP11_UNIFIED_WORKSPACE_MODEL.md`.

## Gap

- Full «native» publish-knapp som **kun** Sanity Studio kan utføre → handoff må fortsatt være **ærlig** (Studio vs LP-UI).

## U17-handling

**Dokumentasjon og konsistens** — ingen ny menykilde, ingen mutasjon av operativ pipeline i U17.
