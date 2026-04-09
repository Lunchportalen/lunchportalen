# U17 — Enterprise hardening (parity lens)

**Arbeidsstrøm 7** — mål: lukke *fortellings-* og *tilgangs-*hull som hindrer enterprise-opplevelse, uten brede refaktorer.

## Prioritert (allerede delvis på plass)

| Område | Tiltak | Status |
|--------|--------|--------|
| API-kontrakt | `audit:api`, `api:contract` | CI |
| AI governance | `ai:check`, `check:ai-internal-provider` | CI |
| CMS integritet | `cms:check` | CI |
| Mock / status | `mock:check`, `status:guard` | CI |
| Fail-closed | Server guards i layouts | Eksisterende mønster |

## U17-spesifikt

- **Ærlig modulposture** — viktigere enn nye features.
- **Ingen** endring av middleware/auth/billing uten kritisk behov — **ikke** trigget i U17.

## Gap som krever større redesign

- Global indeksert søk og én historikkmotor — se `U17_REPLATFORMING_GAPS.md`.
