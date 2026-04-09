# U30X — Settings runtime

## Status

- `app/(backoffice)/backoffice/settings/page.tsx` var allerede løftet (U29R/U30R): operative kort, code-governed tekst.
- **U30X:** `settings/document-types/page.tsx` fikk arbeidsflate-stripe: «Tilbake til innstillinger», seksjonsmerke «System · typestyring», snarvei «Gå til innhold».
- **Ingen** falsk CRUD lagt til — bevisst.

## Anbefaling

- Ved neste runde: én felles «Settings»-understripe (breadcrumb: Innstillinger → Document types) delt av alle `/backoffice/settings/*` sider — krever layout-fil.
