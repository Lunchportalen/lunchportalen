import type { SystemTestContext } from "../context";
import { logStep } from "./logger";
import type { SystemTestAdmin } from "./supabaseAdmin";

const ORDERS_TABLE = "orders" as const;

function assertTestCompanyName(name: string | null | undefined) {
  const n = String(name ?? "").trim();
  if (!n.startsWith("TEST_COMPANY_")) {
    throw new Error(`cleanup: refused — company name must start with TEST_COMPANY_ (got "${n}")`);
  }
}

/**
 * Deletes rows created in this run only (by id). Does not scan or bulk-delete production data.
 * Call with the same context object mutated by the steps (ids filled in).
 */
export async function cleanupTestRun(ctx: SystemTestContext, admin: SystemTestAdmin): Promise<void> {
  assertTestCompanyName(ctx.companyName);

  const warn: string[] = [];

  const run = async (label: string, op: PromiseLike<{ error: { message: string } | null }>) => {
    const { error } = await op;
    if (error) warn.push(`${label}: ${error.message}`);
  };

  if (ctx.orderId) {
    await run("orders by id", admin.from(ORDERS_TABLE).delete().eq("id", ctx.orderId!));
  }

  if (ctx.companyId) {
    await run("orders by company", admin.from(ORDERS_TABLE).delete().eq("company_id", ctx.companyId!));
  }

  if (ctx.agreementId) {
    await run("agreements by id", admin.from("agreements").delete().eq("id", ctx.agreementId!));
  }

  if (ctx.companyId) {
    await run("agreements by company", admin.from("agreements").delete().eq("company_id", ctx.companyId!));
  }

  if (ctx.userId) {
    await run("profiles", admin.from("profiles").delete().eq("id", ctx.userId!));
    try {
      const { error } = await admin.auth.admin.deleteUser(ctx.userId!);
      if (error) warn.push(`auth.admin.deleteUser: ${error.message}`);
    } catch (e) {
      warn.push(`auth.admin.deleteUser: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  if (ctx.locationId) {
    await run("company_locations", admin.from("company_locations").delete().eq("id", ctx.locationId!));
  }

  if (ctx.companyId) {
    await run("companies", admin.from("companies").delete().eq("id", ctx.companyId!));
  }

  if (warn.length) {
    logStep("Cleanup (warnings)", false, warn.join(" | "));
  } else {
    logStep("Cleanup", true, "test ids removed");
  }
}
