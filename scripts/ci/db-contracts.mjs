import { Client } from "pg";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("FAIL: DATABASE_URL not set (required for DB contract checks).");
  process.exit(1);
}

const client = new Client({ connectionString: url });

async function toRegclass(name) {
  const { rows } = await client.query(`SELECT to_regclass($1) AS t`, [`public.${name}`]);
  return rows?.[0]?.t;
}

async function assertTable(name) {
  const ok = await toRegclass(name);
  if (!ok) {
    throw new Error(`missing table public.${name}`);
  }
  console.log(`OK: table public.${name}`);
}

async function assertColumn(table, column) {
  const { rowCount } = await client.query(
    `SELECT 1
     FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = $1
       AND column_name = $2`,
    [table, column],
  );
  if (!rowCount) {
    throw new Error(`missing column public.${table}.${column}`);
  }
  console.log(`OK: column public.${table}.${column}`);
}

async function assertColumnAbsent(table, column) {
  const { rowCount } = await client.query(
    `SELECT 1
     FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = $1
       AND column_name = $2`,
    [table, column],
  );
  if (rowCount) {
    throw new Error(`unexpected column public.${table}.${column} (must not exist)`);
  }
  console.log(`OK: column public.${table}.${column} absent`);
}

async function assertUniqueConstraint(table, conname, expectedFragment) {
  const { rows } = await client.query(
    `SELECT pg_get_constraintdef(c.oid) AS def
     FROM pg_constraint c
     JOIN pg_class t ON t.oid = c.conrelid
     JOIN pg_namespace n ON n.oid = t.relnamespace
     WHERE n.nspname = 'public'
       AND t.relname = $1
       AND c.contype = 'u'
       AND c.conname = $2`,
    [table, conname],
  );
  const def = rows?.[0]?.def ?? "";
  if (!def.includes(expectedFragment)) {
    throw new Error(
      `constraint public.${table}.${conname} mismatch: expected fragment "${expectedFragment}", got "${def}"`,
    );
  }
  console.log(`OK: unique constraint public.${table}.${conname}`);
}

async function assertForeignKey(table, conname, referencedTable) {
  const { rows } = await client.query(
    `SELECT pg_get_constraintdef(c.oid) AS def
     FROM pg_constraint c
     JOIN pg_class t ON t.oid = c.conrelid
     JOIN pg_namespace n ON n.oid = t.relnamespace
     WHERE n.nspname = 'public'
       AND t.relname = $1
       AND c.contype = 'f'
       AND c.conname = $2`,
    [table, conname],
  );
  const def = rows?.[0]?.def ?? "";
  if (!def.includes(referencedTable)) {
    throw new Error(
      `FK public.${table}.${conname} must reference ${referencedTable}, got "${def}"`,
    );
  }
  console.log(`OK: FK public.${table}.${conname} → ${referencedTable}`);
}

async function assertForeignKeyToTableAbsent(table, column, forbiddenRefTable) {
  const { rows } = await client.query(
    `SELECT c.conname, pg_get_constraintdef(c.oid) AS def
     FROM pg_constraint c
     JOIN pg_class t ON t.oid = c.conrelid
     JOIN pg_namespace n ON n.oid = t.relnamespace
     JOIN pg_class ref ON ref.oid = c.confrelid
     JOIN pg_namespace refn ON refn.oid = ref.relnamespace
     WHERE n.nspname = 'public'
       AND t.relname = $1
       AND c.contype = 'f'
       AND refn.nspname = 'public'
       AND ref.relname = $2
       AND EXISTS (
         SELECT 1
         FROM unnest(c.conkey) AS col(attnum)
         JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = col.attnum
         WHERE a.attname = $3 AND NOT a.attisdropped
       )`,
    [table, forbiddenRefTable, column],
  );
  if (rows.length) {
    const detail = rows.map((r) => `${r.conname}: ${r.def}`).join("; ");
    throw new Error(
      `public.${table}.${column} must NOT reference ${forbiddenRefTable} (half-reconciled FK): ${detail}`,
    );
  }
  console.log(`OK: no FK public.${table}.${column} → ${forbiddenRefTable}`);
}

async function assertFunction(name) {
  const { rowCount } = await client.query(
    `SELECT 1
     FROM pg_proc p
     JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public'
       AND p.proname = $1`,
    [name],
  );
  if (!rowCount) {
    throw new Error(`missing function public.${name}()`);
  }
  console.log(`OK: function public.${name}()`);
}

async function assertFunctionWithArgs(name, argTypesSql) {
  const { rowCount } = await client.query(
    `SELECT 1
     FROM pg_proc p
     JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public'
       AND p.proname = $1
       AND pg_get_function_identity_arguments(p.oid) = $2`,
    [name, argTypesSql],
  );
  if (!rowCount) {
    throw new Error(`missing function public.${name}(${argTypesSql})`);
  }
  console.log(`OK: function public.${name}(${argTypesSql})`);
}

async function assertTrigger(table, triggerName) {
  const { rowCount } = await client.query(
    `SELECT 1
     FROM pg_trigger tg
     JOIN pg_class c ON c.oid = tg.tgrelid
     JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public'
       AND c.relname = $1
       AND tg.tgname = $2
       AND NOT tg.tgisinternal`,
    [table, triggerName],
  );
  if (!rowCount) {
    throw new Error(`missing trigger ${triggerName} on public.${table}`);
  }
  console.log(`OK: trigger public.${table}.${triggerName}`);
}

async function assertIndex(indexName, tableName) {
  const { rowCount } = await client.query(
    `SELECT 1
     FROM pg_indexes
     WHERE schemaname = 'public'
       AND tablename = $1
       AND indexname = $2`,
    [tableName, indexName],
  );
  if (!rowCount) {
    throw new Error(`missing index public.${tableName}.${indexName}`);
  }
  console.log(`OK: index public.${tableName}.${indexName}`);
}

async function assertIndexAbsent(indexName, tableName) {
  const { rowCount } = await client.query(
    `SELECT 1
     FROM pg_indexes
     WHERE schemaname = 'public'
       AND tablename = $1
       AND indexname = $2`,
    [tableName, indexName],
  );
  if (rowCount) {
    throw new Error(`unexpected index public.${tableName}.${indexName} (should be absent)`);
  }
  console.log(`OK: index absent public.${tableName}.${indexName}`);
}

async function assertIndexDefContains(indexName, tableName, fragments) {
  const { rows } = await client.query(
    `SELECT indexdef
     FROM pg_indexes
     WHERE schemaname = 'public'
       AND tablename = $1
       AND indexname = $2`,
    [tableName, indexName],
  );
  if (!rows.length) {
    throw new Error(`missing index public.${tableName}.${indexName} for indexdef check`);
  }
  const def = String(rows[0].indexdef ?? "");
  for (const frag of fragments) {
    if (!def.includes(frag)) {
      throw new Error(
        `index public.${tableName}.${indexName} indexdef missing fragment: ${frag}`,
      );
    }
  }
  console.log(`OK: indexdef public.${tableName}.${indexName} (${fragments.length} fragments)`);
}

async function assertView(name) {
  const ok = await toRegclass(name);
  if (!ok) {
    throw new Error(`missing view public.${name}`);
  }
  console.log(`OK: view public.${name}`);
}

async function assertViewColumn(viewName, columnName) {
  const { rowCount } = await client.query(
    `SELECT 1
     FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = $1
       AND column_name = $2`,
    [viewName, columnName],
  );
  if (!rowCount) {
    throw new Error(`missing column public.${viewName}.${columnName}`);
  }
  console.log(`OK: view column public.${viewName}.${columnName}`);
}

async function assertMapStatusNoRevokedToSuspended() {
  const { rows } = await client.query(
    `SELECT pg_get_functiondef(p.oid) AS def
     FROM pg_proc p
     JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public'
       AND p.proname = 'lp_fundament_map_membership_status'`,
  );
  const def = rows?.[0]?.def ?? "";
  if (!def) {
    throw new Error("missing function public.lp_fundament_map_membership_status()");
  }
  if (/revoked/i.test(def)) {
    throw new Error(
      "lp_fundament_map_membership_status must not reference revoked (no revoked→suspended mapping)",
    );
  }
  console.log("OK: lp_fundament_map_membership_status has no revoked mapping");
}

async function verifyCoreContracts() {
  const requiredTables = [
    "companies",
    "company_locations",
    "profiles",
    "orders",
    "agreements",
  ];
  for (const t of requiredTables) {
    await assertTable(t);
  }

  const requiredFunctions = ["lp_order_set", "lp_pgrst_reload_schema"];
  for (const fn of requiredFunctions) {
    await assertFunction(fn);
  }
}

async function verifySpineSchemaInvariants() {
  console.log("\n-- Fundament identity spine (FASE 1→4 durable schema invariants) --");

  for (const t of ["organizations", "memberships", "platform_admins"]) {
    await assertTable(t);
  }

  await assertColumn("memberships", "location_id");
  await assertForeignKey("memberships", "memberships_location_id_fkey", "company_locations");

  await assertUniqueConstraint(
    "memberships",
    "memberships_user_org_role_location_uniq",
    "UNIQUE NULLS NOT DISTINCT (user_id, org_id, role, location_id)",
  );

  await assertColumn("organizations", "legacy_provider_id");
  await assertColumnAbsent("organizations", "customer_provider_org_id");

  await assertColumn("organizations", "metadata");
  await assertColumn("memberships", "metadata");
  await assertColumn("memberships", "source_rule");

  await assertFunction("assert_role_valid_for_org");
  await assertTrigger("memberships", "trg_memberships_assert_role_valid_for_org");
  await assertMapStatusNoRevokedToSuspended();
}

async function verifyProviderConfigFoundation() {
  console.log("\n-- Provider-config foundation (ADR-016 inert skin) --");

  for (const t of [
    "provider_price_rules",
    "provider_settings",
    "provider_package_entitlements",
  ]) {
    await assertTable(t);
  }

  await assertColumn("provider_settings", "cutoff_time");
  await assertColumn("provider_settings", "kitchen_buffer_minutes");
  await assertColumn("provider_package_entitlements", "entitlement_key");
  for (const t of [
    "provider_price_rules",
    "provider_settings",
    "provider_package_entitlements",
  ]) {
    const { rowCount } = await client.query(
      `SELECT 1
       FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = $1
         AND column_name = 'provider_id'
         AND is_nullable = 'NO'`,
      [t],
    );
    if (!rowCount) {
      throw new Error(`public.${t}.provider_id must be NOT NULL`);
    }
    console.log(`OK: column public.${t}.provider_id NOT NULL`);
  }

  for (const t of [
    "provider_price_rules",
    "provider_settings",
    "provider_package_entitlements",
  ]) {
    await assertForeignKeyToTableAbsent(t, "provider_id", "providers");
  }

  await assertForeignKey(
    "provider_price_rules",
    "provider_price_rules_provider_id_fkey",
    "organizations",
  );
  await assertForeignKey(
    "provider_settings",
    "provider_settings_provider_id_fkey",
    "organizations",
  );
  await assertForeignKey(
    "provider_package_entitlements",
    "provider_package_entitlements_provider_id_fkey",
    "organizations",
  );

  const { rows: melhusRows } = await client.query(
    `SELECT p.id AS provider_id
     FROM public.providers p
     WHERE p.slug = 'melhus-catering'
       AND p.deleted_at IS NULL
     LIMIT 1`,
  );
  const melhusId = melhusRows[0]?.provider_id;
  if (!melhusId) {
    throw new Error("Melhus provider (slug melhus-catering) missing — seed prerequisite");
  }

  const { rows: settingsRows } = await client.query(
    `SELECT default_currency, default_country_code, timezone, cutoff_time,
            kitchen_buffer_minutes, delivery_days, locale
     FROM public.provider_settings
     WHERE provider_id = $1`,
    [melhusId],
  );
  if (!settingsRows.length) {
    throw new Error("provider_settings seed missing for Melhus provider");
  }
  const s = settingsRows[0];
  if (s.cutoff_time !== "08:00" || s.timezone !== "Europe/Oslo" || Number(s.kitchen_buffer_minutes) !== 5) {
    throw new Error("provider_settings Melhus seed values mismatch (expected 08:00 / Europe/Oslo / buffer 5)");
  }
  console.log("OK: provider_settings Melhus seed present");

  const { rows: priceCount } = await client.query(
    `SELECT COUNT(*)::int AS c
     FROM public.provider_price_rules
     WHERE provider_id = $1
       AND customer_id IS NULL
       AND agreement_id IS NULL
       AND is_active = true
       AND tier IN ('BASIS', 'LUXUS', 'ENTERPRISE')
       AND market_code = 'NO'
       AND tax_basis = 'ex_tax'
       AND tax_category = 'food_catering'
       AND currency = 'NOK'
       AND source = 'seed'`,
    [melhusId],
  );
  if (Number(priceCount[0]?.c) < 3) {
    throw new Error(
      "provider_price_rules Melhus seed expected >=3 active NO tier rows (R4C market metadata)",
    );
  }
  console.log("OK: provider_price_rules Melhus tier seed (>=3 NO rows, R4C metadata)");

  for (const col of [
    "market_code",
    "tax_basis",
    "tax_category",
    "source",
    "created_by",
    "updated_by",
  ]) {
    await assertColumn("provider_price_rules", col);
  }

  await assertIndex(
    "provider_price_rules_provider_market_tier_default_uniq",
    "provider_price_rules",
  );
  await assertIndexAbsent(
    "provider_price_rules_provider_tier_default_uniq",
    "provider_price_rules",
  );
  await assertIndexDefContains("provider_price_rules_provider_market_tier_default_uniq", "provider_price_rules", [
    "provider_id",
    "market_code",
    "tier",
    "(customer_id IS NULL)",
    "(agreement_id IS NULL)",
    "(menu_category_key IS NULL)",
    "(menu_item_id IS NULL)",
    "(is_active = true)",
  ]);

  const { rows: dupRows } = await client.query(
    `SELECT provider_id, market_code, tier, COUNT(*)::int AS c
     FROM public.provider_price_rules
     WHERE customer_id IS NULL
       AND agreement_id IS NULL
       AND menu_category_key IS NULL
       AND menu_item_id IS NULL
       AND tier IS NOT NULL
       AND is_active = true
     GROUP BY provider_id, market_code, tier
     HAVING COUNT(*) > 1`,
  );
  if (dupRows.length > 0) {
    throw new Error(
      `provider_price_rules duplicate active tier-defaults: ${dupRows.length} group(s)`,
    );
  }
  console.log("OK: provider_price_rules no duplicate active tier-defaults (R4C)");

  await assertView("provider_price_rules_tier_defaults_v1");
  for (const col of [
    "provider_id",
    "tier",
    "amount_ex_vat",
    "currency",
    "vat_rate",
    "is_active",
    "valid_from",
    "valid_to",
  ]) {
    await assertViewColumn("provider_price_rules_tier_defaults_v1", col);
  }

  const { rows: viewCount } = await client.query(
    `SELECT COUNT(*)::int AS c
     FROM public.provider_price_rules_tier_defaults_v1
     WHERE provider_id = $1`,
    [melhusId],
  );
  if (Number(viewCount[0]?.c) < 3) {
    throw new Error(
      "provider_price_rules_tier_defaults_v1 expected >=3 Melhus tier-default rows when seed present",
    );
  }
  console.log("OK: provider_price_rules_tier_defaults_v1 Melhus tier defaults (>=3 rows)");

  const { rows: entCount } = await client.query(
    `SELECT package_key, COUNT(*)::int AS c
     FROM public.provider_package_entitlements
     WHERE provider_id = $1
     GROUP BY package_key
     ORDER BY package_key`,
    [melhusId],
  );
  const byPkg = Object.fromEntries(entCount.map((r) => [r.package_key, Number(r.c)]));
  // Floor (not exact): Melhus entitlements grow as categories/items are added on staging/prod.
  // Golden-path seed minimums remain BASIS>=4, LUXUS>=7, ENTERPRISE>=7.
  if ((byPkg.BASIS ?? 0) < 4 || (byPkg.LUXUS ?? 0) < 7 || (byPkg.ENTERPRISE ?? 0) < 7) {
    throw new Error(
      `provider_package_entitlements Melhus seed mismatch: expected BASIS>=4 LUXUS>=7 ENTERPRISE>=7, got ${JSON.stringify(byPkg)}`,
    );
  }
  console.log(
    `OK: provider_package_entitlements Melhus seed (BASIS>=4, LUXUS>=7, ENTERPRISE>=7; actual ${JSON.stringify(byPkg)})`,
  );
}

async function verifySpinePhase2AuthHookShadow() {
  console.log("\n-- Fundament identity spine (FASE 2 shadow — hook + helpers, no RLS wiring) --");

  await assertColumn("profiles", "preferred_spine_membership_id");
  await assertForeignKey(
    "profiles",
    "profiles_preferred_spine_membership_id_fkey",
    "memberships",
  );

  await assertFunctionWithArgs("custom_access_token_hook", "event jsonb");
  for (const fn of [
    "app_active_org",
    "app_active_role",
    "app_is_platform_admin",
    "app_active_location_id",
  ]) {
    await assertFunction(fn);
  }

  const { rows: indexRows } = await client.query(
    `SELECT 1
     FROM pg_indexes
     WHERE schemaname = 'public'
       AND tablename = 'memberships'
       AND indexname = 'memberships_user_id_status_idx'`,
  );
  if (!indexRows.length) {
    throw new Error("missing index public.memberships_user_id_status_idx");
  }
  console.log("OK: index public.memberships_user_id_status_idx");
}

async function main() {
  await client.connect();
  try {
    await verifyCoreContracts();
    await verifySpineSchemaInvariants();
    await verifySpinePhase2AuthHookShadow();
    await verifyProviderConfigFoundation();
    console.log("\nOK: DB contracts verified");
  } catch (error) {
    console.error(`FAIL: ${error.message}`);
    process.exit(1);
  } finally {
    await client.end();
  }
}

await main();
