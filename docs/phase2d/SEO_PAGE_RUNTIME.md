# SEO — side-/review-flyt (2D2)

---

## 1. Flyt: analyze → suggest → edit → save → publish

| Steg | Implementasjon |
|------|----------------|
| **Analyze** | `POST /api/backoffice/ai/seo-intelligence` med `blocks`, `meta`, `pageTitle`, `pageId`, `locale`, `goal`, `brand`. |
| **Suggest** | Respons: `score`, `suggestions[]`, `breakdown`; bruker leser og ev. «Bruk forslag». |
| **Edit** | Lokale felt `draftTitle`, `draftDescription`, `draftCanonical`. |
| **Save** | `mergeSeoFieldsIntoVariantBody` + valgfritt `mergeSeoRecommendationsIntoMeta`; deretter `PATCH` med full `body` og CMS-klient-header. |
| **Publish** | **Ikke** i denne flaten — bruker følger lenke til innholdsredigerer og eksisterende publish/workflow. |

---

## 2. Fail-closed

- Analysefeil → banner, ingen skriving.
- Lagring uten nett → banner.
- Ingen skjult oppdatering av `blocks` utenom eksisterende PATCH-kontrakt — kun `meta`-merge via hjelper.

---

## 3. Felt som brukes

- `seo.title`, `seo.description`, `seo.canonical` (Page AI Contract).
- Øvrige felter (OG, noindex, sitemap priority) forblir i **ContentSeoPanel** / properties rail.
