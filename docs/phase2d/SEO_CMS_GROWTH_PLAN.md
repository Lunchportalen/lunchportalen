# SEO / CMS Growth — plan (2D0, kun plan)

**Status:** Planlegging — **ingen** ny SEO-runtime i 2D0.  
**Kanon:** SEO er **CMS-styrt**; AI er **assistent**, ikke eier av sannhet.

---

## 1. Eksisterende spor i repoet

### 1.1 Build-tid og kvalitetsporter

- `scripts/seo-proof.mjs`, `seo-audit.mjs`, `seo-content-lint.mjs` — kjøres etter `next build` i `build:enterprise`.
- **Betydning:** Forside/publisert innhold har **allerede** mekaniske SEO-gates; nye sider må forbli innenfor samme pipeline.

### 1.2 Backoffice / content workspace

- **Egenskaps-rail:** `ContentWorkspacePropertiesRail.tsx` — faner inkl. **SEO** (tittel, meta, AI-knapp «Generer SEO-forslag»).
- **Paneler:** `ContentSeoPanel.tsx`, `EditorGrowthAiPanel.tsx`, `EditorCopilotRail.tsx` (SEO som modus).
- **API:** `POST /api/backoffice/ai/seo-intelligence` (superadmin/backoffice-guard), ev. relaterte `lib/ai/*` SEO-hjelpere.

### 1.3 Growth-orchestrator (lesing)

- `lib/ai/growthEngine.ts` — `runGrowthEngine`: **SEO + ads + funnel** i én **read-only** pakke; eksplisitt «Does not publish».

### 1.4 HTTP growth-endepunkter

- `POST /api/ai/growth/seo`, `ads`, `funnel` — AI-assisterte forslag.
- `GET/POST` `/api/growth/*`, `/api/backoffice/growth/summary` — må leses ved implementering for eksakt kontrakt.

### 1.5 Innholdsmodell

- Postgres: `content_pages`, `global_content`, varianter (se `docs/audit/full-system/SYSTEM_ARCHITECTURE_MAP.md` og 2B-dokumentasjon).
- Sanity: fortsatt brukt for enkelte typer (menyer, ukeplan); **publisert marketing** i praksis ofte DB-styrt i backoffice.

---

## 2. Hvordan SEO bør samles i CMS

| Prinsipp | Beskrivelse |
|----------|-------------|
| **Én redigeringsflate** | Side → metadata → forhåndsvisning → publisering; SEO-felter er **del av** page properties, ikke egen «SEO-app». |
| **Én sannhetskilde for slug/canonical** | Fra content tree + page row; unngå manuelle konkurrerende URL-er. |
| **AI som forslag** | Utkast til tittel, beskrivelse, CRO — alltid **review** før lagring/publisering. |
| **Ingen parallell SEO-motor** | Gjenbruk `growthEngine` / `seo-intelligence` i stedet for nye orkestratorer. |

---

## 3. Innholdstyper, sider og taksonomi

- **Landingssider, kampanjesider, juridisk** — eksisterende content types i tree.
- **Blogg/ressurs** — hvis treet allerede støtter det; ellers **ikke** introdusere nye typer uten 2B-kompatibilitet.
- **Intern lenking** — `InternalLinkPickerModal` og katalog-API (allerede i content workspace).

---

## 4. AI-hjelp (ønsket kapabilitet)

| Område | Kilde i repo | Merknad |
|--------|--------------|---------|
| Sideutkast | Eksisterende block-/AI-paneler | Samme guardrails som i dag |
| Tekst / titler / meta | SEO-fanen + `seo-intelligence` | Må logges der API allerede logger |
| CRO-forslag | `lib/ai/opportunities.ts`, growth panels | Read-only prioritering |
| Metadata | Properties rail | Ikke overstyr publisert sannhet uten versjon |

---

## 5. Trygge og godkjente datakilder

- **Publisert sideinnhold** (variants) — autoritativ tekst for analyse.
- **Offentlig site metadata** — kun det som allerede hentes i SEO-analyse (ikke legg inn konkurrentdata uten avtale).
- **Intern analytics** — der allerede koblet; ikke oppfinn tall.

**Forbudt i 2D:** Nye «SEO scores» som ikke kan forklares fra kode + innhold.

---

## 6. Planlegging vs runtime

| Leveranse | 2D0 | Senere 2D-faser |
|-----------|-----|-----------------|
| Dokumentert kart | Ja | — |
| Ny API | Nei | Kun ved behov og uten duplikat |
| Endring av public HTML | Nei | Kun via normal CMS-publish |
| AI-modellbytte | Nei | Egen change-set |

---

## 7. Tester (fremtidige)

- Eksisterende: `tests/api/backofficeSeoIntelligenceRoute.test.ts` (mønster for auth).
- Fremtid:  
  - SEO-forslag endrer **ikke** publisert variant uten eksplisitt lagre  
  - `seo-proof` fortsatt grønn etter CMS-endringer  
  - slug-kollisjon avvist av validering

---

## 8. Avhengigheter

- **2A design system** — faner, én primær handling, hot pink-regler.
- **2B** — tree path safety; ingen skjult URL-endring.
- **2C** — superadmin capabilities peker til backoffice; ingen ny tower for SEO alene.
