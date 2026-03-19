#!/usr/bin/env node
/**
 * Runtime diagnostic: backoffice API tables and admin config.
 * Loads .env.local, uses same env as getSupabaseAdminConfig, runs minimal selects.
 * Output: JSON with configPresent, table results (error message/code or rowCount).
 * No secrets printed.
 */
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });
import { createClient } from "@supabase/supabase-js";

const env = process.env;
const url = (env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL || "").trim();
const serviceRoleKey = (env.SUPABASE_SERVICE_ROLE_KEY || "").trim();

const out = {
  configPresent: Boolean(url && serviceRoleKey),
  urlLength: url ? url.length : 0,
  keyPresent: Boolean(serviceRoleKey),
  tables: {},
};

if (!out.configPresent) {
  console.log(JSON.stringify(out, null, 2));
  process.exit(0);
}

const supabase = createClient(url, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});

async function probe(table, select = "id") {
  const { data, error } = await supabase.from(table).select(select).limit(1);
  if (error) {
    return { error: error.message, code: error.code || null, details: error.details || null, hint: error.hint || null };
  }
  return { rowCount: Array.isArray(data) ? data.length : 0 };
}

out.tables["public.content_pages"] = await probe("content_pages", "id, title, slug, status, tree_parent_id, tree_root_key, tree_sort_order");
out.tables["public.media_items"] = await probe("media_items", "id");
out.tables["public.forms"] = await probe("forms", "id");

console.log(JSON.stringify(out, null, 2));
