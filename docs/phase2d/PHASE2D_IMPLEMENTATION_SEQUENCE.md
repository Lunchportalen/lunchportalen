# Phase 2D — Foreslått implementeringsrekkefølge

**Dato:** 2026-03-28  
**Status:** Plan — **ingen** kode endret i 2D0.

---

## Anbefalt rekkefølge (mål)

1. **Social Calendar** (2D1-prioritet)  
2. **SEO / CMS Growth** (2D2)  
3. **ESG** (2D3)

---

## Begrunnelse

### Hvorfor Social først

- **DB og API er mest modne for «innholdsproduksjon»:** `social_posts`, `posts/save`, AI-generering, A/B — allerede koblet.
- **Størst UX-gap:** Kalender og review er **split** mellom superadmin-flate og backoffice; brukerne trenger **én CMS-drevet** arbeidsflyt før mer komplekse SEO-innholdsstrategier.
- **Risiko kan trappes:** Starte med **read-only** kalender + utkast → deretter schedule → sist **publiser** med flagg.

### Hvorfor SEO / CMS Growth som nummer to

- **Avhenger av stabil redigeringskultur:** SEO er allerede i properties-rail og `build:enterprise` SEO-skript — konsolidering er **prosess + UI**, mindre grønnfelt enn SoMe.
- **Lavere ekstern flate:** Færre OAuth-avhengigheter enn full SoMe-publish.

### Hvorfor ESG sist i hovedsporet

- **Data-laget er sterkt** (snapshots, cron, RPC), men **produktverdien** ligger i **tillit og rapport** — det haster mindre enn synlig growth-loop.
- **Unngår** at marketing skynder på tall før SoMe/SEO **review-kultur** er på plass.
- **Unntak:** Hvis forretning krever **kun** superadmin ESG-forbedring uten CMS — kan små **read-only** UX-forbedringer flyttes tidligere uten å bryte rekkefølgen på *CMS-siden*.

---

## Når repoet ville pekt på annen rekkefølge

- Hvis **juridisk** krever ESG-offentliggjøring før neste kvartal: **del-scope** ESG (kun superadmin + eksport) kan **parallelliseres** med Social 2D1 — fortsatt **ikke** ny ESG-motor.
- Hvis **SEO-regresjon** oppstår: midlertidig **prioriter** SEO-hardening — dokumenteres som avvik i `PHASE2D_EXECUTION_LOG.md`.

---

## Faseinndeling (forslag)

| Fase | Innhold | Exit-kriterium |
|------|---------|----------------|
| **2D0** | Planlegging (denne mappen) | Alle `PHASE2D_*.md` levert |
| **2D1** | Social: CMS-kalender read-only + utkast-review | Ingen auto-publish; tester for guard |
| **2D2** | SEO: konsolidert growth-inngang i CMS | `build:enterprise` grønn |
| **2D3** | ESG: CMS/superadmin lesing med sporbarhet | Ingen nye talltyper uten migrasjon |

---

## Avhengigheter mellom faser

- 2D2 kan starte når 2D1 **ikke** introduserer nye brudd i `content workspace` layout (koordiner PR-størrelse).
- 2D3 skal gjenbruke **samme** design tokens som 2A og **samme** API-kontrakt som allerede dokumentert i `ESG_RUNTIME_PLAN.md`.
