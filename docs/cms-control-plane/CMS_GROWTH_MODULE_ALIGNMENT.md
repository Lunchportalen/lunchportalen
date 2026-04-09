# Arbeidsstrøm 5 — Social / SEO / ESG as CMS modules

**Dato:** 2026-03-29

## Mål

Growth-flater skal oppleves som **moduler** under samme kontrollnarrativ som CMS — med **ærlig** runtime-status og **review-first** arbeidsflyt.

## Modul — typisk status (koble til UI)

| Modul | Anbefalt merke | Begrunnelse (fra eksisterende audit) |
|-------|----------------|--------------------------------------|
| **Social** | **LIMITED** / **DRY_RUN** | Ekstern publisering policy/kanal-stubs; `lib/social/executor` |
| **SEO** | **LIVE** (etter publish) + **review** | Batch scripts (`seo-*.mjs`) + editor — «TRANSITIONAL» i CMS boundary report |
| **ESG** | **DERIVED** / **REVIEW_ONLY** | Aggregater; risiko ved tom data — ikke markedsfør som «full» uten DB-bevis |

## Design-krav

- Bruk **samme media- og content-kjede** der growth trenger bilder/tekst fra publisert innhold.
- **Ikke** lover ekstern SoMe-rekkevidde uten nøkler — jf. enterprise NO-GO om DRY_RUN.

## Teknisk konsolidering (uten ny backend)

1. Én **modul-indeks** i docs (denne filen + `CMS_CONTROL_PLANE_SOT_MAP.md`).
2. Lik **tag-komponent**-copy på tvers av superadmin/backoffice (`LIVE` / `LIMITED` / `DRY_RUN` / `STUB`).

## CP1 (UI)

- Backoffice viser **SEO/ESG — LIMITED**, **Social — DRY_RUN**, **Worker — STUB** i `CmsRuntimeStatusStrip` (hover for detalj).

## Ikke gjøre

- Nye parallelle SEO pipelines.
- Skjule STUB-worker bak bruker-knapp «Send nå».
