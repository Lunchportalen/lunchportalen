# SEO — AI-grense (2D2)

---

## 1. Prinsipp

- **Ingen** separat `ai_seo_*`-tabell for sannhet.
- AI-forslag fra **`computeSeoIntelligence`** er **forslag** — persist skjer først når redaktør trykker **Lagre SEO til variant** (sammen med manuelt redigerte felt).
- `seo-intelligence` logger til `ai_activity_log` og `recordSeoLearning` — **eksisterende** spor.

---

## 2. Ekte runtime vs ikke aktivert

| Kilde | 2D2 |
|-------|-----|
| `POST /api/backoffice/ai/seo-intelligence` | **Ekte** (superadmin, rate limit). |
| Eksterne SEO-API-er (Ahrefs, GSC, …) | **Ikke** koblet i denne leveransen. |
| `POST /api/ai/growth/seo` | **Uendret** — ikke innlemmet i ny flate (unngå duplikat UI). |

---

## 3. Datakilder

- **Godkjente:** variant `body.blocks`, `body.meta`, `content_pages.title` — alt fra egen DB.
- **Ikke:** crawling av konkurrenter eller tredjeparts «auto-fix» uten eksplisitt produkt.
