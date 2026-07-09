# Staging sync routine — `main` → `staging` (manual fast-forward)

**Status:** Operations runbook · **not** auto-rollout · **not** production promote  
**Scope:** `staging.app.lunchportalen.no` only (Vercel Git branch `staging`)  
**Last verified:** 2026-07-03 (SMART-4 @ `e214708a`)

This routine documents how to align **`origin/staging`** with **`origin/main`** after merges that must be verified on staging. It does **not** change production, env vars, flags, cutover, source-of-truth, or auto-rollout.

---

## 1. When to use

| Use | Do not use |
|-----|------------|
| After a PR is merged to `main` and staging must reflect that commit | Production promote |
| Staging verification / smoke / RC evidence | Cutover or flag activation |
| Docs-only or runtime merges that need staging health check | Automatic deployment without owner review |

**Deploy model (locked):** Vercel **Strategy A** — `staging.app.lunchportalen.no` deploys from Git branch **`staging`**, not from `main`. Merges to `main` alone do **not** update staging until this routine runs.

Related: [staging-strategy.md](../staging-strategy.md), [smart-menu-smart-4-staging-evidence.md](../architecture/smart-menu-smart-4-staging-evidence.md).

---

## 2. Pre-checks

```bash
git fetch origin
git rev-parse origin/main
git rev-parse origin/staging
git log --oneline origin/staging..origin/main
git log --oneline origin/main..origin/staging
```

Optional dry-run helper (check-only, **no push** by default):

```bash
node scripts/staging/verify-main-to-staging-fast-forward.mjs
node scripts/staging/verify-main-to-staging-fast-forward.mjs --expected-main <sha>
```

---

## 3. Required safe state

| Rule | Requirement |
|------|-------------|
| Fast-forward only | `origin/staging..origin/main` may have commits; **`origin/main..origin/staging` must be empty** |
| No divergent staging | Staging must not contain commits absent from `main` |
| Review diff | Commits on `main` not yet on `staging` must be expected (no surprise production/env/flag changes) |
| Owner intent | Staging promote is **manual** — not CI-automated |

**STOP** if staging is ahead of or diverged from `main`. Resolve with owner before force-push or merge.

---

## 4. Promotion command

Replace `<origin-main-sha>` with the verified `git rev-parse origin/main` value:

```bash
git push origin <origin-main-sha>:staging
```

Example (2026-07-03):

```bash
git push origin e214708a58bec682227661da9e5938c073ef1e38:staging
```

**Do not** push local `main` if it diverges from `origin/main`. Push the **remote main SHA** ref explicitly.

---

## 5. Post-check

1. Wait for Vercel staging deploy (~3–10 minutes).
2. Verify health commit:

```bash
# Requires VERCEL_AUTOMATION_BYPASS_SECRET in .env.local for protected staging
curl -s -H "x-vercel-protection-bypass: $VERCEL_AUTOMATION_BYPASS_SECRET" \
  https://staging.app.lunchportalen.no/api/health | jq .data.version
```

3. Run staging smoke / probe (local temp scripts are OK; do not commit probe artifacts).
4. Confirm:

| Check | Expected |
|-------|----------|
| Health commit | Equals promoted SHA (or newer redeploy of same tree) |
| Production touched | **NO** |
| Production env/flags | **NO** |
| `LP_MENU_PROFILE_*` | **NOT activated** |
| G5d.8 / cutover / SOT / auto-rollout | **NOT started** |
| Employee runtime | Unchanged unless the merged PR intentionally changed employee read path |
| Commercial exposure | None to employee |

---

## 6. STOP conditions

Stop and escalate to owner if any of the following:

- `origin/main..origin/staging` is **not empty** (staging ahead or diverged)
- Fast-forward is **not possible**
- `origin/main` is not the expected merge SHA
- Diff from staging→main includes unintended production/env/flag/migration changes
- Vercel staging deploy **fails**
- Health commit **does not match** promoted SHA after deploy window
- Staging smoke shows regression (auth, order identity, tenant isolation, commercial leak)

---

## 7. Evidence report template

Copy after each promote:

```text
Status: Staging promote

Origin main:           <sha>
Origin staging before: <sha>
Origin staging after:  <sha>
Fast-forward:          PASS | FAIL
Deploy status:         PASS | FAIL | AWAITING
Health commit:         <sha>
Runtime smoke:         PASS | FAIL | PARTIAL
Employee runtime:      PASS | FAIL
Commercial exposure:   NONE | FAIL
Production touched:    NO
Flags:                 NOT activated
G5d.8/cutover/SOT:     NOT started
Recommendation:        <one line>
```

---

## 8. Explicit non-events

This routine does **not**:

- Deploy or change **production** (`app.lunchportalen.no`)
- Modify production env vars or `LP_MENU_PROFILE_*` flags
- Start G5d.8, cutover, source-of-truth switch, or auto-rollout
- Replace Supabase migrate workflows or DB push to prod
- Commit local temp/probe/snapshot/evidence files

---

## 9. Recommendation

After each staging-relevant merge to `main`, run §2 pre-checks → §4 promote → §5 post-check → §7 evidence. Keep a short log in PR/evidence docs when promote was required (SMART-3/SMART-4 history shows staging lag without this step).
