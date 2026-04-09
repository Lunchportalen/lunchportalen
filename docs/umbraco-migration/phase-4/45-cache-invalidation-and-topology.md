# Cache, invalidation, and topology

## 1. Goals

| Goal | Detail |
|------|--------|
| **Fast published pages** | Cache published Delivery responses or mapped DTOs where safe |
| **Correct freshness** | Publish and **Workflow live** transitions **eventually** invalidate stale public views within agreed SLO |
| **Preview isolation** | Preview **never** reads from published **output** cache (`43-preview-contract.md`) |
| **No vague “TBD”** | Where numbers unknown, **decision framework + owner** required |

## 2. Published delivery caching rules

| Layer | Policy |
|-------|--------|
| **Next Data Cache (`fetch`)** | **May** cache published Umbraco fetches with **tag** or **time-based** revalidation — **tags** aligned to content id/slug |
| **Full Route Cache** | **May** apply to **published** marketing routes **only** if **revalidatePath/tag** wired from webhooks |
| **CDN / edge** | **May** cache **published** HTML/static fragments per host policy |
| **Default stance pre-Scale review** | Prefer **tag-based** invalidation on publish over **long immutable TTL** without webhooks |

### TTL decision framework (owner: CTO + lead dev)

| Stage | Max `revalidate` (indicative) | Condition |
|-------|-------------------------------|-----------|
| **Early staging** | 0–60s | Until webhooks proven |
| **Staging signoff** | 60–300s + webhooks | Webhook receipt ≥ 99% success over test window |
| **Live** | Product-chosen + **mandatory** webhook on publish | Numeric SLA recorded in ops runbook |

**If exact TTL unknown:** record **upper bound** and **fallback polling** forbidden for live — webhooks are **required** for publish freshness (see `46`).

## 3. Preview bypass rules

| Mechanism | Rule |
|-----------|------|
| **Route segment** | Preview uses **distinct** route or **query** with **server-only** validation — not same static path as published without `dynamic` |
| **`fetch`** | `cache: 'no-store'` or equivalent for preview |
| **Tags** | **No** `revalidateTag` from published webhook that repopulates **preview** shell with cached draft |

## 4. Webhook-triggered invalidation (summary)

**Detail:** `46-webhooks-and-revalidation-contract.md`.

| Principle | Detail |
|-----------|--------|
| **Publish / unpublish** | **Must** trigger downstream invalidation |
| **Draft save** | **Must not** alone wipe **published** CDN for public URLs |

## 5. Stale content tolerance

| Scenario | Tolerance |
|----------|-----------|
| **Editor expects “now” after publish** | **≤ 60s** on live once webhooks live — **stricter** if marketing SLA demands |
| **Infra outage** | Document **manual** revalidation runbook — **owner: platform admin** |
| **Index lag** | **Not acceptable** as normal — **rebuild index** if Delivery returns stale tree |

## 6. Environment differences

| Env | Published cache aggressiveness |
|-----|-------------------------------|
| **dev** | Often `revalidate: 0` — acceptable |
| **staging** | Mirror live policy **before** go-live signoff |
| **live** | Strict webhook + tag discipline |

## 7. Load-balanced / distributed cache decisions

| Deployment | Requirement |
|------------|---------------|
| **Single Next instance** | In-memory **safe** for Data Cache; webhook any instance must **revalidate** globally (Next **tag** invalidation is instance-local unless using **shared** handler pattern) |
| **Multiple Next instances** | **Required:** webhook endpoint processes on **each** deployment **or** uses **shared** invalidation bus (Redis pub/sub, platform feature) — **decision owner: CTO** before multi-instance live |

**Anti-pattern:** Webhook hits **one** random instance; others serve stale until TTL.

## 8. Per-instance vs shared-cache sensitive

| Sensitive | Why |
|-----------|-----|
| **In-memory Data Cache** | Per instance — webhook **must** fan out or TTL must be short |
| **CDN** | Shared — purge/tag API must be called **once** per edge policy |
| **Umbraco Cloud CDN** | Follow vendor semantics for Media vs HTML |

## 9. Anti-patterns to reject

| Anti-pattern | Reject |
|--------------|--------|
| “**Eventually** users see it” without SLO | Unprofessional for RC marketing site |
| **Single long TTL** without webhooks | Predictable stale after publish |
| **Preview** hitting `s-maxage` public cache | Draft leakage risk |
| **Using** `unstable_cache` without tag strategy | Uncontrolled staleness |

## 10. Observability

| Signal | Owner |
|--------|-------|
| **Webhook success/fail rate** | Infra |
| **p95 time publish → visible** | Product + Engineering |
| **Cache hit ratio** | Infra (informational) |
