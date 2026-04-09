# Umbraco parity — week & menu publishing (WS3)

## Operativ sannhet (employee)

- **`GET /api/week`** → `company_current_agreement` + **publisert** `menuContent` (`lib/cms/menuContent` / `lib/sanity/queries`).
- **`weekPlan`:** redaksjonelt spor — **ikke** erstatning for `GET /api/week`.

## Publisering fra CMS

1. **Redigering:** Sanity Studio (`menu` / `menuContent`).
2. **Publish:**  
   - Studio **Publish**, eller  
   - **CP7:** `POST /api/backoffice/sanity/menu-content/publish` med `{ date }` (superadmin + `SANITY_WRITE_TOKEN`) — samme Sanity Actions-semantikk.

## Sjekkliste (paritet)

1. CMS kan **trigge publisering** (Studio + broker).  
2. Runtime bruker **publisert** perspektiv.  
3. Avtale styrer leveringsdager/tier.  
4. Preview/publish deler **samme** GROQ-filosofi for kundesynlig meny (se `CUSTOMER_VISIBLE_FILTER` i `lib/sanity/queries.ts`).  
5. Ingen dobbel menytabell i Postgres.
