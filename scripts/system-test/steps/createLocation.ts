import crypto from "node:crypto";

import type { SystemTestContext } from "../context";
import { assert } from "../utils/assert";
import type { SystemTestAdmin } from "../utils/supabaseAdmin";

export async function createLocation(ctx: SystemTestContext, admin: SystemTestAdmin): Promise<SystemTestContext> {
  if (!ctx.companyId) throw new Error("createLocation: missing companyId");

  const locationId = crypto.randomUUID();
  const payload = { id: locationId, company_id: ctx.companyId, name: ctx.locationName, status: "ACTIVE" };

  const { error } = await admin.from("company_locations").insert(payload as never);
  if (error) throw new Error(`createLocation: ${error.message}`);

  const { data, error: r2 } = await admin.from("company_locations").select("id, company_id").eq("id", locationId).maybeSingle();
  if (r2) throw new Error(`createLocation verify: ${r2.message}`);
  assert(data?.id === locationId, "createLocation: row missing after insert");

  return { ...ctx, locationId };
}
