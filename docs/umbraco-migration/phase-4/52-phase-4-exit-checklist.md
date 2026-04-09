# Phase 4 exit checklist — binary gate

**Rule:** Every row must be **YES** to sign off Phase 4. **NO** = not ready.

| # | Criterion | YES/NO |
|---|-----------|--------|
| 1 | Published read path **defined** as **Umbraco Content Delivery API** (explicit enablement) | |
| 2 | **DeliveryApiContentIndex** rebuild treated as **mandatory** operational step after model changes | |
| 3 | **Media Delivery API** treated as **separate** enablement from Content Delivery | |
| 4 | Preview contract **defined** with **server-side** and **client-side** responsibilities | |
| 5 | Preview **must not** share output cache with published | |
| 6 | **No browser** exposure of Delivery keys, preview secrets, webhook secrets, Management/API User secrets | |
| 7 | Cache / invalidation rules **documented** with **owner** for TTL decisions (`45`) | |
| 8 | Webhook → revalidation contract **documented** (events, payload, auth, retries, observability) | |
| 9 | **Protected content** decision **explicit** (`47`) | |
| 10 | Environment matrix **complete** for dev/staging/live (`48`) | |
| 11 | Manual platform actions **listed** with owners (`49`) | |
| 12 | Phase 4 risk register **accepted** by CTO or delegate (`50`) | |
| 13 | **No permanent dual-read** language in signed contracts — only **time-bounded** migration fallback | |
| 14 | **PB1–PB6** each **closed** **OR** has **named owner** + **decision date** + **risk acceptance** recorded (`51`) | |
| 15 | **Staging** Delivery + Media Delivery **verified working** (smoke evidence) — **not** “assumed” | |

## Hard rule

If row **15** is NO, **migration execution must not start** even if rows 1–14 are YES.

## Signatures (optional — process)

| Role | Name | Date |
|------|------|------|
| CTO | | |
| Solution architect | | |
| Security | | |
| Lead developer | | |
| Editorial lead | | |
