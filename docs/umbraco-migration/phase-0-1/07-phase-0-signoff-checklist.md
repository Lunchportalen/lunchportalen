# Phase 0 sign-off checklist

**Instructions:** Each box requires **initials + date** from the listed role. “N/A” is allowed only where a row explicitly states it; otherwise incomplete = **NOT READY**.

## Product owner

- [ ] I accept **Umbraco CMS on Umbraco Cloud** as the CMS platform for public website content (no parallel editorial product).
- [ ] I accept that **menu, week plans, orders, tenants, billing, logs** remain **outside** Umbraco editorial scope per `03-scope-boundary.md`.
- [ ] I accept that **cutover** cannot happen while **legacy write paths** exist for migrated content types (`01-ADR`).
- [ ] I accept **Phase 0–1** does not deliver migration — only **decision lock + foundation**.
- [ ] I have named owners for **manual platform actions** (`14-manual-platform-actions.md`).

## CTO / technical owner

- [ ] I confirm **Next.js** remains the **presentation/runtime shell** and that integration will use **server-side** secrets for Delivery/Media/API (`06-ai-and-access-model.md`).
- [ ] I confirm **Developer MCP** is **non-production** only and will not gate editorial operations.
- [ ] I confirm **API User** strategy and **forbidden combinations** (`11-access-rbac-and-api-users.md`).
- [ ] I confirm **no client-exposed management secrets** — any such design is rejected.
- [ ] I accept the **Cloud fit** risks and will drive **portal confirmations** in `04-cloud-fit-check.md`.

## Editorial owner

- [ ] I accept **Umbraco Workflow** as **mandatory** for governance parity (`05-workflow-governance-decision.md`).
- [ ] I accept baseline **approval stages** (draft → review → approve → publish) unless Security approves a **written** exception.
- [ ] I confirm **editor-facing AI** will run in **Umbraco context** after migration, not as a competing legacy editor plane.
- [ ] I have reviewed **`02-authority-boundary-matrix.md`** and have **no ambiguous shared authority** rows.

## Security / privacy owner

- [ ] I accept the **secrets matrix** responsibilities (`12-secrets-and-environment-matrix.md`).
- [ ] I accept **least-privilege API Users** and **no shared god-keys** for automation.
- [ ] I accept **attribution** requirements for AI and **kill-switch** requirement (`06-ai-and-access-model.md`).
- [ ] I confirm **DPA/residency** path for Umbraco Cloud is **in progress or verified** — if not verified, record as **blocker** with owner (`15-risk-register-phase-0-1.md`).

## Consolidated gate

- [ ] All four roles above completed.
- [ ] **ADR** `01-ADR-headless-umbraco-target.md` linked from internal program charter or roadmap index.
- [ ] Open **blockers** from `15-risk-register-phase-0-1.md` each have **owner + target decision date**.

**Phase 0 status:** READY FOR SIGN-OFF only when every mandatory box is checked.
