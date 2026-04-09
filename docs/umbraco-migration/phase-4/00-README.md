# Umbraco migration — Phase 4 package

This folder contains an **execution-grade contract pack** for **Phase 4 only**: **published delivery**, **preview**, **media delivery**, **caching / invalidation**, and **webhook → revalidation** — for **headless Umbraco on Umbraco Cloud** consumed by the **Next.js presentation shell**.

## What Phase 4 is

- **Contract definitions** between Umbraco (editorial authority) and Next (runtime).
- **Operational prerequisites** and **manual platform actions** named honestly.
- **Risk and blocker registers** scoped to delivery/read-path integrity.

## What Phase 4 is not

- No Delivery API client implementation, no preview routes, no ETL, no cutover logic, no content migration execution.
- No re-opening of authority boundaries, document types, or workflow mandate (locked in Phase 0–1 and Phase 2–3).

## Upstream source of truth (mandatory)

| Pack | Path |
|------|------|
| Phase 0–1 | [../phase-0-1/00-README.md](../phase-0-1/00-README.md) |
| Phase 2–3 | [../phase-2-3/00-README.md](../phase-2-3/00-README.md) |

## Artifact index

| File | Purpose |
|------|---------|
| [40-phase-4-master.md](./40-phase-4-master.md) | Scope, locks, non-goals, exit dependency |
| [41-published-delivery-contract.md](./41-published-delivery-contract.md) | Published read path: Delivery API contract |
| [42-next-fetch-and-mapping-contract.md](./42-next-fetch-and-mapping-contract.md) | Next consumption boundaries (no code) |
| [43-preview-contract.md](./43-preview-contract.md) | End-to-end preview (server + client); no cache sharing with published |
| [44-media-delivery-contract.md](./44-media-delivery-contract.md) | Media Delivery API separate from content Delivery |
| [45-cache-invalidation-and-topology.md](./45-cache-invalidation-and-topology.md) | Caching rules, preview bypass, topology decisions |
| [46-webhooks-and-revalidation-contract.md](./46-webhooks-and-revalidation-contract.md) | Events, payloads, auth, observability |
| [47-protected-content-decision.md](./47-protected-content-decision.md) | Explicit in/out scope for gated content |
| [48-environment-behavior-matrix.md](./48-environment-behavior-matrix.md) | Dev / staging / live behavior matrix |
| [49-manual-platform-actions-phase-4.md](./49-manual-platform-actions-phase-4.md) | Portal-only and non-repo tasks |
| [50-risk-register-phase-4.md](./50-risk-register-phase-4.md) | Phase 4 risks |
| [51-open-blockers-phase-4.md](./51-open-blockers-phase-4.md) | Blockers to Phase 4 signoff |
| [52-phase-4-exit-checklist.md](./52-phase-4-exit-checklist.md) | Binary gate before Phase 5 / migration execution |

### Optional structured extracts

| File | Purpose |
|------|---------|
| [delivery-contract-matrix.csv](./delivery-contract-matrix.csv) | Machine-readable delivery obligations |
| [media-contract-matrix.csv](./media-contract-matrix.csv) | Machine-readable media obligations |
| [environment-behavior-matrix.csv](./environment-behavior-matrix.csv) | Matrix extract for spreadsheets |
| [phase-4-risk-register.csv](./phase-4-risk-register.csv) | Risk rows for tracking tools |

## Intentionally deferred (later phases)

| Topic | Typical owner phase |
|-------|---------------------|
| Implementing `fetch` to Delivery API, route handlers, `draftMode`, preview UI | Phase 5+ (implementation) |
| ETL, redirect catalogs, cutover runbooks | Migration / cutover phases |
| Full visual QA parity preview vs live | Post-preview implementation |
| Operational data planes (menu, orders, week plans, tenants, billing) | **Never** in Umbraco for this program |

## Legacy pointer (current repo, read-only)

Today’s public marketing pages read **Postgres** (`content_pages` / `content_page_variants`) via `lib/cms/public/loadLivePageContent.ts` → `getContentBySlug`. Phase 4 defines the **target** contract; it does not describe that implementation as end state.
