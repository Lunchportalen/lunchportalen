# U25 — Replatforming gaps

Requirements that cannot reach **technical** Umbraco 17 identity on the current stack without larger work:

1. **Umbraco Management API** — .NET server with native document type / data type storage and validation pipeline.
2. **Persisted content type filters in DB** — editable without deploy.
3. **Distributed cache / Delivery API** — separate read models and cache invalidation semantics.
4. **Extension manifest runtime** — dynamic loading of editor extensions from package manifests (vs static Next bundles).

## Simulated defensibly on Next.js

- Workspace IA, settings hub, create wizard UX, envelope + allowlist governance, honest module posture labels.

## Prefer UX/flow parity

- Entity actions, bulk actions, history — incremental parity via existing routes and UI; full Umbraco feature surface remains **roadmap**, not U25.

## CMS control plane remains

- Tree, workspace, publish gate, AI governance surfaces — **no** new operational truth for orders/agreements/week.
