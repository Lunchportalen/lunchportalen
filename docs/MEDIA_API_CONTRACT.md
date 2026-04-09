# Media API – kontrakt og sannhet

**Fasit for backend og frontend. Oppdateres når API eller kontrakt endres.**

## 1. Base URL og auth

- Alle ruter under `/api/backoffice/media/*` (items, upload, items/[id]) krever innlogget bruker.
- Rolle: **superadmin** (`requireRoleOr403`).
- Ved 401/403: standard `jsonErr` med `rid`, `message`, `status`, `error`.

## 2. GET /api/backoffice/media/items

**Request:** GET. Query: `source?` (`upload` | `ai`), `status?` (`proposed` | `ready` | `failed`), `limit?` (1–100, default 30), `offset?`.

**Response 200:** `{ ok: true, rid, data: { items } }`  
`items` er array med minst: `id`, `type`, `status`, `source`, `url`, `alt`, `caption`, `width`, `height`, `mime_type`, `bytes`, `tags`, `metadata`, `created_by`, `created_at`.  
**Kun rader som lar seg normalisere med gyldig `url` inkluderes.**

**Feil:** 500 `MEDIA_LIST_FAILED` ved DB-feil. Ved manglende tabell kan tom liste returneres (se implementasjon).

## 3. GET /api/backoffice/media/items/[id]

**Request:** GET. `id` = UUID i path.

**Response 200:** `{ ok: true, rid, data: { item } }`.

**Feil:** 400 `BAD_REQUEST`, 404 `NOT_FOUND`, 500 `MEDIA_READ_FAILED`.

## 4. POST /api/backoffice/media/items (URL-registrering)

**Request:** JSON med **påkrevd** `url` (`http://` eller `https://`, maks lengde per validering). Valgfritt: `alt`, `caption`, `tags`, `width`, `height`, `mime_type`, `metadata`, **`displayName`** (lagres som `metadata.displayName`, maks 120 tegn), **`metadata.variants`** (normaliseres).

**Response 200:** `{ ok: true, rid, data: { item } }`.

**Feil:** 400 validering / URL, 500 `MEDIA_CREATE_FAILED` / `MEDIA_CREATE_NO_URL`.

## 5. POST /api/backoffice/media/upload (multipart)

**Request:** `multipart/form-data` med felt **`file`** (image/*, maks 10 MB). Valgfritt: **`displayName`**, `alt`, `caption`, `tags` (kommaseparert eller flere felt).

**Oppførsel:** Laster til Supabase Storage (`MEDIA_STORAGE_BUCKET` eller `media`), setter `media_items.url` til offentlig URL, fyller `mime_type`, `bytes`, `metadata` med bl.a. `storageBucket`, `path`, `originalName`, og `displayName` når oppgitt.

**Response 200:** `{ ok: true, rid, data: { item } }`.

**Feil:** 400 manglende fil / type / størrelse, 500 `MEDIA_UPLOAD_*` / `MEDIA_CREATE_*`.

## 6. PATCH /api/backoffice/media/items/[id]

**Request:** JSON med minst ett felt: `alt`, `caption`, `tags`, `status`, **`displayName`** (kortfelt som merges til `metadata.displayName`; tom fjerner), **`metadata`** (merge med eksisterende; `metadata.variants` normaliseres).

**Response 200:** `{ ok: true, rid, data: { item } }`.

**Feil:** 400 validering / ingen felter / ugyldig statustransisjon, 404, 500.

## 7. DELETE /api/backoffice/media/items/[id]

**Request:** DELETE. `id` = UUID.

**Response 200:** `{ ok: true, rid, data: { deleted: true } }`.

**Feil:** 400, 500 `MEDIA_DELETE_FAILED`.

**Merk:** Sletting fjerner kun rad i `media_items`; innhold som refererer til UUID kan bli foreldreløst — Mediearkiv viser advarsel.

## 8. JSON-kontrakt (enterprise)

- Suksess: `{ ok: true, rid, data }`
- Feil: `{ ok: false, rid, error, message, status }` (jf. prosjekt)

## 9. Livssyklus og sannhet

- **Kilde til sannhet:** `media_items` er autoritativ for metadata og URL-er.
- **Blokker** lagrer `imageId` / `mediaItemId` (UUID) og/eller URL-felt; server fyller visnings-URL med `resolveMedia` / `resolveMediaInNormalizedBlocks`.
- **Picker:** Bruker GET-listen; valg setter UUID + URL fra valgt element.

## 10. Frontend-sikkerhet

- Bruk `data.items` / `data.item` etter `ok: true`.
- For liste: defensiv sjekk av `url` før bildevisning (parser filtrerer allerede).
- Ved POST/PATCH: ikke vis «Lagret» før `data?.item?.url` er til stede der det er relevant.
