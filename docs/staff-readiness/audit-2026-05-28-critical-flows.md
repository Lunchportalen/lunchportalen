# Staff Readiness — Critical Flows Deep-Dive

**Dato:** 2026-05-28  
**Modus:** Read-only (kode-lesing + live `pg_get_functiondef` mot prod)  
**Supplement til:** [`audit-2026-05-28-full-sweep.md`](./audit-2026-05-28-full-sweep.md), [`audit-2026-05-28-live-verification.md`](./audit-2026-05-28-live-verification.md)

**Live RPC-bevis:** `node .tmp/fetch-rpc-defs.mjs` → `.tmp/rpc-defs.json` (prod `hkpokyapzarefrgqzkos`).

| RPC | Live signatur | def_len |
|-----|---------------|--------:|
| `lp_company_register` | 9× text/int params | 6359 |
| `lp_idem_begin` | `(scope, key, hash, ttl)` default ttl 86400 | 2870 |
| `lp_idem_complete` | `(scope, key, hash, response_json, response_code)` | 596 |
| `lp_order_set` | **6-arg** `(date, action, note, slot, choice_key, item_key)` | 15223 |

---

## Executive summary

| Flyt | Staff % | Mest alarmerende ubehandlet edge case |
|------|--------:|----------------------------------------|
| **1A Bedrift onboarding** | **62%** | Superadmin approve krever PENDING agreement — manuell create-route er 410 |
| **1B Ansatt invite** | **71%** | Dual accept-API; ingen audit ved accept; SMTP/Resend TTL inkonsistent |
| **2 Meny-publisering** | **68%** | `getClosedDatesForDate()` stub — stengte dager har ingen effekt |
| **3 Bestilling** | **72%** | Klient genererer **ny** Idempotency-Key per klikk → dobbeltbestilling ved race |
| **4 Avbestilling** | **58%** | **3+ HTTP cancel-paths**; `/api/order/cancel` oppdaterer kun `day_choices`, ikke `orders` |

**Vektet flyt-snitt:** **~66%**

---

# FLYT 1A — Bedrift onboarding

## 1. FLOW MAP

| # | Kilde | Destinasjon | Hva skjer | Kan gå galt | Håndtering |
|---|-------|-------------|-----------|-------------|------------|
| 1 | `/registrering` UI | `CompanyRegistrationForm.tsx:229` | POST JSON + `Idempotency-Key` header | Nettverksfeil | Generisk feilmelding |
| 2 | Form | `POST /api/public/register-company` | Server validering + consent | Manglende consent | 400 `CONSENT_REQUIRED` L173–175 |
| 3 | Route | `companies` count queries | Duplicate orgNr 24h / ACTIVE | Race mellom to submits | 409 L215–227; RPC advisory lock live |
| 4 | Route | `lp_company_register` RPC | PENDING company + registration + audit | RPC exception | Mapped 4xx L241–245 |
| 5 | Route | `company_registrations` UPDATE | Weekday tiers / commercial terms | Plan update fail | Logged; 200 anyway L281–283 |
| 6 | Superadmin UI | `POST …/agreements/[id]/approve` | `lp_agreement_approve_active` + invite + outbox email | Ingen agreementId | Knapp disabled L54 `RegistrationDecisionActions` |
| 7 | Outbox worker | SMTP / Resend | `company.approved:{agreementId}` | Outbox stuck | Cron `system/outbox/process` |

**Entry:** `components/auth/CompanyRegistrationForm.tsx` (ikke `PublicRegistrationForm` — den finnes ikke). Wrapper: `components/registration/PublicRegistrationFlow.tsx:9–31`.

## 2. KODE-EKSTRAKT

**Consent gate (route):**

```72:80:app/api/public/register-company/route.ts
function consentExplicitlyAccepted(body: RegisterBody): boolean {
  const candidates = [
    body.consent,
    body.consent_accepted,
    body.consentAccepted,
    body.accept,
    body.confirmAuthority,
  ];
  return candidates.some((v) => v === true);
}
```

**Duplicate orgNr + RPC:**

```208:239:app/api/public/register-company/route.ts
    const { count: recentCount, error: recentErr } = await admin
      .from("companies")
      .select("id", { count: "exact", head: true })
      .eq("orgnr", orgnr)
      .not("status", "in", "(CLOSED,TERMINATED)")
      .gt("created_at", new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString());
    // ...
    if ((activeCount ?? 0) > 0) {
      return err(rid, 409, "ALREADY_ACTIVE", "Dette organisasjonsnummeret er allerede registrert som aktiv kunde.");
    }

    const { data, error } = await admin.rpc("lp_company_register", {
      p_orgnr: orgnr,
      p_company_name: companyName,
      // ...
    });
```

**Live RPC — advisory lock + audit (prod):**

```
perform pg_advisory_xact_lock(… per orgnr …)
insert into audit_events (…) values ('company_registration_submitted', …)
-- ingen outbox på submit (verifisert: outbox=false i live def)
```

**Approve → outbox:** `app/api/superadmin/agreements/[agreementId]/approve/route.ts` L103–122 — `event_key: company.approved:{agreementId}`.

## 3. EDGE CASE MATRIX

| # | Edge case | Håndtert? | Hvor | Test? |
|---|-----------|-----------|------|-------|
| 1 | Duplicate orgNr ACTIVE | ✅ | Route L219–227; RPC `ORGNR_ALREADY` | Delvis mock |
| 2 | Duplicate orgNr <24h | ✅ | Route L208–217 | ❌ |
| 3 | Duplicate contact email | ❌ | Kun format L195 | ❌ |
| 4 | Abandoned form (partial) | N/A | Ingen server-side draft | ❌ |
| 5 | Rate limit public POST | ❌ | `anonRateLimitOk` finnes, ikke brukt | ❌ |
| 6 | reCAPTCHA / bot | ❌ | — | ❌ |
| 7 | GDPR privacy consent | ⚠️ | Authority checkbox only L636–643 form | Consent API test |
| 8 | Legacy `/api/public/onboarding/register` uten consent | ❌ | Parallel route | ❌ |
| 9 | Idempotency-Key header | ❌ | Sendt L233 form; route ignorerer | ❌ |
| 10 | Stripe/Vipps | ❌ | Manuell fakturering | N/A |
| 11 | Submit confirmation email | ❌ | Kun post-approve outbox | ❌ |
| 12 | Approve uten ledger agreement | ⚠️ | UI disabled; pipeline gap | ❌ |

## 4. STAFF-GRADE SCORECARD

| Dimensjon | Grade | Bevis |
|-----------|-------|-------|
| Idempotency | ❌ | Header sendt, ikke lest; RPC advisory lock kun orgNr |
| Audit trail | ⚠️ | RPC `audit_events` live; ingen HTTP audit på submit |
| Error handling | ✅ | Fail-closed validation; persistence verify L254–267 |
| Race conditions | ⚠️ | `pg_advisory_xact_lock` live; route pre-check race mulig |
| E2E test | ⚠️ | `tests/api/public-register-company.test.ts` — ikke approve chain |
| Observability | ⚠️ | `maybeLog` redacted email L287; ingen Sentry på route |

**Flyt 1A Staff: 62%**

## 5. GAP-LISTE

- Regenerer/gjenopprett superadmin agreement-draft flow (410 routes vs inbox «mangler ledger»).
- Rate limit + bot protection på public register.
- Ekte GDPR samtykke (personvern) + fjern legacy onboarding bypass.
- Bekreftelses-e-post ved submit (forventningsstyring).
- Wire eller fjern `Idempotency-Key` på registration.

---

# FLYT 1B — Ansatt invite

## 1. FLOW MAP

| # | Kilde | Destinasjon | Hva skjer | Kan gå galt | Håndtering |
|---|-------|-------------|-----------|-------------|------------|
| 1 | `app/admin/invite/InviteClient.tsx:171` | `POST /api/admin/invite` | Bulk loop per e-post | SMTP fail | Per-row failed i respons |
| 2 | Route | `employee_invites` INSERT | Token hash, 7d TTL | Unique `(company, email)` | `already_invited` L250–262 |
| 3 | E-post | SMTP nodemailer | Link `/register/employee?token=` | Bounce | Ikke sporet |
| 4 | Ansatt | `AcceptInviteClient.tsx:122` | `POST /api/auth/accept-invite` | Expired token | 400 L89–91 |
| 5 | Route | `auth.admin.createUser` | role `employee` + metadata | User exists | updateUserById L123–141 |
| 6 | Route | `profiles` wait + update | company_id binding | Company mismatch | 409 L179–184 |

**Orphan:** `app/admin/employees/invites/bulk/route.ts` — ingen callers (feilplassert page route).

## 2. KODE-EKSTRAKT

**Bulk invite loop:**

```238:275:app/api/admin/invite/route.ts
    for (const i of invites) {
      // already_exists / already_invited checks …
      const sent = await sendInviteEmail({ to: i.email, link, companyName: def.companyName });
      const expires_at = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7).toISOString();
      const ins = await admin.from("employee_invites").insert({ /* … */ });
    }
    await auditAdmin({ action: "admin.invite.bulk", /* … */ });
```

**Accept + createUser:**

```109:121:app/api/auth/accept-invite/route.ts
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email: invite.email,
      password,
      email_confirm: true,
      user_metadata: {
        role: "employee",
        company_id: invite.company_id,
        location_id: invite.location_id,
      },
    });
```

**DB constraint:** `20260219_employee_invites.sql` L102–104 — role må være `employee`.

## 3. EDGE CASE MATRIX

| # | Edge case | Håndtert? | Hvor | Test? |
|---|-----------|-----------|------|-------|
| 1 | Bulk same email 2× | ✅ | Request dedup L187–210 + DB unique | ❌ |
| 2 | Expired invite | ✅ | Accept L89–91 | ❌ |
| 3 | Role ≠ employee | ✅ | DB constraint + createUser | ❌ |
| 4 | Audit hvem inviterte | ✅ | `admin.invite.bulk` | ❌ |
| 5 | Audit ved accept | ❌ | — | ❌ |
| 6 | Rate limit e-post | ❌ | Cap 200 i orphan bulk only | ❌ |
| 7 | Email sendt, DB insert fail | ⚠️ | Marked failed L291–293 | ❌ |
| 8 | TTL 48h vs 7d | ⚠️ | `createEmployeeSingleInvite` vs bulk | ❌ |
| 9 | Resend vs SMTP paths | ⚠️ | To implementasjoner | ❌ |
| 10 | `listUsers` pagination | ⚠️ | accept L40–44 first page only | ❌ |

## 4. STAFF-GRADE SCORECARD

| Dimensjon | Grade | Bevis |
|-----------|-------|-------|
| Idempotency | ⚠️ | DB unique; ikke HTTP idempotency |
| Audit trail | ⚠️ | Send audited; accept ikke |
| Error handling | ✅ | Per-invite errors; fail-closed accept |
| Race conditions | ⚠️ | Unique index; email-then-insert gap |
| E2E test | ❌ | Kun `tests/invites/employeeInviteEmail.test.ts` helpers |
| Observability | ⚠️ | auditAdmin; ingen Sentry på accept |

**Flyt 1B Staff: 71%**

## 5. GAP-LISTE

- Fjern/konsolider orphan bulk route + dual accept APIs.
- Audit event på successful accept.
- En TTL + én e-posttransport.
- API/integration tests for accept-invite.
- Rate limit på invite sending.

---

# FLYT 2 — Meny-publisering (Sanity → App)

## 1. FLOW MAP

| # | Kilde | Destinasjon | Hva skjer | Kan gå galt | Håndtering |
|---|-------|-------------|-----------|-------------|------------|
| 1 | Sanity Studio | `menuDay` document | Validering + publish flags | Incomplete doc | Async uniqueness L7–38 |
| 2 | Sanity webhook | `POST /api/webhooks/sanity/menu-day` | HMAC verify → sync/delete | Bad signature | 401 L36–37 |
| 3 | Webhook handler | `syncMenuServiceDaysForPublishedMenuDay` | Match `agreement_delivery_days` weekday+tier | Zero agreements | Silent skip L71–73 |
| 4 | Sync | `menu_service_days` UPSERT | location scope | Weekend date | Skip `WEEKEND_OR_INVALID_DATE` |
| 5 | Cron Thu 12 UTC | `runMenuWeekRolloutCore` | Auto-fill varmrett N+3 BASIS+LUXUS | Meal bank <50 | Tier error collected |
| 6 | App read | `lib/cms/menuDay.ts` GROQ | Customer-visible filter | Multi-tier same day | `getMenuForDate` tar `[0]` |
| 7 | Order window | `/api/week` + guards | Tier fra agreement | closedDate | **Stub returnerer []** |

## 2. KODE-EKSTRAKT

**Webhook auth + publish gate:**

```27:38:app/api/webhooks/sanity/menu-day/route.ts
  const secret = safeTrim(process.env.SANITY_WEBHOOK_SECRET);
  if (!secret) {
    return jsonErr(rid, "SANITY_WEBHOOK_SECRET er ikke konfigurert.", 500, "WEBHOOK_SECRET_MISSING");
  }
  const okSig = await verifySanityWebhookSignature({ rawBody, signatureHeader: sig, secret });
  if (!okSig) {
    return jsonErr(rid, "Ugyldig webhook-signatur.", 401, "INVALID_WEBHOOK_SIGNATURE");
  }
```

**ENTERPRISE excluded from cron:**

```21:22:lib/menu-publish/runMenuWeekRolloutCore.ts
/** Sanity menuDay schema: BASIS + LUXUS only (Patch 12 / Patch 2.1 fail-closed). */
const ORDERED_PLAN_TIERS: PlanTier[] = ["BASIS", "LUXUS"];
```

**Tier bridge:**

```23:28:lib/cms/getProductPlan.ts
export function cmsPlanNameForAgreementTier(tier: AgreementPlanTier): CmsProductPlanName {
  if (tier === "BASIS") return "basis";
  if (tier === "LUXUS") return "luxus";
  return "enterprise";
}
```

**ClosedDate stub:**

```7:12:lib/sanity/getClosedDatesForDate.ts
export async function getClosedDatesForDate(isoDate: string): Promise<string[]> {
  try {
    void isoDate;
    return [];
  } catch {
    return [];
  }
}
```

## 3. EDGE CASE MATRIX

| # | Edge case | Håndtert? | Hvor | Test? |
|---|-----------|-----------|------|-------|
| 1 | menuDay uten agreement weekday | ✅ | Zero sync | webhook test |
| 2 | menuDay uten planTier | ✅ | 200 skip MISSING | webhook test |
| 3 | Broken mealIdea ref | ⚠️ | Sanity validation partial | ❌ |
| 4 | Webhook timeout → Sanity retry | ⚠️ | UPSERT idempotent | reconcile cron |
| 5 | Invalid signature | ✅ | 401 | webhook test |
| 6 | Cron dobbelkjøring samme dag | ✅ | Skip existing doc IDs | rollout test |
| 7 | ENTERPRISE auto-rollout | ❌ | Eksplisitt excluded L22 | rollout test L186 |
| 8 | Unpublish → MSDI orphan | ❌ | delete MSD only | ❌ |
| 9 | closedDate i prod | ❌ | Stub | ❌ |
| 10 | Webhook + manual ENTERPRISE | ✅ | Webhook syncer ENTERPRISE tier | order-window test |

## 4. STAFF-GRADE SCORECARD

| Dimensjon | Grade | Bevis |
|-----------|-------|-------|
| Idempotency | ✅ | UPSERT keys; reconcile backup |
| Audit trail | ⚠️ | Console log webhook; ingen audit_events |
| Error handling | ✅ | Fail-closed signature; tier errors isolated |
| Race conditions | ⚠️ | Reconcile 6h; eventual consistency |
| E2E test | ✅ | `menu-service-day-webhook.test.ts`, `menu-week-rollout.test.ts` |
| Observability | ⚠️ | rid on webhook; ingen Sentry wrap |

**Flyt 2 Staff: 68%**

## 5. GAP-LISTE

- Implementer `getClosedDatesForDate` + wire til week/order guards.
- MSDI cleanup on unpublish.
- Dokumenter ENTERPRISE manuell prosess (121 live menuDays, 0 weekTemplate).
- `revalidateTag` eller dokumenter force-dynamic strategi.
- Sanity broken-ref GROQ audit.

---

# FLYT 3 — Bestilling

## 1. FLOW MAP

| # | Kilde | Destinasjon | Hva skjer | Kan gå galt | Håndtering |
|---|-------|-------------|-----------|-------------|------------|
| 1 | `EmployeeWeekClient` confirm | `buildOrderWriteBody` L389 | `{date, action:set\|cancel}` | Choice missing | Client CHOICE_REQUIRED L1889 |
| 2 | Client | `POST /api/orders` | **Ny UUID** Idempotency-Key L1907 | Double-click | `inFlightRef` only |
| 3 | Route | Guards L258–317 | role, killswitch, company hold, agreement | Cancellations blocked | 503 |
| 4 | Route | `lp_idem_begin` L382–417 | scope `orders.write`, TTL **300s** | Hash mismatch | 400 IDEMPOTENCY_KEY_REUSE |
| 5 | Route | `lp_order_set` L420–427 | 6-arg live RPC | CUTOFF_PASSED | 409 mapped |
| 6 | RPC live | `orders` UPSERT + outbox | `order.set:…` + rollup | Duplicate row | 23505 → 409 |
| 7 | Route | `lp_idem_complete` | Cache response | — | Replay on retry |
| 8 | Client | `loadWindow` L1947 | Pessimistic refresh | Refresh fail after 200 | Error banner L1948 |

## 2. KODE-EKSTRAKT

**Client — ny idempotency key hver gang:**

```1900:1911:app/(app)/week/EmployeeWeekClient.tsx
        const body = buildOrderWriteBody(date, wantsLunch, choiceKey, itemKeyForOrder);

        const res = await fetch("/api/orders", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-rid": rid,
            "Idempotency-Key": generateIdempotencyKey(),
          },
```

**Server idempotency:**

```382:387:app/api/orders/route.ts
      const { data: beginData, error: beginErr } = await sb.rpc("lp_idem_begin", {
        p_scope: "orders.write",
        p_key: idemKey,
        p_request_hash: idemHash,
        p_ttl_seconds: 300,
      });
```

**Live `lp_order_set` cutoff (prod):**

```sql
if p_date < v_oslo_today then raise … 'CUTOFF_PASSED';
if p_date = v_oslo_today and v_oslo_time >= time '08:00' then raise … 'CUTOFF_PASSED';
```

**Live `lp_idem_begin`:** COMPLETED cache hit returns `response_json` + `response_code`; hash mismatch → `23514`.

## 3. EDGE CASE MATRIX

| # | Edge case | Håndtert? | Hvor | Test? |
|---|-----------|-----------|------|-------|
| 1 | Same Idempotency-Key retry | ✅ | lp_idem_begin hit | orders-idempotency.test |
| 2 | Different key, same payload | ❌ | Ny UUID client → 2 ordre | ❌ |
| 3 | Order 07:59:59 Oslo | ✅ | RPC `< 08:00` | ❌ live timing |
| 4 | Order 08:00:00.001 | ✅ | RPC `>= 08:00` | ❌ |
| 5 | menuDay missing Sanity | ⚠️ | API tier/item guards | order-window test |
| 6 | Wrong tier (Basis→Luxus) | ✅ | `resolveOrderDayItemPersist` | tier validation test |
| 7 | closedDate match | ❌ | Stub [] | ❌ |
| 8 | Network drop mid-POST | ⚠️ | Client retry = **new key** | ❌ |
| 9 | Supabase down | ✅ | 500 + idem_fail | partial test |
| 10 | Outbox fail, order OK | ✅ | best-effort fanout L630 | ❌ |
| 11 | Suspended employee | ✅ | company hold L297 | guards test |
| 12 | Date outside agreement | ✅ | preflight L306 | ❌ |

## 4. STAFF-GRADE SCORECARD

| Dimensjon | Grade | Bevis |
|-----------|-------|-------|
| Idempotency | ⚠️ | Server excellent; **client underminerer** |
| Audit trail | ⚠️ | Outbox + rollup; ingen order HTTP audit |
| Error handling | ✅ | Layered guards + mapped RPC errors |
| Race conditions | ⚠️ | 23505 duplicate; client race gap |
| E2E test | ⚠️ | `tests/api/orders-idempotency.test.ts`; no Playwright week |
| Observability | ✅ | `runInstrumentedApi`, opsLog on RPC fail L450 |

**Flyt 3 Staff: 72%**

## 5. GAP-LISTE

- Stabiliser `Idempotency-Key` per confirm-action (UUID ved modal open, reuse on retry).
- Playwright: week → order → refresh.
- Wire closedDate når implementert.
- Success audit event (optional enterprise).
- Client: tillat empty orderId on cancel L1916–1921 mismatch.

---

# FLYT 4 — Avbestilling

## 1. FLOW MAP — alle HTTP paths

| Path | Status | Brukes av | Mekanisme |
|------|--------|-----------|-----------|
| `POST /api/orders` `{action:"cancel"}` | **Production** | `EmployeeWeekClient` L1900 | `lp_order_set(CANCEL)` |
| `DELETE /api/orders` | Alias | API clients | `route.ts:684–686` |
| `POST /api/order/cancel` | «Canonical» registry | `lib/api/client` — **ingen UI callers** | `day_choices` UPDATE only |
| `POST /api/orders/cancel` | DEPRECATED | Legacy | `lpOrderCancel` |
| `PATCH /api/orders/[orderId]/cancel` | Active | Admin/detail flows | `lpOrderCancel` + idempotent 200 |

**Production week path = rad 1.**

## 2. KODE-EKSTRAKT

**Week cancel body:**

```389:396:app/(app)/week/EmployeeWeekClient.tsx
export function buildOrderWriteBody(date: string, wantsLunch: boolean, choiceKey?: string | null, itemKey?: string | null) {
  return {
    date,
    action: wantsLunch ? "set" : "cancel",
    // …
  };
}
```

**Killswitch + RPC:**

```258:261:app/api/orders/route.ts
      await enforceSystemGate({
        action: action === "SET" ? "ORDER_CREATE" : "ORDER_CANCEL",
      });
```

**Live CANCEL branch (prod `lp_order_set`):**

```sql
-- CANCEL: ingen krav om publisert meny eller aktiv avtale-innhold
select o.id … where status = 'ACTIVE'
update orders set status = 'CANCELLED'
delete from order_items …
delete from day_choices …
-- outbox: order.set:{uid}:{date}:{slot} action CANCEL
```

**Divergent `/api/order/cancel` (service role, day_choices only):**

```321:327:app/api/order/cancel/route.ts
    const { data: updatedRaw, error: uErr } = await (supa as any)
      .from("day_choices")
      .update({ status: "CANCELLED" })
      .eq("id", existing.id)
```

**Outbox etter RPC (ikke `order.changed:cancelled`):**

```206:215:lib/orderBackup/outbox.ts
export async function fanoutLpOrderSetOutboxBestEffort(p: { userId; date; slot }) {
  const key = `order.set:${uid}:${date}:${slot}`;
```

Tripletex billing SQL filtrerer `status NOT IN ('CANCELLED')` — `20260530120000_tpt_b3_agreement_invoices.sql` L409–413.

## 3. EDGE CASE MATRIX

| # | Edge case | Håndtert? | Hvor | Test? |
|---|-----------|-----------|------|-------|
| 1 | Cancel already cancelled | ✅ | RPC no-op / PATCH 200 unchanged | PATCH test |
| 2 | Cancel non-existent order | ✅ | RPC null order_id; API empty orderId L496 | partial |
| 3 | Cancel other user's order | ✅ | RPC auth.uid scope | ❌ |
| 4 | Cancel after 08:00 | ✅ | RPC CUTOFF_PASSED | ❌ |
| 5 | Cancel last week | ✅ | Past date cutoff | ❌ |
| 6 | Cancel single dish in multi | N/A | Whole-day granularity | — |
| 7 | Admin cancel for employee | ⚠️ | Separate admin routes | ❌ |
| 8 | Concurrent kitchen read | ⚠️ | Soft status; rollup rebuild | ❌ |
| 9 | Cancel after Tripletex invoice | ✅ | Excluded from billing count | SQL only |
| 10 | `/api/order/cancel` vs orders drift | ❌ | Dual architecture | ❌ |
| 11 | Killswitch on legacy paths | ❌ | Kun POST /api/orders | ❌ |
| 12 | Idempotent cancel idem key | ✅ | Same as order flow | idempotency test |

## 4. STAFF-GRADE SCORECARD

| Dimensjon | Grade | Bevis |
|-----------|-------|-------|
| Idempotency | ⚠️ | Server idem; client new UUID; PATCH idempotent |
| Audit trail | ❌ | Week cancel: ingen success audit |
| Error handling | ✅ | Cutoff mapped; killswitch CANCELLATIONS_BLOCKED |
| Race conditions | ⚠️ | Soft cancel + rollup; kitchen eventual |
| E2E test | ⚠️ | PATCH in order-flow-api; week POST untested |
| Observability | ⚠️ | opsLog errors only |

**Flyt 4 Staff: 58%**

## 5. GAP-LISTE

- **Konsolider til `POST /api/orders` only** — deprecate/remove `/api/order/cancel`, `/api/orders/cancel`.
- Align `day_choices` DELETE (RPC) vs UPDATE (legacy HTTP).
- Success audit på cancel.
- Killswitch på alle cancel entry points.
- Playwright cancel etter cutoff boundary test.

---

# Samlet vurdering

## Topp 5 critical flow gaps (risk × DD)

| # | Gap | Flyt | Risk |
|---|-----|------|------|
| 1 | **3 cancel HTTP architectures** — kitchen/billing truth drift | 4 | critical |
| 2 | **Client Idempotency-Key ikke stabil** — double-submit → duplicate orders | 3 | critical |
| 3 | **`getClosedDatesForDate` stub** — stengte dager aldri enforced | 2+3 | high |
| 4 | **Onboarding approve pipeline** — agreement draft 410 vs inbox | 1A | high |
| 5 | **Ingen live E2E** order/cancel/register mot staging | alle | high |

## Topp 5 quick wins (≈1 dag)

| # | Tiltak |
|---|--------|
| 1 | Reuse Idempotency-Key per confirm modal session (`EmployeeWeekClient`) |
| 2 | 410/redirect `/api/order/cancel` → dokumenter forbidden + monitor 404 |
| 3 | Rate limit `POST /api/public/register-company` via `anonRateLimitOk` |
| 4 | Audit event on `accept-invite` success |
| 5 | Fix client cancel success when `orderId` empty (match API L496) |

## Topp 5 strategic gaps (sprint+)

| # | Gap |
|---|-----|
| 1 | Playwright critical path: register → approve → invite → week → order → cancel |
| 2 | Single cancel canonical + remove service-role day_choice path |
| 3 | closedDate end-to-end (Sanity → API → week UI) |
| 4 | Registration GDPR + bot protection + confirmation email |
| 5 | Observability: Sentry breadcrumbs on order/register/cancel RPC failures |

---

## Sammendrag til Thomas

### Per-flyt Staff %

| Flyt | % |
|------|--:|
| 1A Bedrift onboarding | 62 |
| 1B Ansatt invite | 71 |
| 2 Meny-publisering | 68 |
| 3 Bestilling | 72 |
| 4 Avbestilling | 58 |
| **Snitt** | **66** |

### Mest alarmerende ubehandlet edge case

**Double-submit bestilling med to forskjellige Idempotency-Keys** — server-idempotency er korrekt implementert, men klienten genererer ny UUID for hvert klikk (`EmployeeWeekClient.tsx:1907`), så rask dobbeltbekreftelse kan gi to aktive ordre samme dag (kun delvis begrenset av `inFlightRef`).

### Topp 3 forretningsspørsmål (Thomas)

1. **ENTERPRISE-meny:** Skal auto-rollout forbli manuell (kun BASIS/LUXUS cron), eller skal ENTERPRISE inn i `runMenuWeekRolloutCore`? (121 live menuDays finnes, 0 weekTemplate.)
2. **Onboarding approve:** Hvordan opprettes PENDING ledger-agreement i dag etter at `create-agreement-draft` returnerer 410? Er det manuelt i Supabase, eller pipeline-gap?
3. **Cancel etter kjøkken-eksport 08:00:** Skal ansatt kunne avbestille etter cutoff hvis kjøkkenliste allerede er generert — og skal Tripletex-kredit automatiseres?

---

*Generert read-only — Critical Flows Deep-Dive — Cursor, 2026-05-28.*
