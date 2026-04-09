# AI logging, audit, and kill-switch

## 1. What every AI action must log (minimum fields)

| Field | Requirement |
|-------|-------------|
| **timestamp** | UTC ISO |
| **environment** | dev / staging / live |
| **actor_type** | `umbraco_user` / `api_user` / `system_job` |
| **actor_id** | Opaque user key or service principal name |
| **correlation_id** | UUID per user action; **run_id** for jobs |
| **capability** | Stable enum e.g. `editor_ai.alt_suggest` |
| **content_target** | Umbraco node key + culture |
| **outcome** | `suggested` / `applied` / `rejected` / `error` |
| **policy_version** | Prompt/policy pack version hash |
| **token_usage** | Optional; for cost controls — **no** PII in metadata |

## 2. Actor identity requirements

- **Interactive:** Must map to **real** Umbraco account (no shared “AI user”).
- **Batch:** Must use **dedicated** API User; **never** personal backoffice login.

## 3. Where logs go

| Stream | Owner |
|--------|-------|
| **Application / proxy logs** | Platform admin → SIEM or Cloud logging |
| **Umbraco audit trail** | CMS admin — authoritative for **content + workflow** post-apply |
| **Cost / usage dashboards** | Finance + Engineering |

*Exact sink names = **manual platform** (`71`).*

## 4. Retention

| Class | Minimum |
|-------|---------|
| **Security-relevant** (apply/reject, errors) | Align with company policy (e.g. 12–24 months) — **explicit** decision |
| **Debug verbose** | ≤ 14 days unless incident |

## 5. Alerts (must trigger)

| Condition | Severity |
|-----------|----------|
| Spike in **errors** from AI proxy | P2 |
| **Apply** without preceding **suggest** event (integrity anomaly) | P1 |
| Cross-tenant id in request | P1 |
| Kill-switch flipped | P3 informational |

## 6. Kill-switch

| Aspect | Rule |
|--------|------|
| **Mechanism** | Env flag `AI_EDITOR_ENABLED=false` (name TBD) + **disable API route** |
| **Scope** | Prefer **per-capability** toggles + global master |
| **Who flips** | CTO + Security (delegates documented) |
| **Editor UX** | Clear “AI unavailable” — **no** silent failure |
| **Verification** | Synthetic check post-flip: endpoint returns **disabled** |

## 7. Disablement verification checklist

- [ ] Global flag off
- [ ] Sample editor session: no AI panels / calls return disabled
- [ ] Metrics show **zero** successful AI completions
- [ ] Runbook updated with **who** and **when**

## 8. Forbidden logging

- Raw **PII** from operational systems in CMS AI logs
- **Provider API keys** or **Management** secrets
- Full prompt text if it contains **secrets** — use **redacted** copy or **class** id only
