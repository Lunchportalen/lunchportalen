# Credential rotation checklist — A-P1-01 follow-up

**Date:** 2026-05-25  
**Trigger:** Enterprise audit v2 Fase A — untracked `.env*` cluster in repo workspace ([`01-spike-cleanup.md`](../../docs/audit/enterprise-v2-2026-05-25/01-spike-cleanup.md) A-P1-01/02/03)  
**Status:** **RECOMMENDATION ONLY** — owner decides when to execute. No rotation performed in audit session.

---

## Context

Fourteen untracked env snapshot files contained live credential **values** (JWT, SMTP, tokens). They were **never committed** (`git log --all` = empty for each file). Rotation is a **safe-default hygiene step**, not proof of breach — but credentials sitting in a clone directory increase blast radius (backups, screen share, accidental commit).

**Affected snapshot files (keys present):**

| File | Env scope signal |
| --- | --- |
| `.env.local.prod-backup` | **Prod** — broadest set |
| `.env.prod-k6.tmp` | **Prod** — K6 + SMTP + Tripletex |
| `.env.vercel.pull.checkpoint` | **Prod** — Vercel pull |
| `.env.k6-staging-verify.tmp` | Staging |
| `.env.staging-check` / `.staging-check.tmp` / `.staging-pull.tmp` | Staging |
| `.env.sentry-diag-check` / `.sentry-diag-preview` / `.sentry-staging-check` | Mixed |
| `.env.preview-cron.tmp` | Preview |

**Additional non-env exposures (same rotation set where applicable):**

| File | Secret type |
| --- | --- |
| `.smoke-provision.meta.json` | Smoke user password |
| `.dc028-secret.tmp` | Opaque 32-char token (purpose unknown — rotate if mapped to a service) |

---

## Priority tiers

| Tier | When | Rationale |
| --- | --- | --- |
| **P0-equivalent (do first if rotating at all)** | Same day | Full bypass / write access |
| **P1** | Within 7 days | Webhooks, cron, email send |
| **P2** | Within 30 days | Read-mostly or rotatable without outage window |

---

## Rotation roster (safe-default)

### 1. Supabase — service role (P0-equivalent)

| Item | Var names | Environments | Found in A-P1 files |
| --- | --- | --- | --- |
| Service role JWT | `SUPABASE_SERVICE_ROLE_KEY` | **Prod** + **Staging** | All 14 env snapshots |

**Prod project:** `hkpokyapzarefrgqzkos`  
**Staging project:** `uigxsboqeruxflgzqztl`

| Step | Action | Owner |
| ---: | --- | --- |
| 1 | Supabase Dashboard → Project Settings → API → **Reset service_role key** (prod) | Owner |
| 2 | Repeat for staging project | Owner |
| 3 | Update **Vercel** env (Production + Preview + Staging targets) | DevOps |
| 4 | Update local `~/.lp-secrets/` files (see onboarding) — **not** repo root | Each dev |
| 5 | Redeploy Vercel; verify `/api/health`, cron outbox, superadmin system | DevOps |
| 6 | Re-run smoke/K6 provision scripts with new secrets | QA |

**Also in prod backup (rotate with service role if resetting DB access):**

| Item | Var names |
| --- | --- |
| DB password | `SUPABASE_DB_PASSWORD`, `DATABASE_URL`, `SUPABASE_POSTGRES_URL` |

Reset via Supabase → Database settings → reset password; update Vercel + local secrets.

---

### 2. Supabase — anon / publishable key (P2)

| Item | Var names | Notes |
| --- | --- | --- |
| Anon key | `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Public in client bundle; rotate if paranoid or key leaked in private snapshot |

Rotate in Supabase API settings → update Vercel **NEXT_PUBLIC_*** → redeploy.

---

### 3. Sentry (P1)

| Item | Var names | Found in |
| --- | --- | --- |
| DSN (server) | `SENTRY_DSN` | prod-k6, preview, staging-pull, sentry-* |
| DSN (client) | `NEXT_PUBLIC_SENTRY_DSN` | Same subset |
| Auth token | `SENTRY_AUTH_TOKEN` | Same subset |
| Org/project | `SENTRY_ORG`, `SENTRY_PROJECT` | Metadata only — no rotation |

| Step | Action |
| ---: | --- |
| 1 | Sentry → Settings → Auth Tokens → revoke old `SENTRY_AUTH_TOKEN`; create new with minimal scope |
| 2 | Optional: rotate DSN (Project Settings → Client Keys) if treating snapshot as leak |
| 3 | Update Vercel + local secrets; redeploy |

---

### 4. SMTP / email (P1)

| Item | Var names | Found in |
| --- | --- | --- |
| LP SMTP | `LP_SMTP_HOST`, `LP_SMTP_USER`, `LP_SMTP_PASS`, `LP_SMTP_PORT`, `LP_SMTP_SECURE` | prod-backup, prod-k6, vercel.pull |
| Legacy SMTP | `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS`, … | prod-backup |
| Resend | `RESEND_API_KEY` | prod-k6, preview, sentry-diag-preview |
| Resend from | `LP_RESEND_FROM`, `LP_RESEND_LIVE_SEND` | Config — not secret |

| Step | Action |
| ---: | --- |
| 1 | Mail provider / Resend dashboard → rotate password or API key |
| 2 | Update Vercel Production + Preview |
| 3 | Send test via cron or `/api/cron/daily-order-summary` dry path |

---

### 5. Sanity (P1)

| Item | Var names | Found in |
| --- | --- | --- |
| Write token | `SANITY_WRITE_TOKEN`, `SANITY_API_TOKEN` | All snapshots |
| Webhook HMAC | `SANITY_WEBHOOK_SECRET` | Most snapshots |
| Project/dataset | `NEXT_PUBLIC_SANITY_*` | Public metadata |

| Step | Action |
| ---: | --- |
| 1 | sanity.io → Project → API → Tokens → revoke + create new write token |
| 2 | Regenerate webhook secret in Sanity webhook config + matching Vercel env |
| 3 | `npm run sanity:live` smoke |

---

### 6. Vercel automation (P1–P2)

| Item | Var names | Found in |
| --- | --- | --- |
| Automation bypass | `VERCEL_AUTOMATION_BYPASS_SECRET` | `.env.staging-pull.tmp` only |
| OIDC token | `VERCEL_OIDC_TOKEN` | Build-injected — **short-lived**; low priority |
| Personal/team token | (not in snapshots) | Rotate if used to generate `.env.vercel.pull.checkpoint` |

| Step | Action |
| ---: | --- |
| 1 | Vercel → Project → Deployment Protection → rotate bypass secret |
| 2 | Revoke/regenerate any personal token used for `vercel env pull` if stored outside Vercel |

---

### 7. Tripletex (P1 — if integration active)

| Item | Var names | Found in |
| --- | --- | --- |
| Consumer token | `TRIPLETEX_CONSUMER_TOKEN` | k6-staging, staging-check.tmp, staging-pull, sentry-diag-check, prod-k6 |
| Employee token | `TRIPLETEX_EMPLOYEE_TOKEN` | *(not in key list — verify vault if used)* |
| Environment | `TRIPLETEX_PROVIDER_ENV`, `TRIPLETEX_BASE_URL` | Config |

| Step | Action |
| ---: | --- |
| 1 | Tripletex → API access → revoke consumer token; issue new |
| 2 | Update Supabase Vault / provider credential store per `TPT-B-1` pattern |
| 3 | Update Vercel env; run Tripletex connection health cron |

---

### 8. Platform secrets (P1)

| Item | Var names | Found in |
| --- | --- | --- |
| Cron auth | `CRON_SECRET` | All snapshots |
| System motor | `SYSTEM_MOTOR_SECRET` | All snapshots |

| Step | Action |
| ---: | --- |
| 1 | Generate new high-entropy values (≥32 bytes) |
| 2 | Update Vercel **Production, Preview, Staging** consistently |
| 3 | Verify `Authorization: Bearer` on `/api/cron/*` routes |

---

### 9. Other secrets (prod-backup only — P1 if values were real)

| Item | Var names | Notes |
| --- | --- | --- |
| OpenAI | `OPENAI_API_KEY` | `.env.local.prod-backup` |
| Google SA | `GOOGLE_SERVICE_ACCOUNT_KEY` | JSON key — revoke in GCP IAM |
| Backoffice CMS | `BACKOFFICE_CMS_PASSWORD` | Umbraco/backoffice test account |
| E2E superadmin | `E2E_SUPERADMIN_EMAIL`, `E2E_SUPERADMIN_PASSWORD` | Test user — rotate password in Supabase Auth |
| Smoke provision | password in `.smoke-provision.meta.json` | Reset smoke user in Supabase Auth |

---

### 10. JWT-er (generic)

Any value matching `eyJ…` in snapshots is a **Supabase JWT** (service_role or anon) or similar — covered above. After rotation, **delete local snapshot files** (user action, post-rotation).

---

## Suggested execution order (single maintenance window)

```
1. CRON_SECRET + SYSTEM_MOTOR_SECRET  (quick, unblocks cron tests)
2. SUPABASE_SERVICE_ROLE_KEY        (prod → staging)
3. SANITY_WRITE_TOKEN + WEBHOOK_SECRET
4. RESEND_API_KEY / SMTP
5. SENTRY_AUTH_TOKEN (+ DSN if desired)
6. TRIPLETEX_CONSUMER_TOKEN          (if prod billing active)
7. SUPABASE_DB_PASSWORD               (optional, requires connection string updates)
8. OPENAI / GOOGLE / E2E / smoke      (prod-backup only)
```

**Estimated effort:** 2–4 hours with Vercel access + Supabase admin + redeploy verification.

---

## Post-rotation verification checklist

- [ ] `npm run preflight` green locally (with new `~/.lp-secrets/local.env`)
- [ ] Vercel Production deploy succeeded
- [ ] `/api/health` → `{ ok: true }`
- [ ] `/api/cron/outbox` POST with new `CRON_SECRET` → 200
- [ ] Login + `/api/me` + `/api/week` (employee smoke)
- [ ] Sanity webhook test event
- [ ] Sentry test event received
- [ ] All A-P1 snapshot files **deleted from repo directory**
- [ ] `.gitignore` patch applied (see Fase A doc)

---

## Decision log (owner)

| Field | Value |
| --- | --- |
| Rotation approved? | ☐ Yes / ☐ No / ☐ Partial |
| Date executed | |
| Executed by | |
| Scope | ☐ Full roster / ☐ Tier P0 only / ☐ Custom |
| Notes | |

---

*Generated from enterprise audit v2 Fase A. No secrets reproduced in this document.*
