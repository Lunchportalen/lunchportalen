// app/api/superadmin/users/cleanup/route.ts


export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { isSuperadminEmail, normEmail } from "@/lib/system/emails";
import { jsonErr, jsonOk, makeRid } from "@/lib/http/respond";

function jsonError(rid: string, status: number, error: string, message: string, detail?: any) {
  const err = detail !== undefined ? { code: error, detail } : error;
  return jsonErr(rid, message, status, err);
}

type Role = "employee" | "company_admin" | "superadmin" | "kitchen" | "driver";

function isEmail(v: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

async function requireSuperadmin() {
  const { supabaseServer } = await import("@/lib/supabase/server");
  const sb = await supabaseServer();
  const { data: auth, error } = await sb.auth.getUser();
  const user = auth?.user ?? null;
  if (error || !user) throw Object.assign(new Error("not_authenticated"), { code: "not_authenticated" });

  // Hard-fasit på systemkonto, som dere allerede bruker
  if (isSuperadminEmail(user.email)) return { user, actorEmail: user.email ?? null };

  // Fallback: profiles.role hvis dere også støtter det
  const { supabaseAdmin } = await import("@/lib/supabase/admin");
  const admin = supabaseAdmin();
  const p = await admin.from("profiles").select("role").eq("user_id", user.id).maybeSingle();
  const role = String(p.data?.role ?? user.user_metadata?.role ?? "").trim().toLowerCase() as Role;
  if (role !== "superadmin") throw Object.assign(new Error("forbidden"), { code: "forbidden" });

  return { user, actorEmail: user.email ?? null };
}

async function bestEffortAudit(admin: ReturnType<typeof import("@/lib/supabase/admin").supabaseAdmin>, evt: any) {
  try {
    await admin.from("audit_events").insert({
      actor_user_id: evt.actor_user_id,
      actor_email: evt.actor_email,
      actor_role: evt.actor_role,
      action: evt.action,
      company_id: evt.company_id ?? null,
      location_id: evt.location_id ?? null,
      entity_type: evt.entity_type,
      entity_id: evt.entity_id,
      summary: evt.summary ?? null,
      detail: evt.detail ?? null,
    });
  } catch {}
}

async function findAuthUserIdByEmail(admin: ReturnType<typeof import("@/lib/supabase/admin").supabaseAdmin>, email: string) {
  // Iterer noen sider for sikkerhet (kan økes senere)
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) return { userId: null as string | null, error };
    const hit = (data?.users ?? []).find((u) => normEmail(u.email) === normEmail(email));
    if (hit?.id) return { userId: String(hit.id), error: null };
    if ((data?.users ?? []).length < 200) break;
  }
  return { userId: null as string | null, error: null };
}

export async function POST(req: Request) {
  const { supabaseAdmin } = await import("@/lib/supabase/admin");
  const rid = makeRid();

  try {
    const { user, actorEmail } = await requireSuperadmin();
    const body = await req.json().catch(() => ({}));

    const email = normEmail(body.email);
    const dryRun = Boolean(body.dryRun);

    if (!email || !isEmail(email)) return jsonError(rid, 400, "invalid_email", "Ugyldig e-post.");

    const admin = supabaseAdmin();

    // Finn hva som finnes (før slett)
    const prof = await admin
      .from("profiles")
      .select("user_id, email, company_id, role, created_at")
      .ilike("email", email)
      .order("created_at", { ascending: false })
      .limit(5);

    const inv = await admin
      .from("employee_invites")
      .select("id, email, company_id, used_at, expires_at, created_at")
      .eq("email", email)
      .order("created_at", { ascending: false })
      .limit(20);

    const authHit = await findAuthUserIdByEmail(admin, email);

    if (dryRun) {
      return jsonOk(rid, {
        ok: true,
        rid,
        dryRun: true,
        email,
        found: {
          authUserId: authHit.userId,
          profiles: prof.data ?? [],
          invites: inv.data ?? [],
        },
      }, 200);
    }

    // 1) Slett invites først
    const delInv = await admin.from("employee_invites").delete().eq("email", email);

    // 2) Slett profiles (alle rader med email)
    const delProf = await admin.from("profiles").delete().ilike("email", email);

    // 3) Slett auth user hvis funnet
    let authDeleted = false;
    let authDeleteError: any = null;
    if (authHit.error) authDeleteError = authHit.error;
    if (authHit.userId) {
      const del = await admin.auth.admin.deleteUser(authHit.userId);
      authDeleted = !del.error;
      authDeleteError = del.error ?? null;
    }

    await bestEffortAudit(admin, {
      actor_user_id: user.id,
      actor_email: actorEmail,
      actor_role: "superadmin",
      action: "SUPERADMIN_CLEANUP_EMAIL",
      entity_type: "email",
      entity_id: email, // ikke uuid, men ok som entity_id i logg om dere tillater text – hvis entity_id er uuid hos dere, sett entity_id = user.id og legg email i detail
      summary: "Cleanup by email",
      detail: {
        rid,
        email,
        profilesDeleted: delProf.error ? null : true,
        invitesDeleted: delInv.error ? null : true,
        authUserId: authHit.userId,
        authDeleted,
        errors: {
          invites: delInv.error ?? null,
          profiles: delProf.error ?? null,
          authFind: authHit.error ?? null,
          authDelete: authDeleteError,
        },
      },
    });

    return jsonOk(rid, {
      ok: true,
      rid,
      email,
      results: {
        invitesDeleted: delInv.error ? false : true,
        profilesDeleted: delProf.error ? false : true,
        authUserId: authHit.userId,
        authDeleted,
      },
      errors: {
        invites: delInv.error ?? null,
        profiles: delProf.error ?? null,
        authFind: authHit.error ?? null,
        authDelete: authDeleteError,
      },
    }, 200);
  } catch (e: any) {
    const code = e?.code || "unknown";
    if (code === "not_authenticated") return jsonError(rid, 401, "not_authenticated", "Du må være innlogget.");
    if (code === "forbidden") return jsonError(rid, 403, "forbidden", "Ingen tilgang.");
    return jsonError(rid, 500, "server_error", "Uventet feil.", { detail: String(e?.message ?? e) });
  }
}
