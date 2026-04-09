# Social — AI / media-grense (2D1)

---

## 1. Prinsipp

- **Ingen** ny `ai_social_*`-tabell.
- **Ingen** separat AI-media-tabell — bilder refererer til **eksisterende** medie-URL eller unified save som allerede skriver til `social_posts.content`.

---

## 2. Hva som er ekte runtime i 2D1

| Del | Status |
|-----|--------|
| CMS `/backoffice/social` | **Ekte** |
| `PATCH /api/social/posts/[id]` | **Ekte** |
| `POST /api/social/posts/publish` | **Ekte** (men ekstern effekt = **stub/dry_run** eller avslått kanal) |
| `POST /api/social/ai/generate` | **Ekte** (eksisterende motor) |
| Meta Graph API post | **Ikke** — `publishFacebook` logger stub |
| LinkedIn post | **Ikke aktivert** i publish-route |

---

## 3. Innholdsversjon

- Nye redigeringer fra CMS tvinger innhold mot **v1**-kontrakt der `mergeSocialPostContent` brukes.
