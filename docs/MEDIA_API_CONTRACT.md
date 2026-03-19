# Media API – kontrakt og sannhet

**Fasit for backend og frontend. Oppdateres kun når API eller kontrakt endres.**

## 1. Base URL og auth

- Alle ruter under `/api/backoffice/media/items` krever innlogget bruker.
- Rolle: **superadmin** (kreves av requireRoleOr403).
- Ved 401/403: standard jsonErr med rid, message, status, error.

## 2. GET /api/backoffice/media/items

**Request:** GET. Query: `source?` (upload | ai), `status?` (proposed | ready | failed), `limit?` (1–100, default 30).

**Response 200:**  
`{ ok: true, rid, data: { ok: true, rid, items } }` (jsonOk wrapper).  
`items` er array av objekter med minst: `id`, `type`, `status`, `source`, `url`, `alt`, `caption`, `width`, `height`, `mime_type`, `bytes`, `tags`, `metadata`, `created_by`, `created_at`.  
**Kun rader med gyldig `url` (ikke-tom string) inkluderes.** Frontend kan stole på at hvert element har `url`.

**Feil:**  
- 500 MEDIA_LIST_FAILED ved DB-feil.

## 3. GET /api/backoffice/media/items/[id]

**Request:** GET. `id` = UUID i path.

**Response 200:**  
`{ ok: true, rid, data: { ok: true, rid, item } }`.  
`item` har samme felter som listeelementer; `tags` og `metadata` er alltid objekt/array (aldri null).

**Feil:**  
- 400 BAD_REQUEST hvis id mangler.  
- 404 NOT_FOUND med melding «Medieelement ikke funnet.» når rad ikke finnes.  
- 500 MEDIA_READ_FAILED ved DB-feil.

## 4. POST /api/backoffice/media/items (opprettelse)

**Request:** POST. Body: JSON med **påkrevd** `url` (ikke-tom string, må starte med `http://` eller `https://`, maks 2048 tegn). Valgfritt: `alt` (maks 180 tegn), `caption` (maks 500 tegn eller null), `tags` (array av string, maks 20 tagger, hver maks 30 tegn).

**Oppførsel:**  
Dette er **URL-basert opprettelse**. Systemet lagrer en **referanse** (URL) til et bilde; det finnes **ingen** multipart fil-upload i denne ruten. Frontend som ønsker å «laste opp» fil må selv uploade til egen lagring (eller tredjepart), få URL, og deretter kalle POST med `url`. URL valideres før opprettelse: kun `http://` og `https://` tillatt (ikke `javascript:`, `data:`, etc.).

**Response 200:**  
`{ ok: true, rid, data: { item } }`.  
`item` har alltid `id` og `url`. Backend returnerer **aldri** 200 uten gyldig `url` i respons (ved manglende url fra DB: 500 MEDIA_CREATE_NO_URL).

**Feil:**  
- 400 BAD_REQUEST ved manglende/ugyldig JSON eller manglende `url`.  
- 400 URL_NOT_ALLOWED / URL_TOO_LONG ved ugyldig URL.  
- 400 VALIDATION_ERROR ved alt/caption/tags over grense.  
- 500 MEDIA_CREATE_FAILED ved insert-feil.  
- 500 MEDIA_CREATE_NO_URL hvis insert returnerer rad uten url.

## 5. PATCH /api/backoffice/media/items/[id]

**Request:** PATCH. Body: delvis oppdatering. Støttede felter: `alt` (maks 180 tegn), `caption` (maks 500 eller null), `tags` (array, maks 20 tagger, hver maks 30 tegn), `status` (proposed | ready | failed med tillatte overganger).

**Response 200:**  
`{ ok: true, rid, data: { ok: true, rid, item } }` med oppdatert rad.

**Feil:**  
- 400 ved valideringsfeil eller ingen felter å oppdatere.  
- 404 NOT_FOUND hvis element ikke finnes.  
- 400 INVALID_STATUS_TRANSITION ved ugyldig statusovergang.  
- 500 ved lese/oppdater-feil.

## 6. Hva som IKKE finnes

- **Fil-upload (multipart):** Ikke implementert i denne API-en. Opprettelse skjer med `url`.
- **Slett (DELETE):** Finnes ikke. Frontend skal ikke vise slett-knapp eller anta DELETE. Medierekorder er varige for å unngå ødelagte referanser i innhold.
- **Flytt / samlinger / arkiv:** Ikke del av denne kontrakten. Media er flat liste per miljø (superadmin).

## 7. Livssyklus og sannhet (first-class media)

- **Kilde til sannhet:** `media_items` i DB er autoritativ for metadata (alt, caption, tags, url). Blokker i innhold lagrer `url` (og ofte `alt`) i blokkens data; de refererer ikke til media_items med referansiintegritet.
- **Bruk:** Ingen brukssøk eller referanseskanning. Sletting av media er derfor ikke tilgjengelig (unngår foreldreløse referanser).
- **Picker:** Medievelgeren viser kun eksisterende elementer fra GET-listen. Nytt innhold legges til via Mediearkiv-siden (eller via AI-forslag i editoren som oppretter media_items). Ingen «last opp»-knapp i picker-modalen.
- **Alt-pipeline:** Alt-tekst oppdateres i Mediearkiv med PATCH; editoren kan hente alt via GET [id]. Bildeblokker lagrer src + alt i blokkdata (kan synkroniseres fra mediearkiv).

## 8. Frontend-sikkerhet

- Bruk alltid `response.data?.items` / `response.data?.item` (jsonOk wrapper).  
- For liste: sjekk at element har `url` før bildevisning (backend filtrerer allerede, men defensivt).  
- Ved 404 på [id]: vis «Medieelement ikke funnet» og ikke stille null.  
- Ved POST: ikke vis «Lagret» før `data?.item?.url` er til stede.
- Vis aldri en «Slett»-handling for media (DELETE finnes ikke).
