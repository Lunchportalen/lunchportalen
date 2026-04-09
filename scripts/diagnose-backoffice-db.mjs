#!/usr/bin/env node
/**
 * Runtime diagnostic: backoffice URL visibility (no admin probes).
 * Loads .env.local for URL only. Table probes belong in-app via supabaseAdmin().
 */
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

const env = process.env;
const url = (env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL || "").trim();

const out = {
  configPresent: false,
  urlLength: url ? url.length : 0,
  keyPresent: false,
  tables: {},
  note: "No service role in scripts; use supabaseAdmin from lib/supabase/admin.ts for DB checks.",
};

console.log(JSON.stringify(out, null, 2));
