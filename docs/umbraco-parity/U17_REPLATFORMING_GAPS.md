# U17 — Replatforming gaps

**U17 DEEP (2026-03-29):** Les `U17_DEEP_BASELINE.md` og `U17_DEEP_GAP_MAP.md` for full mapping.

**Formål:** Eksplisitt liste over hva som **ikke** blir «100 % Umbraco-lignende» teknisk uten større grep, og hva som kan **simuleres** på dagens stack.

## 1. Krav som krever replatforming eller stor omskriving

| Krav | Hvorfor ikke identisk på Next.js |
|------|----------------------------------|
| Native Umbraco Bellissima UI | Egen React/Next-komponentbase — **UX-paritet** er målet |
| Umbraco Deploy / Cloud sync | Egen deploy-pipeline (Vercel, Sanity) |
| Umbraco-innebygd granular brukerrettigheter per node | Krever **dedikert RBAC-lag** i Postgres — ikke i U17 |
| Én historikkmotor på tvers av Sanity + Postgres + uke | Krever **indeks/aggregator-tjeneste** eller produktvalg |
| Global enterprise-søk som Umbraco + eksterne indekser | Krever **søkeprodukt** (Algolia, e.l.) eller akseptert scope |

## 2. Kan simuleres forsvarlig på dagens stack

- **Discovery** — command palette + lenker + strip (**CP12**).
- **«Moden LTS»-følelse** — konsistent krom, rolig typografi, tydelige tilstander.
- **Governance-fortelling** — dokumentasjon + UI-tekst + eksisterende workflow.
- **AI-modularitet** — separate API-ruter og feature-flag.

## 3. Bør løses med UX/flow-paritet (ikke teknisk kloning)

- **Preview vs publish** — samme **språk** og knapper, ikke samme binær som Umbraco.
- **Rollback** — tydelig hva som **faktisk** kan rulles tilbake per domene.
- **Week/menu** — **ærlig** om Sanity vs LP-Postgres uten å late som én motor.

## 4. Konklusjon

Lunchportalen **skal ikke** replatformeres til Umbraco for U17. **Maksimal paritet** = control plane, redaktørlogikk og governance — dokumentert her, i `U17_DEEP_GAP_MAP.md` og i kode (`backofficeExtensionRegistry.ts`, domain surfaces, posture).
