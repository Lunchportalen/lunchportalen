// app/admin/users/page.tsx
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import Link from "next/link";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { supabaseServer } from "@/lib/supabase/server";
import SupportReportButton from "@/components/admin/SupportReportButton";
import { systemRoleByEmail } from "@/lib/system/emails";
import { formatDateNO } from "@/lib/date/format";

type Role = "employee" | "company_admin" | "superadmin" | "kitchen" | "driver";

type UserRow = {
  id: string; // ✅ profiles.id (auth.users.id)
  full_name?: string | null;
  department?: string | null;
  created_at?: string | null;
  disabled_at?: string | null;
};

type UsersResponseOk = {
  ok: true;
  rid?: string;
  companyId: string;
  count: number;
  users: UserRow[];
};

type UsersResponseErr = {
  ok: false;
  rid?: string;
  error: string;
  message: string;
  detail?: any;
};

type UsersApi = UsersResponseOk | UsersResponseErr;

/* =========================================================
   Role helpers (samme prinsipp som middleware/admin)
========================================================= */
function roleByEmail(email: string | null | undefined): Role | null {
  return systemRoleByEmail(email);
}

function roleFromMetadata(user: any): Role {
  const raw = String(user?.user_metadata?.role ?? "employee").toLowerCase();
  if (raw === "company_admin") return "company_admin";
  if (raw === "superadmin") return "superadmin";
  if (raw === "kitchen") return "kitchen";
  if (raw === "driver") return "driver";
  return "employee";
}

function computeRole(user: any, profileRole?: any): Role {
  const byEmail = roleByEmail(user?.email);
  if (byEmail) return byEmail;

  const pr = String(profileRole ?? "").toLowerCase();
  if (pr === "company_admin") return "company_admin";
  if (pr === "superadmin") return "superadmin";
  if (pr === "kitchen") return "kitchen";
  if (pr === "driver") return "driver";
  if (pr === "employee") return "employee";

  return roleFromMetadata(user);
}

function fmtDate(ts?: string | null) {
  if (!ts) return "—";
  return formatDateNO(ts);
}

function safeText(v: any) {
  const s = String(v ?? "").trim();
  return s.length ? s : "—";
}

/* =========================================================
   Type guard (fikser TS narrowing 100 %)
========================================================= */
function isUsersErr(v: UsersApi): v is UsersResponseErr {
  return v.ok === false;
}

/* =========================================================
   Fetch (server-safe absolut URL)
========================================================= */
async function fetchUsers(cookieHeader: string): Promise<UsersApi> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "http";

  if (!host) {
    return { ok: false, error: "MISSING_HOST", message: "Missing host header" };
  }

  const url = `${proto}://${host}/api/admin/users`;

  const res = await fetch(url, {
    method: "GET",
    headers: {
      cookie: cookieHeader,
      "content-type": "application/json",
    },
    cache: "no-store",
  });

  const json = (await res.json().catch(() => null)) as any;

  if (!json || typeof json.ok !== "boolean") {
    return { ok: false, error: "BAD_RESPONSE", message: "Ugyldig respons fra /api/admin/users", detail: json };
  }

  if (!res.ok) {
    return {
      ok: false,
      rid: json?.rid,
      error: json?.error ?? "HTTP_ERROR",
      message: json?.message ?? `HTTP ${res.status}`,
      detail: json?.detail,
    };
  }

  return json as UsersResponseOk;
}

/* =========================================================
   Page
========================================================= */
export default async function AdminUsersPage() {
  const supabase = await supabaseServer();
  const { data } = await supabase.auth.getUser();
  const user = data.user;

  if (!user) redirect("/login?next=/admin/users");

  /**
   * ✅ FASIT:
   * profiles.id === auth.users.id
   * Ingen fallback til profiles.user_id
   */
  const { data: profile } = await supabase.from("profiles").select("role, company_id").eq("id", user.id).maybeSingle();

  const role = computeRole(user, profile?.role);

  // Kun company_admin her
  if (role !== "company_admin") redirect("/admin");

  // Må være knyttet til firma (enterprise gate)
  if (!profile?.company_id) redirect("/admin");

  const cookieHeader = (await headers()).get("cookie") ?? "";
  const api = await fetchUsers(cookieHeader);

  let payload: UsersResponseOk | null = null;
  let err: UsersResponseErr | null = null;

  if (isUsersErr(api)) err = api;
  else payload = api;

  const users = payload?.users ?? [];
  const activeCount = users.filter((u) => !u.disabled_at).length;
  const disabledCount = users.filter((u) => !!u.disabled_at).length;

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="text-xs text-[rgb(var(--lp-muted))]">Admin</div>
          <h1 className="text-xl font-semibold tracking-tight md:text-2xl">Ansatte</h1>
          <p className="mt-1 text-sm text-[rgb(var(--lp-muted))]">Oversikt over ansatte i ditt firma (RLS). Ingen unntak.</p>
        </div>

        <Link
          href="/admin"
          className="rounded-2xl bg-white px-4 py-2 text-sm ring-1 ring-[rgb(var(--lp-border))] hover:bg-[rgb(var(--lp-surface))]"
        >
          Tilbake
        </Link>
      </div>

      {err ? (
        <div className="rounded-3xl bg-white p-6 ring-1 ring-[rgb(var(--lp-border))]">
          <div className="text-sm font-semibold text-red-700">Kunne ikke laste ansatte</div>
          <div className="mt-2 text-sm text-[rgb(var(--lp-muted))]">{err.message}</div>

          <div className="mt-4 text-xs text-[rgb(var(--lp-muted))]">
            {err.rid ? (
              <>
                RID: <span className="font-mono">{err.rid}</span>
              </>
            ) : (
              <>Ingen RID tilgjengelig.</>
            )}
          </div>

          <div className="mt-4">
            <SupportReportButton reason="ADMIN_USERS_PAGE_FETCH_FAILED" companyId={profile?.company_id ?? null} locationId={null} />
          </div>
        </div>
      ) : !payload ? (
        <div className="rounded-3xl bg-white p-6 ring-1 ring-[rgb(var(--lp-border))]">
          <div className="text-sm text-[rgb(var(--lp-muted))]">Laster…</div>
        </div>
      ) : (
        <div className="rounded-3xl bg-white p-6 ring-1 ring-[rgb(var(--lp-border))]">
          <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div className="text-sm font-semibold">
              Antall ansatte:{" "}
              <span className="font-normal text-[rgb(var(--lp-muted))]">
                {payload.count} (aktive: {activeCount}, deaktivert: {disabledCount})
              </span>
            </div>
            <div className="text-xs text-[rgb(var(--lp-muted))]">
              Firma-ID: <span className="font-mono">{payload.companyId}</span>
            </div>
          </div>

          <div className="rounded-2xl ring-1 ring-[rgb(var(--lp-border))]">
            <table className="w-full text-left text-sm">
              <thead className="bg-[rgb(var(--lp-surface))] text-xs text-[rgb(var(--lp-muted))]">
                <tr>
                  <th className="px-4 py-3">Navn</th>
                  <th className="px-4 py-3">Avdeling</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Bruker-ID</th>
                  <th className="px-4 py-3">Opprettet</th>
                </tr>
              </thead>

              <tbody>
                {users.map((u) => {
                  const disabled = Boolean(u.disabled_at);
                  return (
                    <tr key={u.id} className="border-t border-[rgb(var(--lp-border))]">
                      <td className="px-4 py-3 font-medium">{safeText(u.full_name)}</td>
                      <td className="px-4 py-3 text-[rgb(var(--lp-muted))]">{safeText(u.department)}</td>
                      <td className="px-4 py-3">
                        <span
                          className={[
                            "inline-flex items-center rounded-xl px-3 py-1 text-xs font-semibold ring-1",
                            disabled
                              ? "bg-white/70 text-[rgb(var(--lp-muted))] ring-[rgb(var(--lp-border))]"
                              : "bg-black text-white ring-black",
                          ].join(" ")}
                        >
                          {disabled ? "Deaktivert" : "Aktiv"}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-[rgb(var(--lp-muted))]">{u.id}</td>
                      <td className="px-4 py-3 text-xs text-[rgb(var(--lp-muted))]">{fmtDate(u.created_at)}</td>
                    </tr>
                  );
                })}

                {users.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-6 text-sm text-[rgb(var(--lp-muted))]">
                      Ingen ansatte funnet.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>

          <div className="mt-6 rounded-2xl bg-[rgb(var(--lp-surface))] p-4 text-xs text-[rgb(var(--lp-muted))] ring-1 ring-[rgb(var(--lp-border))]">
            Enterprise-notat:
            <ul className="mt-2 list-disc pl-5">
              <li>Dette er oversikt – endringer (inviter/deaktiver) gjøres via kontrollerte API-ruter med audit.</li>
              <li>Ingen manuelle unntak. Firmadata og RLS er fasit.</li>
              <li>Ved avvik: bruk “Send systemrapport” for audit + RID.</li>
            </ul>
          </div>
        </div>
      )}
    </main>
  );
}
