# Foundation 2 — Runtime-sannhet om `/` og `home`

**Mål:** Presis, bevisbar beskrivelse av hvor forsiden leser fra, og hvordan det verifiseres uten gjetting.

## 1. Sannhetskjede (Next.js)

```
/  →  app/(public)/page.tsx
  →  loadPublicPageWithTrustFallback("home")
       →  loadLivePageContent("home")
            →  getContentBySlug("home")
  →  parseBody → blokker
  →  CmsBlockRenderer
```

### `getContentBySlug` (rekkefølge — første treff vinner)

1. **Lokal CMS-runtime** (`isLocalCmsRuntimeEnabled()`) → `publicContentOrigin: local-cms`
2. **Local dev content reserve** (`LOCAL_DEV_CONTENT_RESERVE` + reserve-fil) → `local-reserve`
3. **Allowlistet marketing-slug** (`marketingUmbracoAllowlistedSlugs()`): **kun Umbraco Delivery** når `UMBRACO_DELIVERY_BASE_URL` er satt. Ved **200 + gyldig body** → `live-umbraco`. Mangler base-URL eller miss/feil fra Delivery → `null` (fail-closed: `cms_marketing_umbraco_delivery_missing_fail_closed` eller `cms_marketing_umbraco_allowlisted_miss_fail_closed`).
4. **Ikke-allowlistet slug** → `null` (public resolver leser **aldri** Supabase). For interne behov: `readSupabasePublishedContentPageBySlug` (backoffice/tester).

`LP_MARKETING_CMS_SOURCE` styrer **ikke** public marketing-read; Delivery aktiveres av `UMBRACO_DELIVERY_BASE_URL` alene.

uSync-filer leses **ikke** av Next; de mater kun Umbraco-instansen ved import.

## 2. Umbraco-node i repo (redaksjonell sannhet i CMS, ikke i Next)

`Umbraco/uSync/v17/Content/home.config` — dokument `home`, `marketingPage`, publisert `bodyBlocks`. **Next** henter det kun via **Delivery** for allowlistet `home`.

## 3. Seed på `/` (kun `home`)

`loadPublicPageWithTrustFallback` bruker `buildEditorialFallbackPublicBody()` (tom blokkliste + `meta.notEditorialLive`) når det **ikke** finnes blokker fra `loadLivePageContent`.

| `pageId` | `publicContentOrigin` (DOM: `data-lp-public-cms-origin`) | Betydning |
|----------|----------------------------------------------------------|-----------|
| (live row) | `live-umbraco` | Umbraco Delivery leverte blokker |
| (live row) | `local-cms` / `local-reserve` | Lokal harness / reserve |
| — | `seed-no-row` | Ingen brukbar rad fra `getContentBySlug` |
| — | `seed-empty-body` | Rad finnes men `parseBody` → 0 blokker |

**Ikke forventet på `/`:** `live-supabase` (allowlistet slug går ikke til Supabase).

**SEO / metadata:** Når `seed-no-row` eller `seed-empty-body`, bruker `generateMetadata` `buildEditorialFailClosedMetadata` (nøktern tittel/beskrivelse, `robots: noindex`). Når `live-umbraco`, brukes `buildCmsPageMetadata` fra samme body som blokker.

**DOM:** `.lp-home` har `data-lp-public-cms-origin="<verdi>"`.

## 4. Når er forsiden «reelt Umbraco-styrt» i drift?

**Krav (alle):**

- `UMBRACO_DELIVERY_BASE_URL` peker på gyldig Delivery-API
- Allowlist inkluderer `home`
- Delivery returnerer innhold med minst én mappet blokk for `home`
- View viser `data-lp-public-cms-origin="live-umbraco"` og metadata reflekterer body (ikke fail-closed)

Når Delivery **mangler** innhold for `home`, er opprinnelsen `seed-no-row` eller `seed-empty-body` — **ikke** Supabase-innhold.

## 5. Hva repoet alene kan bevise

Repo + tester kan bevise **kjede og merking**. At **produksjon** alltid er `live-umbraco` krever **miljøsjekk** (env + faktisk HTTP til Delivery + DOM).
