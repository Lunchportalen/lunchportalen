# Social — source of truth (2D1)

**Dato:** 2026-03-28  
**Status:** Runtime MVP levert — **én** kanonisk DB-modell; **ingen** parallell social-tabell.

---

## 1. Kanonisk datamodell

| Lag | Kilde | Kommentar |
|-----|-------|-----------|
| **Persistens** | `public.social_posts` | `id` (text PK), `content` jsonb, `status` text, `scheduled_at`, `platform`, `published_at`, `external_id`, `variant_group_id`, tidsstempler. |
| **Innhold (JSON)** | `content` — foretrukket **`StandardSocialContentV1`** (`lib/social/socialPostContent.ts` med `v: 1`) | CMS PATCH (`/api/social/posts/[id]`) bruker `mergeSocialPostContent` for å **slå sammen** til v1 uten ny tabell. |
| **Status (tekst)** | `status` kolonne | Kanoniske verdier og overganger: `lib/social/socialPostStatusCanonical.ts`. |

---

## 2. Kanonisk APIflate (Lunchportalen / superadmin)

| Route | Formål |
|-------|--------|
| `GET /api/social/posts` | Liste (superadmin). |
| `POST /api/social/posts/save` | Batch upsert (superadmin) — uendret kontrakt, nå med **normalisert status** + **platform** fra kropp. |
| `PATCH /api/social/posts/[id]` | **2D1** — enkelt innlegg: statusovergang, innhold, `scheduled_at`. |
| `POST /api/social/posts/publish` | **2D1** — forsøk publisering (fail-closed). |
| `POST /api/social/ai/generate` | Utkast (deterministisk/AI) + valgfri persist via eksisterende motor. |

**CMS UI:** `/backoffice/social` — **canonical** redaktørflate for kalenderflyt.

---

## 3. Publish-flyt (fail-closed)

1. **Autonom executor** (`lib/social/executor.ts`): `publish` → `publish_policy_lock` (ingen ekstern post derfra).
2. **CMS publish API** (`/api/social/posts/publish`): kaller `publishFacebook` for `platform === facebook`; **stub** returnerer `dry_run` → **ingen** `published` i DB.
3. **LinkedIn/Instagram** i publish-API: returnerer `CHANNEL_NOT_ENABLED` (200, `published: false`) — ingen falsk suksess.

**Konklusjon:** Ekte «posted» i DB skjer kun når kanal-integrasjon returnerer faktisk post (ikke i dagens stub).

---

## 4. Aktive vs legacy spor

| Spor | Status |
|------|--------|
| **CMS Social kalender** (`/backoffice/social`) | **Aktiv** — primær IA for redigering/review/schedule. |
| **Superadmin AI Social Engine** (`/superadmin/growth/social`) | **Beholdt** — avansert motor/kalender; samme `social_posts`. Ikke deprecate i 2D1. |
| **Content workspace** `SocialContentCalendar` i `AiCeoPanel` | **Legacy lokal/kontekst** — ikke duplikat DB; fortsatt nyttig for sidekontekst. |
| **`lib/social/calendar.ts` `CalendarPost` typer** | **Legacy klientmodell** for motorer; DB-sannhet er `social_posts`. |

---

## 5. Ordre-/inntektskobling

- `orders.social_post_id` og attribusjon — **uendret**; ingen ny forretningssannhet i 2D1.
