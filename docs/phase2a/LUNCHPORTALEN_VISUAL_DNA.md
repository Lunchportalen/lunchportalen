# Lunchportalen CMS — Visual DNA (V3)

## Blend (intent)

| Share | Role |
|-------|------|
| **70%** | Ro nordisk clarity — luft, lesbarhet, forutsigbarhet |
| **20%** | Glass / polished depth — toppfelt, paneler, flytende verktøy |
| **10%** | Leken energi — **neon rosa** som kontrollert aksent |

## Base surfaces

- **Lys bakgrunn:** `rgb(var(--lp-bg))`, `rgb(var(--lp-surface-alt))`, `rgb(var(--lp-card))` — ikke nye parallelle paletter.
- **Mørk chrome:** `rgb(var(--lp-chrome-bg))` for backoffice top bar (tidligere «rå slate»).
- **Blekk / plum:** `--lp-ink-plum` dokumentert som alias for dyp tekst/aksent (ikke dominerende flater).

## Glass rule

- **Bruk glass** (`backdrop-blur`, `bg-white/70`, tynn border) på: top bar, CMS-design targeting-bar, AI-introkort, flytende verktøy.
- **Ikke glass** på: tunge tabeller, lange tekstfelt, kritiske driftsoversikter der kontrast må være maksimal.

## Neon rosa (accent)

- **Tillatt:** `focus-visible`, aktiv fane-understrek, primær mikro-interaksjon, AI-highlight-kort (subtil border `ring-pink-* / border-pink-*`).
- **Forbudt:** store bakgrunner, tabellrader, brødtekst, dominerende paneler.

## Typografi

- **Headings:** Inter / `font-display` der allerede definert i `designContract` + `globals.css` — ikke introdusere nye fontfamilier i denne fasen.
- **Body:** uendret stack; hierarki styres via `typography` tokens (`default` / `display` / `compact`).

## Hover / motion

- Korte overganger (`transition`, `duration-150/200`), diskrete løft (`hover:-translate-y-px`), ingen seig glow eller «dribbble»-overhead.

## Ikon- tone

- Nøytral slate/muted på chrome; én aksent (hot pink) på aktiv tilstand.
