import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { verifyTable } from "@/lib/db/verifyTable";
import type { Database } from "@/lib/types/database";

import type { CtoCollectedData } from "./types";

const ROUTE = "cto_collect";
const MAX_ORDERS = 50_000;
const MAX_LEADS = 20_000;
const MAX_LOGS = 10_000;

/**
 * Henter begrensede rader fra ordre, lead-pipeline og AI-aktivitetslogg.
 * Bruker service role der dette kalles fra API (RLS-omgåelse kun server-side).
 */
export async function collectCtoData(
  supabase: SupabaseClient<Database>
): Promise<CtoCollectedData> {
  const empty: CtoCollectedData = { orders: [], leads: [], logs: [] };

  const ordersOk = await verifyTable(supabase, "orders", ROUTE);
  const leadsOk = await verifyTable(supabase, "lead_pipeline", ROUTE);
  const logsOk = await verifyTable(supabase, "ai_activity_log", ROUTE);

  const orders: CtoCollectedData["orders"] = [];
  const leads: CtoCollectedData["leads"] = [];
  const logs: CtoCollectedData["logs"] = [];

  if (ordersOk) {
    const { data, error } = await supabase
      .from("orders")
      .select("id, line_total, total_amount, created_at, status")
      .limit(MAX_ORDERS);
    if (!error && Array.isArray(data)) orders.push(...data);
  }

  if (leadsOk) {
    const { data, error } = await supabase
      .from("lead_pipeline")
      .select("id, source_post_id, contact_email, created_at")
      .limit(MAX_LEADS);
    if (!error && Array.isArray(data)) leads.push(...data);
  }

  if (logsOk) {
    const { data, error } = await supabase
      .from("ai_activity_log")
      .select("id, action, metadata, created_at")
      .limit(MAX_LOGS);
    if (!error && Array.isArray(data)) logs.push(...data);
  }

  return { orders, leads, logs };
}
