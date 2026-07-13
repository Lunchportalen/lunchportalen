/**
 * PHASE 5 — company onboarding + agreement lifecycle contract suite (fast, no DB).
 *
 * Locks:
 *  - migration invariants (enum values, RPC hardening, grants, fail-closed matching)
 *  - controlled provider choice (API mapping + form + coverage exposure)
 *  - plan materialization wired into superadmin approval
 *  - state machine routes (suspend/resume/terminate) superadmin-gated
 *  - locations CRUD + billing profile company_admin-gated with audit
 *  - cutoff visible but never company-writable
 *  - waitlist/rejection notifications
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = path.resolve(__dirname, "..", "..");
const read = (p: string) => fs.readFileSync(path.join(ROOT, p), "utf8");
const stripSqlComments = (sql: string) =>
  sql
    .split("\n")
    .filter((l) => !l.trim().startsWith("--"))
    .join("\n");

const MIG_ENUM = "supabase/migrations/20260821120000_agreement_status_values.sql";
const MIG_LIFE = "supabase/migrations/20260821130000_company_agreement_lifecycle.sql";

describe("migration invariants", () => {
  const enumSql = read(MIG_ENUM);
  const lifeSql = read(MIG_LIFE);
  const lifeCode = stripSqlComments(lifeSql);

  it("agreement_status gains APPROVED/SUSPENDED/TERMINATED additively", () => {
    for (const v of ["'APPROVED'", "'SUSPENDED'", "'TERMINATED'"]) {
      expect(enumSql).toContain(`ADD VALUE IF NOT EXISTS ${v}`);
    }
  });

  it("provider matching is fail-closed with controlled choice", () => {
    expect(lifeSql).toContain("PROVIDER_NOT_FOUND");
    expect(lifeSql).toContain("PROVIDER_CHOICE_REQUIRED");
    expect(lifeSql).toContain("PROVIDER_NOT_ELIGIBLE");
    expect(lifeSql).toContain("lp_match_providers_by_postal_code");
    expect(lifeCode.toLowerCase()).not.toContain("melhus");
  });

  it("all lifecycle RPCs are SECURITY DEFINER with pinned search_path", () => {
    const defs = lifeCode.match(/SECURITY DEFINER/g) ?? [];
    expect(defs.length).toBeGreaterThanOrEqual(6); // match, register, suspend, resume, terminate, materialize
    expect(lifeCode).not.toMatch(/SECURITY DEFINER(?![\s\S]{0,120}SET search_path)/);
  });

  it("state-machine + materialize RPCs are service_role only; anon revoked on register/match", () => {
    for (const fn of ["lp_agreement_suspend", "lp_agreement_resume", "lp_agreement_terminate", "lp_agreement_materialize_plan"]) {
      expect(lifeSql).toMatch(new RegExp(`REVOKE ALL ON FUNCTION public\\.${fn}[^;]*FROM anon, authenticated`));
    }
    expect(lifeSql).toMatch(/REVOKE ALL ON FUNCTION public\.lp_company_register[^;]*FROM anon;/);
    expect(lifeSql).toMatch(/REVOKE ALL ON FUNCTION public\.lp_match_providers_by_postal_code[^;]*FROM anon;/);
  });

  it("state machine enforces legal transitions only", () => {
    expect(lifeSql).toContain("AGREEMENT_NOT_ACTIVE");
    expect(lifeSql).toContain("AGREEMENT_NOT_SUSPENDED");
    expect(lifeSql).toContain("AGREEMENT_NOT_TERMINABLE");
    expect(lifeSql).toMatch(/NOT IN \('ACTIVE', 'SUSPENDED'\)/);
  });

  it("materialization writes agreement first (delivery-days sync trigger), then per-day tiers", () => {
    const updateIdx = lifeSql.indexOf("SET delivery_days = v_days");
    const perDayIdx = lifeSql.indexOf("INSERT INTO public.agreement_delivery_days (agreement_id, weekday, tier)");
    expect(updateIdx).toBeGreaterThan(0);
    expect(perDayIdx).toBeGreaterThan(updateIdx);
  });

  it("locations + companies gain the required additive columns", () => {
    for (const c of ["contact_name", "contact_phone", "window_from", "window_to", "delivery_instructions"]) {
      expect(lifeSql).toContain(`ADD COLUMN IF NOT EXISTS ${c}`);
    }
    expect(lifeSql).toContain("ADD COLUMN IF NOT EXISTS cost_center");
    expect(lifeSql).toContain("ADD COLUMN IF NOT EXISTS invoice_reference");
  });
});

describe("register-company API — controlled provider choice", () => {
  const src = read("app/api/public/register-company/route.ts");

  it("passes UUID-validated p_provider_id and maps the new errors to 422", () => {
    expect(src).toContain("p_provider_id: providerChoice");
    expect(src).toContain("PROVIDER_CHOICE_REQUIRED");
    expect(src).toContain("PROVIDER_NOT_ELIGIBLE");
    expect(src).toMatch(/\[0-9a-f\]\{8\}/i); // uuid gate before passthrough
  });
});

describe("coverage API — exposes provider list only for controlled choice", () => {
  const src = read("app/api/public/coverage/check/route.ts");
  it("uses the plural match RPC and only exposes names when >1", () => {
    expect(src).toContain("lp_match_providers_by_postal_code");
    expect(src).toContain("list.length > 1");
    expect(src).toContain("multipleProviders");
  });
});

describe("registration form — provider choice UI", () => {
  const src = read("components/auth/CompanyRegistrationForm.tsx");
  it("requires an explicit choice when multiple providers cover", () => {
    expect(src).toContain('name="provider_choice"');
    expect(src).toContain("providerChoices.length > 1 && !providerId");
    expect(src).toContain("provider_id: providerId");
  });
});

describe("superadmin approval — plan materialization", () => {
  const src = read("app/api/superadmin/agreements/[agreementId]/approve/route.ts");
  it("materializes the registration plan before activating", () => {
    const matIdx = src.indexOf('rpc("lp_agreement_materialize_plan"');
    const approveIdx = src.indexOf('rpc("lp_agreement_approve_active"');
    expect(matIdx).toBeGreaterThan(0);
    expect(approveIdx).toBeGreaterThan(matIdx);
    expect(src).toContain("AGREEMENT_PLAN_MATERIALIZE_FAILED");
  });
});

describe("agreement state machine routes — superadmin only", () => {
  for (const action of ["suspend", "terminate"]) {
    it(`${action} route requires superadmin`, () => {
      const src = read(`app/api/superadmin/agreements/[agreementId]/${action}/route.ts`);
      expect(src).toContain('["superadmin"]');
      expect(src).toContain(`lp_agreement_${action}`);
    });
  }

  it("resume route uses the canonical ledger RPC and keeps the legacy company_agreements fallback", () => {
    const src = read("app/api/superadmin/agreements/[agreementId]/resume/route.ts");
    expect(src).toContain("lp_agreement_resume");
    expect(src).toContain('scope.role !== "superadmin"'); // legacy hard rule preserved
    expect(src).toContain('from("company_agreements")'); // no regression of legacy flow
  });
});

describe("locations CRUD — company_admin scoped with audit", () => {
  const src = read("app/api/admin/locations/route.ts");
  it("POST + PATCH exist, role/scope-gated, tenant-verified, audited", () => {
    expect(src).toContain("export async function POST");
    expect(src).toContain("export async function PATCH");
    expect(src).toContain('["company_admin"]');
    expect(src).toContain("requireCompanyScopeOr403");
    expect(src).toContain("COMPANY_LOCATION_CREATED");
    expect(src).toContain("COMPANY_LOCATION_UPDATED");
    expect(src).toContain("delivery_instructions");
    // PATCH refuses cross-tenant edits.
    expect(src).toContain('jsonErr(rid, "Ingen tilgang til lokasjon.", 403, "FORBIDDEN")');
  });
});

describe("billing profile — company_admin scoped with audit", () => {
  const src = read("app/api/admin/company/billing/route.ts");
  it("GET/PUT gated, validates invoice recipient + employee count, audited", () => {
    expect(src).toContain("export async function GET");
    expect(src).toContain("export async function PUT");
    expect(src).toContain('["company_admin"]');
    expect(src).toContain("EMPLOYEE_COUNT_MIN_20");
    expect(src).toContain("BILLING_EMAIL_INVALID");
    expect(src).toContain("cost_center");
    expect(src).toContain("invoice_reference");
    expect(src).toContain("COMPANY_BILLING_UPDATED");
  });
});

describe("cutoff — visible, never company-writable", () => {
  it("agreement page reads lp_company_cutoff_context (read-only)", () => {
    const src = read("app/admin/agreement/page.tsx");
    expect(src).toContain("lp_company_cutoff_context");
    expect(src).toContain("styres av leverandøren");
  });
  it("billing/locations admin APIs never touch cutoff", () => {
    for (const p of ["app/api/admin/company/billing/route.ts", "app/api/admin/locations/route.ts"]) {
      const src = read(p);
      expect(src).not.toContain("cutoff");
    }
  });
});

describe("notifications — waitlist + rejection", () => {
  it("waitlist registration enqueues an outbox notification", () => {
    const src = read("app/registrer/actions.ts");
    expect(src).toContain("company.registration.waitlist");
    expect(src).toContain("outbox");
  });
  it("provider rejection enqueues an outbox notification and stamps sent-at", () => {
    const src = read("app/leverandor/registreringer/actions.ts");
    expect(src).toContain("company.registration.rejected");
    expect(src).toContain("rejection_message_sent_at");
  });
});
