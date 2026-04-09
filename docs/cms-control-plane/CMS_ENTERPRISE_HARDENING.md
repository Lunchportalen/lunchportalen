# Arbeidsstrøm 6 — Enterprise hardening for CMS control plane

**Dato:** 2026-03-29

## Mål

Helheten skal tåle **enterprise**-forventning: fail-closed, sporbarhet, ærlig modulstatus, publish-sikkerhet — **uten** brede refaktorer i samme breath.

## Prioriterte hull (fra plattform-risiko + enterprise beslutning)

| Område | Tiltak | Merknad |
|--------|--------|---------|
| **Route/API gate** | Mekanisk audit / utvid `scopeOr401` mønster | Stor flate — faseinndelt |
| **Middleware** | Layout/API må bære rolle-sannhet | Middleware forblir cookie — **ikke** «fikset» i CMS-doc alene |
| **Worker stubs** | Fjern eller implementer `send_email`, `ai_generate`, … | Blokkerer ubetinget enterprise-live per E0 |
| **Social DRY_RUN** | Tydelig UI + env | — |
| **Publish** | Content publish allerede gated — vedlikehold tester (`tests/backoffice/*`, `tests/api/content*`) | — |
| **Ops** | Runbook referanse: `docs/hardening/H2_RUNBOOK_AND_RECOVERY.md`, `LIVE_READY_RUNBOOK.md` | Organisatorisk |

## CMS-spesifikk hardening

- **Ingen** skjult «save» som muterer operativ DB fra content routes.
- **AI apply:** superadmin/rolle som i eksisterende API — behold audit-logg der implementert.

## Stor redesign?

- **Full** Umbraco-paritet i multi-site editor er **ikke** påkrevd for RC — **NO-GO** for ubetinget live er dokumentert separat.
- **CMS-led coherent** opplevelse kan oppnås med **IA + docs + read-only aggregater** før eventuell schema-migrasjon.

## CP1

- **Publish-sikkerhet** uendret; **ærlig** modulstatus synlig for superadmin i backoffice.
- Ingen middleware/auth-endring.

## Stoppregel

Hvis et hull krever **auth/middleware/billing** endring — **egen** changeset med AGENTS-format — ikke bland med CMS-dokumentasjon.
