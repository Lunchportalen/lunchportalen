

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { jsonErr, jsonOk, makeRid } from "@/lib/http/respond";

function isUuid(v: any) {
  return (
    typeof v === "string" &&
    /^[0-9a-fA-F-]{8}-[0-9a-fA-F-]{4}-[1-5][0-9a-fA-F-]{3}-[89abAB][0-9a-fA-F-]{3}-[0-9a-fA-F-]{12}$/.test(v)
  );
}

/**
 * Hos dere kan supabaseAdmin være:
 * - et client-objekt (med .from)
 * - ELLER en factory-funksjon som returnerer client
 * Vi normaliserer til et "db"-objekt.
 */
async function adminDb(): Promise<any> {
  const { supabaseAdmin } = await import("@/lib/supabase/admin");
  const s: any = supabaseAdmin as any;
  return typeof s === "function" ? await s() : s;
}

async function requireSuperadmin() {
  const { supabaseServer } = await import("@/lib/supabase/server");
  const supabase = await supabaseServer();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return { ok: false as const, status: 401, message: "Ikke innlogget" };

  const role = String(data.user.user_metadata?.role ?? "");
  if (role !== "superadmin") return { ok: false as const, status: 403, message: "Ingen tilgang" };

  return { ok: true as const, userId: data.user.id };
}

type Item = {
  company_id: string;
  tripletex_customer_id: string;
  product_name?: string | null;
  vat_code?: string | null;
};

export async function POST(req: Request) {
  const rid = makeRid();
  const guard = await requireSuperadmin();
  if (!guard.ok) return jsonErr(rid, guard.message, guard.status ?? 400, "AUTH");

  const body = await req.json().catch(() => null);

  const items: Item[] = Array.isArray(body?.items) ? body.items : [];
  if (!items.length) return jsonErr(rid, "Ingen items mottatt", 400, "BAD_REQUEST");

  const normalized: {
    company_id: string;
    tripletex_customer_id: string;
    product_name: string | null;
    vat_code: string | null;
  }[] = [];

  const errors: { index: number; company_id?: string; reason: string }[] = [];

  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    const company_id = String(it?.company_id ?? "").trim();
    const customer = String(it?.tripletex_customer_id ?? "").trim();

    if (!isUuid(company_id)) {
      errors.push({ index: i, company_id, reason: "Ugyldig company_id (UUID)" });
      continue;
    }
    if (!customer.length) {
      errors.push({ index: i, company_id, reason: "Manglende tripletex_customer_id" });
      continue;
    }

    normalized.push({
      company_id,
      tripletex_customer_id: customer,
      product_name: it?.product_name != null ? String(it.product_name).trim() || null : null,
      vat_code: it?.vat_code != null ? String(it.vat_code).trim() || null : null,
    });
  }

  if (!normalized.length) return jsonErr(rid, "Ingen gyldige linjer", 400, { code: "BAD_REQUEST", detail: { errors } });

  const db = await adminDb();
  if (!db?.from) return jsonErr(rid, "supabaseAdmin er ikke tilgjengelig (mangler .from)", 500, "ADMIN_CLIENT_MISSING");

  // Upsert i batch (idempotent)
  const { error } = await db
    .from("company_billing_accounts")
    .upsert(normalized, { onConflict: "company_id" });

  if (error) return jsonErr(rid, "Kunne ikke bulk-lagre mapping", 500, { code: "DB", detail: error });

  return jsonOk(rid, {
    received: items.length,
    upserted: normalized.length,
    failed: errors.length,
    errors,
  });
}
