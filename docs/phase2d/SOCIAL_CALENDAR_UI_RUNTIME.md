# Social Calendar — UI / IA (2D1)

**Canonical route:** `/backoffice/social`  
**Rolle:** Kun **superadmin** (samme som resten av backoffice).

---

## 1. IA

- **Én H1:** «Social kalender».
- **Signaler:** Liste over innlegg med status-badge + plattform.
- **Primær handling:** «Generer utkast» (kobler til `POST /api/social/ai/generate` med deterministisk motor).

---

## 2. Navigasjon

- **Backoffice TopBar:** ny fane **Social** (`/backoffice/social`, ikon `globe`).
- **Superadmin capabilities:** `bo-social-calendar` → samme URL (`lib/superadmin/capabilities.ts`).
- **Lenke** til `/backoffice/media` for bilde-URL (ingen ny media-sannhet).

---

## 3. Statusvisning

Badges gruppert etter `statusDisplayKey` (draft / in_review / approved / scheduled / published / failed / cancelled) med tydelige farger (nøytral, amber, sky, violet, grønn, rød, grå).

---

## 4. Ikke-mål

- Ingen egen «v2»-shell — bruker `BackofficeShell` + eksisterende layout.
- Ingen parallell superadmin-only liste som erstatter CMS; superadmin motor-sider forblir tilgjengelige.
