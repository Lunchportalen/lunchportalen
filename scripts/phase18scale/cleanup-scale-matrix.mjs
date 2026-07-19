#!/usr/bin/env node
/**
 * Cleanup PHASE18_SCALE_SYNTHETIC records from the dedicated load environment.
 * Refuses production. Staging requires PHASE18_ALLOW_STAGING_ISOLATION=1.
 */
import { createClient } from "@supabase/supabase-js";
import { loadPhase18Env, MARK, PROD_REF } from "./load-env.mjs";

async function main() {
  const { url, ref } = loadPhase18Env();
  if (url.includes(PROD_REF)) throw new Error("PRODUCTION_TARGET_FORBIDDEN");
  const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const report = { phase: "18SCALE", ref, deleted: {}, PRODUCTION_MUTATIONS: 0 };

  // Best-effort ordered cleanup by synthetic email/slug prefixes
  const { data: companies } = await admin
    .from("companies")
    .select("id")
    .ilike("contact_email", "p18scale-%")
    .limit(5000);
  const companyIds = (companies || []).map((c) => c.id);

  if (companyIds.length) {
    await admin.from("menu_service_day_items").delete().in(
      "menu_service_day_id",
      (
        await admin.from("menu_service_days").select("id").in("company_id", companyIds)
      ).data?.map((r) => r.id) || [],
    );
    await admin.from("menu_service_days").delete().in("company_id", companyIds);
    // Soft-close synthetic orders via status update (no direct DELETE — ci-guard).
    await admin
      .from("orders")
      .update({ status: "CANCELLED", cancel_reason: "PHASE18_CLEANUP" })
      .in("company_id", companyIds);
    await admin.from("company_locations").delete().in("company_id", companyIds);
    await admin.from("companies").delete().in("id", companyIds);
    report.deleted.companies = companyIds.length;
  }

  const { data: providers } = await admin.from("providers").select("id").ilike("slug", "p18scale-%").limit(2000);
  const providerIds = (providers || []).map((p) => p.id);
  if (providerIds.length) {
    await admin.from("dish_day_capacity_events").delete().in("provider_id", providerIds);
    await admin.from("dish_day_capacity").delete().in("provider_id", providerIds);
    await admin.from("providers").delete().in("id", providerIds);
    report.deleted.providers = providerIds.length;
  }

  // Auth users — page and delete marked synthetic
  let page = 1;
  let authDeleted = 0;
  for (;;) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    const users = data?.users ?? [];
    for (const u of users) {
      const email = String(u.email || "").toLowerCase();
      if (!email.startsWith("p18scale-") || !email.endsWith("@load.lunchportalen.test")) continue;
      await admin.auth.admin.deleteUser(u.id);
      authDeleted += 1;
    }
    if (users.length < 1000) break;
    page += 1;
    if (page > 200) break;
  }
  report.deleted.auth_users = authDeleted;
  report.MARK = MARK;
  console.log(JSON.stringify(report, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
