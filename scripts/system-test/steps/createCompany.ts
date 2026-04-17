import crypto from "node:crypto";

import type { SystemTestContext } from "../context";
import { assert } from "../utils/assert";
import type { SystemTestAdmin } from "../utils/supabaseAdmin";

function uniqueOrgnr(): string {
  const n = crypto.randomInt(100_000_000, 999_999_999);
  return String(n);
}

/**
 * Insert test company (name TEST_COMPANY_*). Idempotent per run: uses fresh UUIDs from context caller.
 */
export async function createCompany(ctx: SystemTestContext, admin: SystemTestAdmin): Promise<SystemTestContext> {
  const companyId = crypto.randomUUID();
  const orgnr = uniqueOrgnr();

  const payloadUpper = {
    id: companyId,
    name: ctx.companyName,
    status: "ACTIVE",
    orgnr,
    employee_count: 25,
  } as Record<string, unknown>;

  let res = await admin.from("companies").insert(payloadUpper as never);
  if (res.error) {
    const msg = String(res.error.message ?? "");
    if (msg.includes("companies_status_check")) {
      res = await admin.from("companies").insert({ ...payloadUpper, status: "active" } as never);
    }
  }
  if (res.error) throw new Error(`createCompany: ${res.error.message}`);

  const { data, error } = await admin.from("companies").select("id, name").eq("id", companyId).maybeSingle();
  if (error) throw new Error(`createCompany verify: ${error.message}`);
  assert(data?.id === companyId, "createCompany: row missing after insert");

  return { ...ctx, companyId };
}
