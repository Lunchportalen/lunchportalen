# Phase 2D0 — Baseline delta-audit (mot REPO_DEEP_DIVE_REPORT)

**Dato:** 2026-03-28  
**Referanse:** `REPO_DEEP_DIVE_REPORT.md` (generert samme dato)  
**Formål:** Hva fra deep-dive som nå er **adressert**, hva som **fortsatt gjelder**, og hva som bør anses **historisk** for 2D-planlegging.

---

## 1. Store baseline-problemer som nå er delvis eller fullt løst

| Deep-dive-tema | Status etter 2A–2C | Merknad |
|----------------|-------------------|---------|
| Fragmentert produkt / manglende «IA» for roller | **Delvis løst** | Company admin, kitchen, driver og superadmin har fått **kontrollflater og dokumenterte IA** (`docs/phase2c/*`). Vekst/SoMe/SEO/ESG er fortsatt **ikke** samlet i CMS som én opplevelse — det er **2D-scope**. |
| Operatør-støtte (README rot, uklar navigasjon) | **Delvis løst** | Fase-dokumentasjon under `docs/phase2a`, `phase2b`, `phase2c` gir sporbar kontekst; rot-`README` kan fortsatt være tynn — **ikke** 2D-krav. |
| Superadmin spredt | **Delvis løst** | `/superadmin` kontrollsignaler + hurtiglenker (2C4); capabilities-register (`lib/superadmin/capabilities.ts`) er eksplisitt. |
| CMS/content tree uten klar plan | **Delvis løst** | 2B dokumenterer tre, media, sikkerhet; **growth** er fortsatt egen bølge (2D). |
| Enterprise build / SEO gates | **Stabilt** | `build:enterprise` kjeder fortsatt `seo-proof`, `seo-audit`, `seo-content-lint` — **CONFIRMED** mønster. |

---

## 2. Baseline-risikoer som fortsatt gjelder (2D må respektere)

| Risiko | Relevans for 2D |
|--------|-----------------|
| **`typescript strict: false`** | Fortsatt **CONFIRMED** i `tsconfig.json`. 2D-runtime må ikke skjule kontraktsfeil; nye moduler bør være strengt typet lokalt der mulig. |
| **Middleware sjekker kun cookie, ikke rolle** | Uendret prinsipp: **server** må autorisere. 2D legger ikke inn nye offentlige growth-endepunkter uten eksisterende mønster. |
| **Stor APIflate (500+ routes)** | Øker kollisjonsrisiko; 2D skal **gjenbruke** `/api/social/*`, `/api/backoffice/*`, `/api/ai/growth/*`, ESG-ruter — ikke duplisere. |
| **Worker/cron delvis stub** | Deep-dive peker på ufullstendig kø. SoMe-cron og ESG-cron finnes, men **ekte ekstern publisering** er policy-/integrasjonsbegrenset (se `lib/social/executor.ts`, TikTok-stub). |
| **To spor for ukeplan (Sanity vs ordre)** | Fortsatt **arkitektonisk** tema for **operativ kjerne**, ikke løst av 2D. 2D skal **ikke** introdusere ny «uke-sannhet». |
| **Fredag 14:00 vs 15:00 (order window)** | **CONTRADICTION** i rapporten — **produkt/RC**, ikke 2D0. |
| **Employee `next` tillater mer enn kun `/week`** | **Rolle/policy** — frosset per AGENTS; 2D rører ikke `lib/auth/role.ts`. |

---

## 3. Deler av deep-dive som er historiske eller ikke bør styre 2D-planen

| Område | Hvorfor justere vekten |
|--------|-------------------------|
| Eksakt antall `route.ts` (f.eks. 557) | Telling **drifter** ved hver commit — bruk som **orden av størrelse**, ikke krav. |
| «Hybrid Stripe + Tripletex» som risiko | **Økonomisk drift** — 2D dekker **ikke** billing; referanse kun for **grense** (ingen ny fakturasannhet). |
| Detaljert AI-fil-inventar i eldre audit-logger | Kan være **utdatert**; 2D skal kartlegge **nåværende** `lib/ai/**`, `app/(backoffice)/**` ved implementering. |
| Umbraco-sammenligning | **Historisk** produktønske — faktisk stack er Next + Postgres-innhold + Sanity; 2D planlegger **CMS i appen**, ikke nytt CMS-produkt. |

---

## 4. Konklusjon for 2D0

- **2D bygger på** moden infrastruktur: `social_posts`, ESG-snapshots + RPC/cron, backoffice content workspace, growth/SEO API-er og build-SEO-skript.
- **2D løser ikke** kjernens historiske motsetninger (ukeplan, fredagstid, employee allowlist) — de forblir **utenfor** growth-planen.
- **Delta:** Fra «kaotisk kartlagt monolitt» til «dokumenterte kontrollflater + klar 2D-oppgave: samle growth i CMS uten parallelle motorer».
