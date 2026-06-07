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

async function main() {
  await client.connect();
  try {
    await verifyCoreContracts();
    await verifySpineSchemaInvariants();
    console.log("\nOK: DB contracts verified");
  } catch (error) {
    console.error(`FAIL: ${error.message}`);
    process.exit(1);
  } finally {
    await client.end();
  }
}

await main();
