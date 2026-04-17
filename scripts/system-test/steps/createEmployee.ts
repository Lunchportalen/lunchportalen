import crypto from "node:crypto";

import type { SystemTestContext } from "../context";
import { assert } from "../utils/assert";
import type { SystemTestAdmin } from "../utils/supabaseAdmin";

/**
 * Auth user + profile (employee). profiles.id must equal auth user id (canonical schema).
 */
export async function createEmployee(ctx: SystemTestContext, admin: SystemTestAdmin): Promise<SystemTestContext> {
  if (!ctx.companyId || !ctx.locationId) throw new Error("createEmployee: missing companyId or locationId");

  const password = crypto.randomBytes(24).toString("hex");

  const { data: created, error: cErr } = await admin.auth.admin.createUser({
    email: ctx.employeeEmail,
    password,
    email_confirm: true,
    user_metadata: {
      role: "employee",
      company_id: ctx.companyId,
      full_name: `TEST_EMPLOYEE_${ctx.testLabel}`,
      name: `TEST_EMPLOYEE_${ctx.testLabel}`,
    },
  });
  if (cErr || !created?.user?.id) throw new Error(`createEmployee auth: ${cErr?.message ?? "no user id"}`);

  const userId = String(created.user.id);

  const base = {
    id: userId,
    role: "employee" as const,
    email: ctx.employeeEmail,
    company_id: ctx.companyId,
    location_id: ctx.locationId,
    full_name: `TEST_EMPLOYEE_${ctx.testLabel}`,
    disabled_at: null,
  };

  const { error: pErr } = await admin.from("profiles").upsert(base as never, { onConflict: "id" });
  if (pErr) throw new Error(`createEmployee profile: ${pErr.message}`);

  const { data: row, error: rErr } = await admin.from("profiles").select("id, role, company_id").eq("id", userId).maybeSingle();
  if (rErr) throw new Error(`createEmployee verify: ${rErr.message}`);
  assert(row?.id === userId, "createEmployee: profile missing");
  assert(String(row?.role) === "employee", "createEmployee: role not employee");

  return {
    ...ctx,
    userId,
    employeeEmail: ctx.employeeEmail,
    employeePassword: password,
  };
}
