// app/api/agreements/my-latest/route.ts


export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { jsonOk, jsonErr, makeRid } from "@/lib/http/respond";

/* =========================
   Response helpers
========================= */
function jsonError(status: number, error: string, message: string, detail?: any) {
  const r = String(detail?.rid ?? "") || makeRid();
  return jsonErr(r, message, status, error);
}

/* =========================
   Utils
========================= */
function safeText(v: any, max = 500) {
  const s = String(v ?? "").trim();
  return s ? s.slice(0, max) : "";
}

function isSafeStoragePath(p: string) {
  // enkel guard: ikke tom, ikke absolutt, ikke traversal
  if (!p) return false;
  if (p.startsWith("/") || p.startsWith("http")) return false;
  if (p.includes("..")) return false;
  return true;
}

/* =========================
   Route
========================= */
export async function GET() {
  
  const { supabaseServer } = await import("@/lib/supabase/server");
  const { supabaseAdmin } = await import("@/lib/supabase/admin");
  const rid = `agr_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

  // 1) Auth (cookie/session)
  const sb = await supabaseServer();
  const { data: auth, error: authErr } = await sb.auth.getUser();
  const user = auth?.user ?? null;

  if (authErr || !user) {
    return jsonError(401, "AUTH_REQUIRED", "Ikke innlogget.", { rid });
  }

  // 2) Tenant-sikker profil lookup (RLS) — bruk user_id, ikke admin service role
  const { data: profile, error: profileErr } = await sb
    .from("profiles")
    .select("company_id")
    .or(`id.eq.${user.id},user_id.eq.${user.id}`)
    .maybeSingle();

  if (profileErr) {
    return jsonError(500, "PROFILE_LOOKUP_FAILED", "Kunne ikke hente profil.", { rid, detail: profileErr.message });
  }

  const companyId = profile?.company_id ? String(profile.company_id) : "";
  if (!companyId) {
    return jsonError(404, "MISSING_COMPANY", "Ingen firmatilknytning funnet.", { rid });
  }

  // 3) Tenant-sikker company lookup (RLS)
  const { data: company, error: compErr } = await sb.from("companies").select("id, agreement_json").eq("id", companyId).maybeSingle();

  if (compErr) {
    return jsonError(500, "COMPANY_LOOKUP_FAILED", "Kunne ikke hente firma.", { rid, detail: compErr.message });
  }
  if (!company?.id) {
    return jsonError(404, "COMPANY_NOT_FOUND", "Fant ikke firma.", { rid, companyId });
  }

  // 4) Finn pdfPath i agreement_json (låst format)
  // Fasit: agreement_json.terms.pdfPath (som du allerede bruker)
  const agreementJson = (company as any)?.agreement_json ?? null;
  const pdfPath = safeText(agreementJson?.terms?.pdfPath, 500);

  if (!pdfPath) {
    return jsonError(404, "NO_AGREEMENT_PDF", "Ingen avtale-PDF funnet for firmaet.", { rid, companyId });
  }
  if (!isSafeStoragePath(pdfPath)) {
    return jsonError(400, "BAD_PDF_PATH", "Ugyldig pdfPath i avtaleoppsett.", { rid, companyId, pdfPath });
  }

  // 5) Signert URL må lages med service role (storage signed URL)
  const admin = supabaseAdmin();
  const { data, error } = await admin.storage.from("agreements").createSignedUrl(pdfPath, 60);

  if (error || !data?.signedUrl) {
    return jsonError(500, "SIGNED_URL_FAILED", "Kunne ikke lage nedlastingslenke.", { rid, detail: error?.message ?? "unknown" });
  }

  return jsonOk(rid, {
    ok: true,
    rid,
    companyId,
    url: data.signedUrl,
    expiresInSeconds: 60,
  });
}
