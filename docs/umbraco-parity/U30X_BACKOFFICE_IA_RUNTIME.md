# U30X — Backoffice IA runtime

## Endringer

- **Kontekst-strip:** Mindre padding og tekst — skiller seg tydeligere fra `TopBar` uten ny komponent.
- **Inspektør:** `RightPanel` bruker label «Inspektør» (faner: Egenskaper, AI, SEO, …).

## Uendret (kanon)

- `lib/cms/backofficeExtensionRegistry.ts` — fortsatt en sann navigasjons-/manifest-liste.
- `TopBar` — seksjons-`select` + modulrad (U29-mønster).

## Anbefalt neste steg (ikke U30X)

- Valgfri «footer»-sone for status (samle lagring/publiser-footer) — krever designgjennomgang.
