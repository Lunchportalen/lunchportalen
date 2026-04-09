# CP8 — Menu publish parity decision

## Employee runtime leser

- **`GET /api/week`** → `company_current_agreement` + **publisert** `menuContent` per dato (`lib/cms/menuContent` → `lib/sanity/queries`).
- **`menu`** (måltidstype-dokumenter) støtter beredskap/lesing — ikke samme rad som dag-kolonner i `GET /api/week`.

## Publisert sannhet

- **Sanity** publisert perspektiv (ikke `drafts.*`) med `CUSTOMER_VISIBLE_FILTER` (legacy `isPublished` eller `approvedForPublish && customerVisible`).

## Umbraco-lignende publish-opplevelse over Sanity

1. **Studio:** full redigering + Publish.
2. **In-CMS:** `CmsMenuContentNativePublishPanel` → `POST /api/backoffice/sanity/menu-content/publish` (superadmin + token) — **samme Sanity Actions** som Studio Publish for draft → published.

## Preview og publish

- **Lesing** til ansatt/forhåndsvisning følger samme GROQ-filosofi for kundesynlig meny.
- **Publish** endrer draft→published i Sanity — ikke en LP-DB-rad.

## weekPlan

- **Editorial-only** — ikke `GET /api/week` kilde; amber/tekst på `/backoffice/week-menu`.

## CP8 implementasjon

- **Kode:** Oppdatert `OPERATIONAL_WEEK_MENU_PUBLISH_CHAIN` + `CmsOperationalPublishChain` hjelpetekst så broker ikke motsier kjeden.
- **Ikke nytt:** menymotor, avtale-DB, eller employee API-endring.
