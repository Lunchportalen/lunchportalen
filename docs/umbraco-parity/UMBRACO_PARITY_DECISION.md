# Umbraco parity — decision

## 1. Endelig beslutning

**GO WITH CONDITIONS**

- **GO:** Baseline, gap-matrise, runtime-grenser og replatforming-gaps er dokumentert; **Umbraco-paritet** er **arbeidsflyt/IA/UX-paritet** på stacken (Next + Sanity + Postgres + Supabase), ikke produktbytte.
- **Betingelser:** Full teknisk likhet med Umbraco kjerne krever **replatforming** (se `UMBRACO_PARITY_REPLATFORMING_GAPS.md`). Operativ sannhet forblir i runtime.

## 2. Hva som er oppnådd

- **CMS** er **hovedbase** for kontrollplan, innhold, media (CMS-lag), meny-publish (Sanity + broker), og **routing** til operative flater.
- **Domener** er knyttet via **domain action surfaces** + denne dokumentasjonen.
- **Uke/meny:** Publiseres via **Sanity** (Studio eller CP7 API) — **publisert** perspektiv konsumeres av `GET /api/week`.
- **Control towers** er innordnet narrativt (hub + tårn-lenker) uten å blande roller.

## 3. Hva som fortsatt er svakt

- **To innholdsmotorer** (Postgres pages vs Sanity) — krever løpende **tydelig** IA.
- **Synk Sanity ↔ DB visibility** — operativ runbook.
- **Growth** kan være **LIMITED** — må holdes ærlig.

## 4. Nærhet til Umbraco-/verdensklasse

- **Redaksjonell styrke** for nettsider og strukturert innhold: **høy**.
- **Én enterprise CMS-kjerne** som Umbraco: **ikke** — bevisst **simulert** via control plane + dokumentasjon.

## 5. Før ubetinget enterprise-live-ready

1. Runbook for `SANITY_WRITE_TOKEN` og publish.
2. Avklart forhold **menu_visibility_days** vs Sanity i drift.
3. Kontinuerlig **badge/UX**-sjekk for LIMITED-moduler.

## 6. Kan vente

- Global backoffice-søk, bulk-uke, innebygd Studio.
