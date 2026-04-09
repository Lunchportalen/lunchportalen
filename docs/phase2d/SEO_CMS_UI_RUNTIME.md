# SEO / CMS — UI / IA (2D2)

**Canonical route:** `/backoffice/seo-growth`  
**Rolle:** Superadmin (backoffice layout).

---

## 1. IA

- **Én H1:** «SEO & vekst».
- **Signaler:** liste over sider (tittel/slug), SEO-score etter analyse, forslagsliste.
- **Primær handling:** «Analyser side» (etter sidevalg); **Lagre SEO til variant** for eksplisitt persist.

---

## 2. Navigasjon

- **TopBar:** fane **SEO** → `/backoffice/seo-growth`.
- **Capabilities:** `bo-seo-growth` i `lib/superadmin/capabilities.ts`.
- **Lenke:** «Åpne i innholdsredigerer» → `/backoffice/content/[id]`.

---

## 3. Status / skillingslinjer

- **Nåværende metadata:** redigerbare felt (tittel, beskrivelse, canonical) lastet fra `body.meta.seo`.
- **AI-forslag:** vises etter analyse; «Bruk forslag» kopierer til felt — **ikke** auto-lagring.
- **Etter lagring:** `seoRecommendations`-snapshot kan skrives til `meta` sammen med SEO-felt (sporbarhet).

---

## 4. Ikke-mål

- Ingen parallell SEO-landing utenfor backoffice.
- Ingen redesign av `ContentWorkspace`.
