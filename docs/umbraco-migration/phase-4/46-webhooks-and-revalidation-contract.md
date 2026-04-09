# Webhooks and revalidation contract

## 1. Purpose

Define **which Umbraco events** matter for the **public website CMS read path**, what **downstream action** they trigger in Next (or edge), **payload/auth** expectations, and **what must never** cause public invalidation.

**No assumption** that webhooks are already wired — this is the **contract to implement** in Phase 5+.

## 2. Relevant Umbraco events (content plane)

*Exact event names depend on Umbraco major version and Cloud integrations — map to **equivalent** product events at implementation time.*

| Event class | Relevance |
|-------------|-----------|
| **Content published** (Workflow **live** / publish transition) | **Primary** — revalidate published routes and tags |
| **Content unpublished** | **Primary** — remove or 404 cached representations |
| **Content deleted** | **Primary** — same as unpublish + tag cleanup |
| **Content saved (draft)** | **Secondary** — **must not** broadly invalidate **published** cache |
| **Media saved / deleted** | **Primary** if URL changes or deletion affects **published** pages |
| **Content moved / slug changed** | **Primary** — invalidate old and new paths + redirect handling (redirect phase may consume this) |
| **Dictionary / culture changes** | **Tertiary** — if used for public chrome; scope narrowly |

## 3. Downstream actions

| Trigger | Action |
|---------|--------|
| **Publish / unpublish / delete** (migrated doc types) | `revalidateTag` for **content id**, **slug**, **type**; `revalidatePath` for **known** high-traffic routes if tag strategy insufficient |
| **Media change** | Invalidate **tags** linked to affected pages **or** global media tag (prefer **fine-grained** if dependency index exists) |
| **Bulk deploy / schema** | **Manual / pipeline** step: full `revalidatePath` **or** short maintenance window + **Delivery index rebuild** |

## 4. Payload / data requirements

| Field | Why |
|-------|-----|
| **Event type** | Route handler dispatches correctly |
| **Content key / id** | Tag invalidation |
| **Culture** (if variant-specific) | Avoid over- or under-invalidation |
| **URL / path** (optional) | Path-based purge |
| **Timestamp** | Idempotency + ordering hints |
| **Environment marker** | **Reject** if staging webhook hits production receiver |

## 5. Signature / authentication

| Rule | Detail |
|------|--------|
| **Shared secret** | HMAC signature header or Cloud-native verification — **secret in server env only** |
| **TLS** | HTTPS only |
| **Replay window** | Reject stale timestamps beyond N minutes (**N** set by Security, e.g. 5) |
| **IP allowlist** | Optional defense in depth if Cloud egress IPs stable |

## 6. Failure and retry

| Aspect | Contract |
|--------|----------|
| **Umbraco retry** | Rely on Cloud **delivery guarantees** where documented; otherwise **at-least-once** may duplicate |
| **Receiver idempotency** | **Must** tolerate duplicate deliveries |
| **Failure response** | Return **5xx** to encourage retry only if safe (no partial corrupt state) |
| **Dead letter** | Log + alert after threshold — **owner: Infra** |

## 7. Observability requirements

| Requirement | Detail |
|-------------|--------|
| **Structured logs** | Event type, id, culture, outcome |
| **Metrics** | Received, verified, applied, rejected |
| **Alerting** | Spike in failures or **zero** webhooks after deploy |
| **RID / correlation** | Align with enterprise API contract where applicable for internal routes |

## 8. What must never trigger public invalidation

| Forbidden trigger | Why |
|-------------------|-----|
| **Operational DB** writes (orders, menu) | Outside CMS scope |
| **Management API** generic hooks without scoping | Over-invalidation + attack surface |
| **Editor draft autosave** | Performance storm |
| **Non-production** webhooks → **live** receiver | Cross-environment corruption |

## 9. Webhook-driven revalidation vs migration tooling

| Concern | Owner |
|---------|--------|
| **Day-to-day publish freshness** | Webhooks → Next |
| **Bulk ETL import** | Migration jobs may **batch** revalidate or **disable** cache during window — **runbook outside Phase 4** |
| **Redirect catalog activation** | May share webhook **or** separate pipeline — must **not** double-publish conflicting slugs |

## 10. Implementation note

Concrete **Route Handler** path (e.g. `/api/revalidate/umbraco`) is **Phase 5+**. Phase 4 **only** requires the **contract** above be satisfied before go-live.
