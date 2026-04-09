# AI Growth Consolidation — plan (2D0, kun plan)

**Status:** Planlegging — **ingen** refaktor eller ny orkestrator i 2D0.  
**Mål:** Én forståelig AI-opplevelse **inne i CMS** for social, SEO, innholdsdrift og kreativ assistanse — **uten** parallelle kontrolltårn.

---

## 1. Hva som allerede finnes (høy nivå)

| Område | Lokasjon (typisk) | Funksjon |
|--------|-------------------|----------|
| Content workspace | `app/(backoffice)/backoffice/content/_components/*` | Blokkeditor, Copilot-rail, SEO-forslag, mange «Editor*Panel» |
| Growth AI | `EditorGrowthAiPanel.tsx`, `POST /api/ai/growth/*` | SEO/ads/funnel-forslag |
| SEO intelligence | `app/api/backoffice/ai/seo-intelligence/route.ts` | Analyse + logging |
| Social AI | `app/api/social/ai/*`, `lib/social/unifiedGeneratorClient.ts` | Generering av SoMe-utkast |
| Growth engine (ren funksjon) | `lib/ai/growthEngine.ts` | Samlet **read-only** SEO+ads+funnel |
| Autonomi / policy | `lib/social/autonomyExecution.ts`, `decisionEngine.ts` | Beslutningstyper inkl. publish (låst) |
| Media | `app/(backoffice)/backoffice/media`, `lib/cms/*` | Opplasting, tre-kobling (2B) |
| AI governance | `scripts/ci/ai-governance-check.mjs` | RC-gate |

---

## 2. Spredning og overlapp (problem å løse senere)

- **Mange paneler** med overlappende navn («Growth», «SEO», «Copilot», «Design AI») — økt kognitiv last.
- **Flere innganger** til lignende jobber (growth vs social vs seo-intelligence).
- **To «meta»-nivåer:** superadmin SoMe-side vs backoffice content — begge trenger **samme** policy for «forslag vs lagring».

---

## 3. Konsolideringsprinsipper (beslutningsramme)

1. **Ingen ny sentral «AI brain»** — utvid `growthEngine` / eksisterende ruter før nye pakker.
2. **CMS-first:** Primær brukerhistorie = redaktør i `/backoffice/content`; superadmin SoMe blir **operativ** eller **avansert**, ikke konkurrerende redaktørflate.
3. **Én kontrakt for «forslag»:** JSON-struktur fra API som allerede brukes — nye felt krever versjonering, ikke duplikat-endepunkt.
4. **Review-gate:** AI kan ikke sette `published` på innhold eller `published` på `social_posts` uten eksplisitt steg (allerede delvis i policy).
5. **Media:** Alt generert bildetekst / bilde lagres via **eksisterende** media-API og tre — ikke nytt lager.

---

## 4. Anbefalt kartlegging før 2D1-koding

- Tabell: **Komponent** → **API** → **Rolle** → **Behold / slå sammen / skjul bak flagg**.
- Avled **én** «Growth hub»-entry i content workspace (faner eller seksjon) som lenker til eksisterende paneler uten å omskrive dem i første runde.

---

## 5. Hva som bør beholdes

- `growthEngine.ts` som **read-only** orkestrator for analyse.
- `seo-intelligence` der logging og superadmin-guard allerede finnes.
- `routeGuard` + `jsonOk`/`jsonErr` på alle nye endepunkter.
- RC **ai-governance** — ingen unntak uten oppdatert sjekk.

---

## 6. Hva som kan fases ut eller skjules (senere, ikke 2D0)

- Duplikat SEO-knapper på flere steder → én primær med «avansert» i inspector.
- Overflødig eksperimentelle UI på samme skjerm som kjerne-redigering — flytt til `/backoffice/experiments` som allerede finnes.

---

## 7. Tester (fremtidige)

- Eksisterende mønstre: `tests/api/backofficeAi*.test.ts`, `tests/security/editorAiPermissionGuarantees.test.ts`.
- Nye: én **golden path** «AI-forslag → avvis → ingen DB-endring» og «forslag → aksepter → lagre variant».

---

## 8. Avhengigheter

- **2B:** content tree + media — sannhet for filer.
- **Social plan:** samme modell for genererte SoMe-utkast.
- **SEO plan:** samme metadata-felter.
