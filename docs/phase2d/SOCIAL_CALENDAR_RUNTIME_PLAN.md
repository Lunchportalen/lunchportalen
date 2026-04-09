# Social Calendar — runtime-plan (2D0, kun plan)

**Status:** Planlegging — **ingen** runtime-implementering i 2D0.  
**Kanon:** CMS/backoffice er kontrollsenter; SoMe er **Lunchportalens egne kanaler** og **review-first**.

---

## 1. Eksisterende spor i repoet (kartlagt)

### 1.1 Data

- **`social_posts`** (Postgres, Supabase): persisterte innlegg med bl.a. `status`, `scheduled_at`, `content`, `platform`, `variant_group_id` (A/B). Migrasjoner under `supabase/migrations/*social*`.
- **Ordreattributtering:** `orders.social_post_id` m.m. (`lib/growth/aggregateGrowth.ts`, `lib/revenue/model.ts`) — kobler kampanje til økonomisk sporbarhet (ikke ny ordresannhet i 2D).

### 1.2 API (utvalg)

| Område | Sti | Rolle |
|--------|-----|--------|
| Liste | `GET /api/social/posts` | superadmin, les `social_posts` |
| Lagre batch / kalender | `POST /api/social/posts/save` | superadmin, validering `socialPostsSaveBodySchema` |
| AI-generering | `POST /api/social/ai/generate`, `/api/social/unified/generate` | genererte utkast |
| Anbefalinger / run | `/api/social/recommendations`, `/api/social/run` | støttefunksjoner |
| Sporing | `/api/social/track` | analytics-spor |
| A/B | `/api/social/ab/*` | eksperimenter koblet til `social_posts` |
| Autonomi | `POST /api/social/autonomous/run`, `GET /api/cron/social` | cron + `runSocialAutonomyCycleFromDb`, `runGrowthOptimizationLoop` |

### 1.3 UI i dag

- **`/superadmin/growth/social`** — `SocialEngineClient.tsx`: kalender-/motorflate med «trygg modus», forsterkning, video-studio, autonomi (tekst i `page.tsx` beskriver begrensninger).
- **Backoffice:** `SocialContentCalendar` (referanse i content-komponenter) kan vises i redigeringskontekst — **ikke** ennå én kanonisk «CMS-first» kalender for alle growth-oppgaver.

### 1.4 Publisering og eksterne kanaler

- **`lib/social/executor.ts`:** `publish` → `publish_policy_lock` (fail-safe).
- **`lib/social/liveChannelPublish.ts`:** Facebook / Instagram / TikTok — kaller modulære `publish*` (TikTok **stub** i `lib/social/tiktok.ts`).
- **`lib/social/auto-post.ts`:** kan kalle `publishLivePost` — må **alltid** ligge bak policy, secrets og review (allerede delvis begrenset).

**Konklusjon:** **Generering + lagring + planlegging** er relativt modent i DB/API; **ekstern live-publisering** er bevisst låst/stub og er **høyrisiko** uten integrasjonsklarhet.

---

## 2. Målflyt (produkt)

Ønsket sekvens: **generate → review → edit → approve → schedule → publish → delete/cancel**

| Steg | Eksisterende støtte | Gap |
|------|---------------------|-----|
| Generate | AI-ruter + `unifiedGeneratorClient` | Bør trigges fra **CMS-kontekst** med samme review-kontrakt |
| Review | Delvis i superadmin-UI | Mangler **én** felles kø med tydelig «klar til godkjenning» |
| Edit | `posts/save`, innhold i JSON på rad | Trenger **forutsigbar** redigeringsmodell i UI |
| Approve | Statusfelt / policy engine | Må knyttes eksplisitt til **én** tilstandsmaskin (ikke flere «sannheter») |
| Schedule | `scheduled_at` i save | OK teknisk; kalender må reflektere Oslo-tid konsekvent |
| Publish | Policy lock / stubs | **Ikke** skru på bredt før integrasjoner og audit er klare |
| Delete/cancel | Må verifiseres per rute | Dokumenter eksisterende delete-paths før runtime |

---

## 3. Lunchportalen-only kanaler

- **Teknisk:** Begrens `platform` og tillatte actions til **konfigurerte** kanaler (eget domene / egne kontoer).
- **Organisatorisk:** Ingen «åpne» tredjepartskontoer i samme motor uten **egen** secret-håndtering per kanal.
- **Kode:** Unngå duplikat «social v2»; utvid `social_posts` og eksisterende tjenester.

---

## 4. Eksterne integrasjoner — finnes vs mangler

| Integrasjon | Status i kode |
|-------------|----------------|
| Meta (FB/IG) | Moduler finnes; **krever** app credentials, policy review |
| TikTok | **Stub** |
| LinkedIn | Referert i innholdstype / spor; **ekte OAuth/post** må kartlegges per env |
| Cron | `CRON_SECRET` — **CONFIRMED** mønster |

**Mangler før «ekte» publish-runtime:** Avklarte secrets, rate limits, retentions, juridisk tekst, feilhåndtering og **audit-logg** per utsendelse.

---

## 5. Hva som kan bygges trygt først (anbefalt rekkefølge innen Social)

1. **Read-only kalender i CMS** som leser `GET /api/social/posts` (eller server fetch) — ingen ny mutasjon.
2. **Ett «utkast»-panel** i content workspace som bruker eksisterende generate-endepunkter med **påkrevd** menneskelig godkjenning før status endres.
3. **Status/gating** dokumentert én plass (tabell i `PHASE2D_DECISIONS.md` ved implementering).
4. Deretter: schedule-hardening, så publish med **feature flag** og **én** kanal pilot.

---

## 6. Tester som må finnes ved runtime (referanse)

- Eksisterende: integrasjon mot API-kontrakt der `routeGuard` og `jsonOk` brukes — se `tests/api/*`, `tests/security/*`.
- Nye (ved 2D1+):  
  - superadmin-only på `posts`/`save`  
  - validering av `socialPostsSaveBodySchema` (avvis ugyldig)  
  - policy: publish uten credentials → **fail closed**  
  - ev. snapshot av `social_posts`-rad for statusoverganger

---

## 7. Avhengigheter til andre 2D-arbeidsstrømmer

- **AI consolidation:** samme prompt-/modellgrenser for generate (se `AI_GROWTH_CONSOLIDATION_PLAN.md`).
- **SEO:** deler medie- og metadata-konvensjoner; ingen konkurranse om «sannhet».
- **ESG:** ingen direkte kobling; unngå å bruke ESG-tall som SoMe-påstand uten kilde.
