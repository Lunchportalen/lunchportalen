# Social — review og redigering (2D1)

---

## 1. Redigering

- **Tekst / hashtags / bilde-URL / kanal:** `PATCH /api/social/posts/[id]` med felter `caption` (alias `text`), `hashtags`, `imageUrl`, `platform`.
- Innhold merges til **`StandardSocialContentV1`** via `lib/social/socialPostContentMerge.ts` (samme JSONB-kolonne).

---

## 2. Review-flyt (knapper i UI)

| Knapp | API-kall | Forutsetning |
|-------|----------|----------------|
| Send til gjennomgang | `PATCH { status: "in_review" }` | `displayGroup === draft` |
| Godkjenn | `PATCH { status: "approved" }` | `in_review` |
| Tilbake til utkast | `PATCH { status: "draft" }` | `in_review` |
| Sett planlagt | `PATCH { status: "scheduled", scheduled_at: ISO }` | `approved` + utfylt `datetime-local` |
| Avbryt | `PATCH { status: "cancelled" }` | ikke terminal |

Overganger valideres server-side med `canTransitionSocialPostStatus` (unntatt `published` via PATCH — se nedenfor).

---

## 3. Generer utkast

- `POST /api/social/ai/generate` med `mode: "deterministic"`, `persist: true`, valgfri `platform`.
- Bruker eksisterende `executeUnifiedSocialGenerate` / `saveUnifiedSocialPost` — **ingen** ny AI-orchestrator.

---

## 4. Media

- Bilde vises via **URL** fra mediebiblioteket; ingen ny lagringstabell i 2D1.
