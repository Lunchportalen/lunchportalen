# SEO — technical boundary (2D2)

---

## 1. Eksisterende (kartlagt)

| Område | Hvor |
|--------|------|
| **Build SEO gates** | `scripts/seo-proof.mjs`, `seo-audit.mjs`, `seo-content-lint.mjs` (etter `next build` i `build:enterprise`). |
| **Robots / sitemap paths** | `middleware.ts` unntar bl.a. `/robots.txt`, `/sitemap.xml`. |
| **Sitemap-hjelpere** | `lib/seo/routes.ts`, `lib/ai/engines/capabilities/generateSitemap.ts`. |
| **Offentlig metadata** | `buildCmsPageMetadata` (`lib/cms/public/cmsPageMetadata.ts`) — canonical, robots, OG fra `body.meta`. |
| **Editor** | `ContentSeoPanel`, properties rail — `noIndex`, `sitemapPriority`, `sitemapChangeFreq`. |

---

## 2. 2D2-endringer

- **Ingen** ny technical-SEO-motor.
- **Ingen** endring av middleware, robots.txt-generator eller sitemap-pipeline i denne leveransen.

---

## 3. Trygge forbedringer senere

- Knytte SEO-flaten til **lesing** av eksisterende sitemap-prioritet fra `meta` (visning kun).
- Eventuelle endringer i scripts — **egen** change-set + full `build:enterprise`.
