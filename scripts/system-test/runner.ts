/**
 * End-to-end system verification (service role).
 *
 * Safety:
 *   SYSTEM_TEST_ALLOW=1 is required (blocks accidental prod runs).
 *   All synthetic names use TEST_* prefix; cleanup deletes only ids from this run.
 *
 *   SYSTEM_TEST_SKIP_CLEANUP=1 keeps rows after run (debug only).
 */
import { createContext } from "./context";
import { cancelOrder } from "./steps/cancelOrder";
import { createAgreement } from "./steps/createAgreement";
import { createCompany } from "./steps/createCompany";
import { createEmployee } from "./steps/createEmployee";
import { createLocation } from "./steps/createLocation";
import { createOrder } from "./steps/createOrder";
import { cleanupTestRun } from "./utils/cleanup";
import { logStep, logStepTimed, printStructuredSummary, resetLog } from "./utils/logger";
import { getSupabaseAdmin, type SystemTestAdmin } from "./utils/supabaseAdmin";

const bold = "\x1b[1m";
const reset = "\x1b[0m";
const green = "\x1b[32m";
const red = "\x1b[31m";

async function main() {
  if (process.env.SYSTEM_TEST_ALLOW !== "1") {
    // eslint-disable-next-line no-console
    console.error(
      `${red}BLOCKED:${reset} Refusing to run without ${bold}SYSTEM_TEST_ALLOW=1${reset} (prevents accidental execution against the wrong database).`
    );
    process.exitCode = 2;
    return;
  }

  resetLog();
  let ctx = createContext();
  const skipCleanup = process.env.SYSTEM_TEST_SKIP_CLEANUP === "1";

  // eslint-disable-next-line no-console
  console.log(`${bold}SYSTEM TEST${reset} testId=${ctx.testId} companyName=${ctx.companyName}`);

  let failed = false;
  let admin: SystemTestAdmin | null = null;
  try {
    admin = getSupabaseAdmin();
    const rel = await (admin as any).rpc("lp_pgrst_reload_schema");
    const relMsg = String(rel.error?.message ?? "");
    if (rel.error && !relMsg.includes("Could not find the function") && !relMsg.includes("lp_pgrst_reload_schema")) {
      // eslint-disable-next-line no-console
      console.error("[system-test] lp_pgrst_reload_schema:", rel.error.message);
    } else if (!rel.error) {
      await new Promise((r) => setTimeout(r, 2000));
    }

    await logStepTimed("Create Company", async () => {
      ctx = await createCompany(ctx, admin);
    });
    await logStepTimed("Create Location", async () => {
      ctx = await createLocation(ctx, admin);
    });
    await logStepTimed("Create Agreement (ACTIVE)", async () => {
      ctx = await createAgreement(ctx, admin);
    });
    await logStepTimed("Create Employee", async () => {
      ctx = await createEmployee(ctx, admin);
    });
    await logStepTimed("Create Order", async () => {
      ctx = await createOrder(ctx);
    });
    await logStepTimed("Cancel Order", async () => {
      ctx = await cancelOrder(ctx);
    });

    // eslint-disable-next-line no-console
    console.log("");
    // eslint-disable-next-line no-console
    console.log(`${bold}SYSTEM TEST RESULT${reset}`);
    // eslint-disable-next-line no-console
    console.log(`${green}✔${reset} Company flow`);
    // eslint-disable-next-line no-console
    console.log(`${green}✔${reset} Agreement flow`);
    // eslint-disable-next-line no-console
    console.log(`${green}✔${reset} Employee flow`);
    // eslint-disable-next-line no-console
    console.log(`${green}✔${reset} Order flow`);
    // eslint-disable-next-line no-console
    console.log(`${green}✔${reset} Cancel flow`);
  } catch (e) {
    failed = true;
    const msg = e instanceof Error ? e.message : String(e);
    logStep("RUN", false, msg);
    // eslint-disable-next-line no-console
    console.log("");
    // eslint-disable-next-line no-console
    console.log(`${bold}SYSTEM TEST RESULT${reset}`);
    // eslint-disable-next-line no-console
    console.log(`${red}FAIL${reset} at step — see [FAIL] lines above (${msg})`);
    process.exitCode = 1;
  } finally {
    if (skipCleanup) {
      logStep("Cleanup", true, "skipped (SYSTEM_TEST_SKIP_CLEANUP=1)");
    } else if (admin) {
      await cleanupTestRun(ctx, admin);
    } else {
      logStep("Cleanup", false, "skipped (admin client not initialized)");
    }
    printStructuredSummary();
  }

  if (!failed) {
    process.exitCode = 0;
  }
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(e);
  process.exitCode = 1;
});
