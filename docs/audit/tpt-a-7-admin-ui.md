# TPT-A-7 — Admin UI (Tripletex Flow A, superadmin)

**Dato:** 2026-05-21  
**Plan:** TRIPLETEX-PLAN-V1 v3.6 §5 TPT-A-7  
**Forrige:** TPT-A-6 (`8705c27a`)

---

## Leveranse

| Side | Path | Datakilde |
|------|------|-----------|
| Oversikt | `/superadmin/tripletex` | `supabaseAdmin` (server) |
| Webhooks | `/superadmin/tripletex/webhooks` | `webhook_events` |
| Outbox-kø | `/superadmin/tripletex/queue` | `outbox` (`event_key LIKE tripletex.%`) |
| Fakturaer | `/superadmin/tripletex/invoices` | `provider_invoices` + `tripletex_exports` |

Guard: `app/superadmin/layout.tsx` (`getAuthContext`, `role === superadmin`).

Nav: `ControlTowerNav` → **Tripletex** (sekundær).

---

## Routing og UX

- **Mobile-first:** tabeller skjules på `< md`; kort-layout (`TripletexMobileRowCard`) med sentrert innhold.
- **Design:** `ds-card`, `ds-btn--primary` / `ds-btn--secondary`, `lp-table`, `lp-badge--*`.
- **Filter:** URL `searchParams` → server re-fetch (ingen prod-data i client bundle utover serialiserte rader).

---

## RPC: `lp_outbox_retry_event(p_event_id uuid)`

| Regel | Verdi |
|-------|--------|
| Guard | `public.is_platform_admin()` |
| Tillatt status | `PENDING`, `FAILED` |
| Effekt | `status=PENDING`, `attempts+1`, `last_error=null`, `next_retry_at=now()` |
| Audit | `lifecycle_audit_log` — `outbox_manual_retry` |
| Grant | `authenticated`, `service_role` |

Migrasjon: `20260527120000_tpt_a7_admin_ui.sql` (staging + prod MCP).

API: `POST /api/superadmin/tripletex/outbox/retry` — `{ event_id }` → RPC via `supabaseServer()`.

---

## Webhook manuell retry

`POST /api/superadmin/tripletex/webhooks/retry` — `{ id }` (webhook_events.uuid).

- Reset `PENDING` → `dispatchTripletexWebhookEvent` → `PROCESSED` / `FAILED`
- Audit: `tripletex_webhook_manual_retry`

---

## Manuell handling (operatør)

1. Åpne **Kø** → filtrer `FAILED` → **Retry** på én rad.
2. Cron `tripletex-outbox` eller `POST /api/system/outbox/process` plukker `PENDING`.
3. Ved webhook-feil: **Webhooks** → **Retry** på `FAILED` (re-dispatch lokalt).
4. **Fakturaer** → status + lenke til Tripletex UI (`TRIPLETEX_BASE_URL`).

---

## Tester

| Fil | Dekning |
|-----|---------|
| `tests/db/lp_outbox_retry_event.test.ts` | RPC guard, retry, audit, SENT blocked |
| `tests/components/tripletexAdminPages.test.tsx` | Badge, nav, queue retry fetch |

---

## Flow A status

**TPT-A-1 … TPT-A-7 ✅** — Flow A komplett i kode. R10 gjenstår: Tripletex test-env smoke + webhook-registrering hos Tripletex.
