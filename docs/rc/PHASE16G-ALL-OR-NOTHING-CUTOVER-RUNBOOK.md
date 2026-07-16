# PHASE 16G — ALL-OR-NOTHING 21-COUNTRY PRODUCTION CUTOVER RUNBOOK

**Status:** DRAFT — **DO NOT EXECUTE**  
**Prerequisite:** `GLOBAL_21_READY = YES` (Phase 15G.3)  
**Current prerequisite state:** **NOT MET** (`AWAITING_EXTERNAL_APPROVAL`)  
**Candidate SHA (technical):** `b88aaf99780e0a5d71404e831fd87eb90031fb6e`  
**Production today:** app `98b3b15e…` · migration `20260818120000`  
**Locks:** Vercel production ignore-build ACTIVE · GitHub Production env protection ACTIVE  

This runbook is a planning artifact only. It must not be executed until Phase 15G.3
certifies `GLOBAL_21_READY = YES` with real human approvals and live credentials.

---

## Absolute constraints

1. No partial activation (20/21 or lower = abort).
2. One atomic 21-country activation transaction — all or nothing.
3. invoice_only retained; Stripe remains inactive.
4. Do not remove production locks until this runbook’s go decision.
5. Do not approve workflow `29464749465` unless it is the exact final migration
   job for the certified final migration head after 15G.3 freeze.
6. Rollback must reverse **all** markets atomically if any canary fails.

---

## Preflight (T-24h)

- [ ] `FINAL_GLOBAL_RC_SHA` frozen and equals production candidate tree
- [ ] Staging runtime SHA = frozen SHA; migration head certified
- [ ] TAX/LEGAL/INVOICE/E-INVOICE/PRIVACY 21/21 + LOCALIZATION 24/24
- [ ] All mandatory credentials VERIFIED or NOT_APPLICABLE
- [ ] Fresh production backup / PITR restore point recorded
- [ ] Write-freeze window communicated to operators
- [ ] Incident / tax / legal / product owners on bridge

---

## Cutover sequence (DO NOT RUN YET)

1. Confirm fresh backup/PITR restore point ID.
2. Freeze production writes (maintenance / order write gate).
3. Record production counters (orgs, orders, invoices, outbox, ledger).
4. Migrate production to final global migration head (approved workflow only).
5. Validate schema / RLS / SECURITY DEFINER search_path / functions.
6. Deploy exact `FINAL_GLOBAL_RC_SHA` to production (unlock temporarily if required, then re-lock).
7. Verify `/api/health` identity, Supabase=prod, Sanity=prod, invoice_only, Stripe=0.
8. Run one production canary per country (controlled non-fiscal path).
9. Verify currency / tax / invoice / legal snapshots per canary.
10. Verify e-invoice live path where mandatory (not mock).
11. Verify tenant security (cross-tenant / wrong-provider = 0).
12. Verify billing + 5% commission integrity on canary set.
13. Execute **one atomic** 21-country activation transaction.
14. Open all 21 markets simultaneously only if step 13 commits.
15. Run 10/10 health probes over ≥5 minutes.
16. Start global monitoring (outbox, activation, invoice, auth error budgets).
17. If any activation gate fails → roll back **all** markets atomically and restore prior deploy.

---

## Abort criteria (immediate)

- Any country missing REQUIRED approval or credential
- SHA mismatch on production health
- Migration ledger ≠ certified head
- Cross-tenant or wrong-provider signal
- Invoice/commission imbalance
- Stripe dependency introduced
- Atomic activation dry-run negative (removal-of-one-approval) fails to block

---

## Rollback

1. Revert activation transaction (all markets → pre-ACTIVE).
2. Repoint production alias to previous READY deployment.
3. Do **not** reverse migrations unless catastrophic and explicitly approved.
4. Preserve audit / approval / activation event history.
5. Re-enter Phase 15G.3 / 16G planning — do not hot-patch.

---

## Ownership

| Role | Owner (fill before execute) |
|------|-----------------------------|
| Release commander | TBD |
| Tax owner | TBD |
| Legal owner | TBD |
| Privacy owner | TBD |
| Invoice/e-invoice owner | TBD |
| Localization owner | TBD |
| Security owner | TBD |
| On-call SRE | TBD |

---

**Execution permitted only after Phase 15G.3 reports `GLOBAL_21_READY = YES` and `PHASE 16G = YES`.**
