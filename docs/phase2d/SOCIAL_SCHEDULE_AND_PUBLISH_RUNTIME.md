# Social — schedule og publish (2D1)

---

## 1. Scheduling

- **Felt:** `social_posts.scheduled_at` (timestamptz), satt av `PATCH` når `scheduled_at` / `scheduledAt` sendes eller når status settes til `scheduled`.
- **Validering:** Status `scheduled` **krever** ikke-null `scheduled_at` (ellers 422 `SCHEDULE_REQUIRED`).

---

## 2. Publish

**Route:** `POST /api/social/posts/publish` med `{ id }`.

| Platform | Oppførsel |
|----------|-----------|
| **linkedin** / **instagram** | `published: false`, `CHANNEL_NOT_ENABLED` — **ingen** ekstern kall i denne leveransen. |
| **facebook** | Kaller `publishFacebook` → **stub** (`dry_run`) → respons `PUBLISH_DRY_RUN`, **ingen** oppdatering til `published` i DB. |
| **Fremtidig ekte post** | Når integrasjon returnerer `posted`, kan rad oppdateres med `status: published`, `published_at` (kode klar for den grenen). |

**Fail-closed:** Bruker får alltid forklarende banner i CMS ved avslag.

---

## 3. PATCH vs publish

- **`published` status** kan **ikke** settes via `PATCH` (overgang `scheduled → published` er blokkert i `canTransitionSocialPostStatus`).
- Kun **publish-endepunktet** (eller fremtidig jobb) skal sette `published` når integrasjon er ekte.

---

## 4. Cron

- Eksisterende `GET /api/cron/social` og autonome løkker — **ikke** endret i 2D1; fortsatt egne prosesser.
