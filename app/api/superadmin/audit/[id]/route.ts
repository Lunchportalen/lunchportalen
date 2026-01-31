// app/api/superadmin/audit/[id]/route.ts


export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type Ctx = {
  params: { id: string } | Promise<{ id: string }>;
};

function noStore() {
  return {
    "Cache-Control": "no-store, max-age=0",
    Pragma: "no-cache",
    Expires: "0",
  };
}

function json(status: number, body: any) {
  return NextResponse.json(body, { status, headers: noStore() });
}

function jsonError(status: number, error: string, message: string, detail?: any) {
  return json(status, { ok: false, error, message, detail: detail ?? undefined });
}

function normEmail(v: any) {
  return String(v ?? "").trim().toLowerCase();
}

function isUuid(v: string) {
  return /^[0-9a-fA-F-]{8}-[0-9a-fA-F-]{4}-[1-5][0-9a-fA-F-]{3}-[89abAB][0-9a-fA-F-]{3}-[0-9a-fA-F-]{12}$/.test(
    v
  );
}

function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL");
  if (!key) throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY");

  return createClient(url, key, { auth: { persistSession: false } });
}

export async function GET(_req: Request, ctx: Ctx) {
  
  const { supabaseAdmin } = await import("@/lib/supabase/admin");
  const { supabaseServer } = await import("@/lib/supabase/server");
  const rid = `sa_audit_one_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

  const params = await ctx.params;
  const id = String((params as any)?.id ?? "").trim();

  if (!isUuid(id)) {
    return jsonError(400, "invalid_id", "Ugyldig audit-id", { rid });
  }

  // ✅ VIKTIG: await
  const supabase = await supabaseServer();

  // --- auth ---
  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser();

  if (authErr || !user) {
    return jsonError(401, "unauthorized", "Ikke innlogget", { rid });
  }

  // ✅ Hard superadmin-fasit (unngå metadata-triksing)
  if (normEmail(user.email) !== "superadmin@lunchportalen.no") {
    return jsonError(403, "forbidden", "Kun superadmin har tilgang", { rid });
  }

  // --- fetch audit ---
  let admin: ReturnType<typeof import("@/lib/supabase/admin").supabaseAdmin>;
  try {
    admin = supabaseAdmin();
  } catch (e: any) {
    return jsonError(500, "missing_service_role_key", String(e?.message ?? e), { rid });
  }

  // Velg kun felt vi faktisk trenger (stabil API-kontrakt)
  const { data, error } = await admin
    .from("audit_events")
    .select("id,created_at,actor_user_id,actor_email,actor_role,action,entity_type,entity_id,summary,detail")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    return jsonError(500, "read_failed", "Kunne ikke hente audit-hendelse", { rid, db: error });
  }

  if (!data) {
    return jsonError(404, "not_found", "Audit-hendelse finnes ikke", { rid });
  }

  return json(200, {
    ok: true,
    rid,
    audit: {
      id: data.id,
      created_at: data.created_at,
      actor_user_id: data.actor_user_id ?? null,
      actor_email: data.actor_email ?? null,
      actor_role: data.actor_role ?? null,
      action: data.action,
      entity_type: data.entity_type,
      entity_id: data.entity_id,
      summary: data.summary ?? null,
      detail: data.detail ?? null,
    },
  });
}



