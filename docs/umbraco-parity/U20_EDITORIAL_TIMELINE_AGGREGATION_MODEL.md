# U20 — Editorial timeline aggregation model

## Spor som finnes i dag

| Spor | Lagring | Hendelser |
|------|---------|-----------|
| Postgres `content_audit_log` | DB | `workflow_change`, `publish`, `expire`, `workflow_blocked`, `release_execute` |
| Content workspace UI | Sidepaneler | Versjon/ recovery der implementert |
| Sanity Studio | Ekstern | Meny-dokumenter — versjonshistorikk |
| Uke & meny | Forklaring + runtime | Operativ vs redaksjonelt — ikke én logg |

## Domener med historikk

- **Innhold (CMS Postgres):** sterkest spor — `content_audit_log` + variant/publish API.
- **Sanity:** full historikk i Studio — ikke replikert i Postgres.
- **Uke/meny:** operativ sannhet + Sanity-kilde — **delvis** og må merkes.

## Enhetlig fortelling uten én teknisk motor

- **UX-lag:** «Siste hendelser (Postgres audit)» som **lesbar** liste med **kilde-badge** `Postgres · content_audit_log`.
- **Ingen** påstand om at listen dekker Sanity, uke eller superadmin-audit.

## Kildebadges / ærlighet

- `Postgres` — audit-rader.
- `Sanity` — kun lenke/tekst i strip (eksisterende).
- `Delvis` — der rollback ikke er global.

## Hva som må vente

- Sammenslåing med `ai_activity_log` eller `audit_events` — kun etter eksplisitt kontraktsgjennomgang.
