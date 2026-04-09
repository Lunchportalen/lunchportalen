# U17 — AI governance model (Umbraco AI-paritet + Lunchportalen)

**Inspirasjon:** [Umbraco — Flexible foundation for an AI future](https://umbraco.com/products/flexible-foundation-for-an-ai-future/) — *AI on your terms*, modulært, valgfritt, menneskelig kontroll, dataeierskap, forutsigbar kost.

## 1. Speiling av Umbraco AI-prinsipper

| Prinsipp | Umbraco-intent | Lunchportalen-implementasjon |
|----------|----------------|------------------------------|
| CMS stabilt, AI fleksibelt | Kjerne uendret av AI | Operativ sannhet (ordre, faktura, leveranse) forblir i **runtime**; AI foreslår, forklarer, hjelper — **publiserer ikke** transaksjonell sannhet uten eksisterende sikre flyter |
| Modulær AI | Byggeklosser | Separate API-ruter under `app/api/backoffice/ai/**` med tydelige formål (tekst, SEO, layout, bilde, …) |
| Valgfri AI | Ikke tvang | Features kan skjules av feature-flag/rolle; ingen «må bruke AI» for å redigere |
| Kontroll over modell/atferd/tone | Konfigurasjon | Prompt-/policy-lag i kode og API; fremtidig settings-UI uten ny orchestrator påkrevd i U17 |
| Human approval | Menneske i løkken | Content workflow, review, publish — ikke auto-live av AI-generert innhold uten eksplisitt steg der det er krav |
| Data governance | Data sendes ikke til uforutsigbar trening | Ingen antagelse om at CMS-innhold brukes til modelltrening; bruker velger leverandør via miljø |
| Forutsigbar AI-kost | Ingen bundlet markup | Kost følger faktisk API-bruk og konfigurasjon — operativt; CMS viser ærlig posture |
| Ingen vendor lock-in | Flere leverandører mulig | Abstraksjon via env og sjekk-skript; `check:ai-internal-provider` hindrer utilsiktet intern provider |

## 2. Eksisterende AI-flater i repoet

- **Backoffice AI:** `app/api/backoffice/ai/**` (suggest, SEO, layout, page-builder, image, jobs, health, …).
- **Content workspace:** `contentWorkspace.ai.ts`, `useContentWorkspaceAi.ts`, modaler for AI-blokker.
- **Kvalitetssikring:** `scripts/ci/ai-governance-check.mjs`, `npm run check:ai-internal-provider`.

## 3. Modenhet

| Område | Modenhet | Merknad |
|--------|----------|---------|
| Tekst/innholdsassist | **Moden** | Brukes i workspace |
| SEO/CRO-hjelp | **Moden** | API + paneler |
| Media/bilde | **Moden** | Ruter finnes |
| Social | **Posture** | Kan være LIMITED — ikke overlov |
| ESG-presentasjon | **Lesing** | Forklaring > generering av sannhet |

## 4. Bak review eller modulposture

- Alt som **kunne** påvirke offentlig sannhet (meny, priser, avtaler) → **review** eller **routing til runtime**.
- Eksperimentelle eller delvis implementerte flyter → **STUB / LIMITED** synlig i UI der relevant.

## 5. Hva som må bygges senere for «bredere enn Umbraco standard» (uten ny kjerne)

- **Samlet AI-innstillingsflate** (leverandør, modell, grenser) — kan bygges på eksisterende env + API.
- **Forklarende kontrollflate** — «hva gjorde AI her?» i CMS-paneler (audit-lignende, ikke ny audit-motor).
- **Kost/nytte-innsikt** — operativt dashboard utenfor ren U17-doc (valgfritt).

U17 **leverer modellen**; implementasjon av nye UI-flater er **ikke påkrevd** i denne fasen når STOPPREGEL gjelder.
