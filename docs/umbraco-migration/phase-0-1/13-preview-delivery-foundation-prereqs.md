# Preview & delivery foundation prerequisites (Phase 1 lock — not implementation)

This document locks **prerequisites and decisions** only. It is **not** the preview feature spec.

## Locked now (program / architecture)

| Prerequisite | Lock |
|--------------|------|
| **Delivery API** must be **enabled** for headless consumption of published content | Required for Next shell to read Umbraco-published site content |
| **Content index** must be rebuildable after significant model/content changes | Operational reality — teams must know **how** in Cloud portal/docs |
| **Media Delivery API** treated as **separate enablement** from content Delivery | Confirm for target Umbraco Cloud version |
| **Preview** will require **both** server-side and client-side implementation **later** | No claim that either half is optional for “true preview” |
| **Preview bypasses output caching** | Next/app caching must not serve stale draft as live; explicit revalidate strategy **later** |
| **All AI publish rules** | Per `06-ai-and-access-model.md` — no silent publish |

## Deferred to Phase 4 (or later phase — named explicitly)

| Item | Why deferred |
|------|--------------|
| **Concrete preview URL design** (`draft` token, edge vs server) | Implementation phase |
| **Webhook → Next revalidation** contract | Implementation phase |
| **Visual parity QA** between preview and live | Content + front-end phase |
| **ISR/edge cache matrix** per route | Performance phase |
| **Protected content** (login-gated editorial preview of restricted docs) | Needs IA + Security decision |

## Blocked pending platform confirmation

| Item | Blocker |
|------|---------|
| Exact **Delivery API** URL patterns and auth headers | Cloud project must exist |
| **Media** CDN base URLs and transforms | Cloud + version |
| Whether **preview** uses a **separate** endpoint or **signed** query | Product version doc |
| **Distributed cache** (Redis etc.) for high read load | Traffic + architecture review — **decision required before scale**, not Phase 1 implementation |

## Distributed cache decision (lock: decision required later)

If Delivery read volume or multi-instance Next deployment requires shared cache, that is **explicit infrastructure decision** — Phase 1 only records: **“not assumed; must be decided under load evidence.”**

## Protected content handling

If any public site content is **authenticated** or **segmented** in future, **preview** must mirror that enforcement — **no public preview URLs** without auth for restricted content. Detailed design: **deferred**; obligation: **locked**.

## Summary

- **Phase 1** enables **portal toggles**, **documentation**, and **secret placeholders** — not Next routes.
- **Phase 2+** implements consumption; **Phase 4+** (or program-adjusted numbering) implements full preview UX.
