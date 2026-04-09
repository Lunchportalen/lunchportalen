# Phase 2D — Risiko-kart

**Dato:** 2026-03-28  
**Kontekst:** Planlegging (2D0) — ingen implementering ennå.

---

## Risiko-matrise (overslag)

| ID | Risiko | Alvor | Sannsynlighet | Mitigasjon |
|----|--------|-------|---------------|------------|
| R1 | Ekstern SoMe-publisering uten full audit | **Høy** | Medium | Policy lock (allerede), feature flag, én kanal pilot |
| R2 | AI endrer publisert innhold utilsiktet | **Høy** | Medium | To-stegs lagre, diff-visning, rolle-guard |
| R3 | SEO-meta feil på forsiden | **Medium** | Medium | `seo-proof` + manuell QA på topp-sider |
| R4 | ESG-tall i marketing som ikke matcher DB | **Høy** | Lav | Kun snapshot-baserte utdrag med dato |
| R5 | Duplikat API (`/api/social/v2`) | **Medium** | Medium | Eksplisitt forbud i beslutningsdoc |
| R6 | Cron dobbelkjøring / ESG race | **Medium** | Lav | Idempotens i RPC (verifiser) |
| R7 | Leakage av superadmin SoMe-data via feil route | **Høy** | Lav | `requireRoleOr403` mønster |
| R8 | Performance: tung AI på lagre | **Medium** | Medium | Kø / timeout / bruker-feedback |

---

## Lav risiko — kan prioriteres tidlig i 2D1 (når runtime startes)

- Read-only kalender som henter `social_posts`.
- SEO-forslag som **ikke** persisteres uten klikk.
- ESG dashboard som bare leser eksisterende API.

---

## Krever eksterne avhengigheter eller secrets

- Meta / LinkedIn / etc. API-nøkler og rotasjon.
- Eventuell CDN for genererte bilder (hvis ikke allerede dekket av media-pipeline).

---

## Indirekte berøring av auth/order/billing

- **Ordre-attributtering** til SoMe (`social_post_id`) finnes — endringer skal **ikke** endre fakturerbar sannhet.
- **Billing** — ingen nye felt i 2D growth.

---

## Referanse til eksisterende tester

- `tests/security/privilegeBoundaries.test.ts` — superadmin gate.
- `tests/api/backofficeSeoIntelligenceRoute.test.ts` — SEO API.
- `tests/smoke/critical-surfaces.smoke.test.ts` — system status non-500.
- `build:enterprise` — SEO-skript som regressjonsgate.

---

## Etter 2D1 (Social Calendar MVP)

| Risiko | Merknad |
|--------|---------|
| Bruker tror innlegg er publisert eksternt | UI + API returnerer eksplisitt `PUBLISH_DRY_RUN` / `CHANNEL_NOT_ENABLED` — **ikke** `published` i DB ved stub. |
| To flater (CMS + superadmin motor) | Samme `social_posts`; risiko for forvirring — superadmin motor forblir avansert spor. |
| Status-migrering fra eldre `planned`/`ready` | Normalisert lesing; lagring normaliserer via `normalizeSocialPostStatus`. |

**Blocker før 2D2 (SEO):** Ingen teknisk blocker fra 2D1 — neste fase er egen PR per `SEO_CMS_GROWTH_PLAN.md`.

---

## Etter 2D2 (SEO / CMS Growth MVP)

| Risiko | Merknad |
|--------|---------|
| Redaktør tror SEO er «live» på domenet | Banner forklarer at **publisering** skjer via innholdsflyt — variant lagres som før. |
| `PATCH` body uten CMS-header i strict miljø | 2D2 sender alltid `x-lp-cms-client: content-workspace` ved body-lagring. |
| Analyse belaster rate limit | Eksisterende AI rate limit på `seo-intelligence` — uendret. |

**Blocker før 2D3 (ESG):** Ingen teknisk blocker fra 2D2 — ESG er egen fase.

---

## Etter 2D3 (ESG runtime MVP)

| Risiko | Merknad |
|--------|---------|
| Bruker tolker tom snapshot som «bra klima» | UI viser **amber** «Ikke nok data» — eksplisitt. |
| To lister (`esg_monthly` vs snapshots) | Forklart i «Kilde og metode»; estimat vs snapshot. |
| Superadmin vs CMS dobbelt vedlikehold | Samme fetch-lib; CMS **lenker** til superadmin for dyp rapport. |

**Gjenstående plattform-risiko (bredt):** ekstern SoMe-audit (R1), AI-lagring (R2), cron-idempotens for ESG (R6) — se tabell øverst; **ikke** lukket av 2D3 alene.
