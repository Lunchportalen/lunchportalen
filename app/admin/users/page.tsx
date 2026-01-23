// app/admin/users/page.tsx
export const revalidate = 0;

import Link from "next/link";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { supabaseServer } from "../../lib/supabase/server";

type UserRow = {
  user_id: string;
  full_name?: string | null;
  department?: string | null;
  created_at?: string | null;
};

type UsersResponse = {
  ok: boolean;
  companyId: string;
  count: number;
  users: UserRow[];
};

async function fetchUsers(cookieHeader: string): Promise<UsersResponse> {
  const res = await fetch("/api/admin/users", {
    method: "GET",
    headers: {
      cookie: cookieHeader,
      "content-type": "application/json",
    },
    cache: "no-store",
  });

  const json = await res.json().catch(() => null);
  if (!res.ok) throw new Error(json?.message ?? `HTTP ${res.status}`);
  return json as UsersResponse;
}

export default async function AdminUsersPage() {
  const supabase = await supabaseServer();
  const { data } = await supabase.auth.getUser();
  const user = data.user;

  if (!user) redirect("/login?next=/admin/users");

  const role = String(user.user_metadata?.role ?? "employee");
  if (role !== "company_admin") redirect("/admin");

  // Next 15: headers() is async
  const cookieHeader = (await headers()).get("cookie") ?? "";

  let payload: UsersResponse | null = null;
  let err: string | null = null;

  try {
    payload = await fetchUsers(cookieHeader);
  } catch (e: any) {
    err = String(e?.message ?? "Kunne ikke hente ansatte");
  }

  const users = payload?.users ?? [];

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <div className="mb-6 flex items-center justify-between gap-3">
        <div>
          <div className="text-xs text-[rgb(var(--lp-muted))]">Admin</div>
          <h1 className="text-xl font-semibold tracking-tight md:text-2xl">Ansatte</h1>
          <p className="mt-1 text-sm text-[rgb(var(--lp-muted))]">Lesetilgang til ansatte i ditt firma (RLS).</p>
        </div>

        <Link
          href="/admin/dashboard"
          className="rounded-2xl bg-white px-4 py-2 text-sm ring-1 ring-[rgb(var(--lp-border))] hover:bg-[rgb(var(--lp-surface))]"
        >
          Tilbake
        </Link>
      </div>

      {err ? (
        <div className="rounded-2xl bg-white p-5 ring-1 ring-[rgb(var(--lp-border))]">
          <div className="text-sm font-medium text-red-600">Kunne ikke laste data</div>
          <div className="mt-2 text-sm text-[rgb(var(--lp-muted))]">{err}</div>
        </div>
      ) : !payload ? (
        <div className="rounded-2xl bg-white p-5 ring-1 ring-[rgb(var(--lp-border))]">
          <div className="text-sm text-[rgb(var(--lp-muted))]">Laster…</div>
        </div>
      ) : (
        <div className="rounded-2xl bg-white p-6 ring-1 ring-[rgb(var(--lp-border))]">
          <div className="mb-4 flex items-center justify-between">
            <div className="text-sm font-semibold">
              Antall ansatte: <span className="font-normal text-[rgb(var(--lp-muted))]">{payload.count}</span>
            </div>
            <div className="text-xs text-[rgb(var(--lp-muted))]">Kun lesetilgang</div>
          </div>

          <div className="overflow-hidden rounded-xl ring-1 ring-[rgb(var(--lp-border))]">
            <table className="w-full text-left text-sm">
              <thead className="bg-[rgb(var(--lp-surface))] text-xs text-[rgb(var(--lp-muted))]">
                <tr>
                  <th className="px-4 py-3">Navn</th>
                  <th className="px-4 py-3">Avdeling</th>
                  <th className="px-4 py-3">Bruker-ID</th>
                  <th className="px-4 py-3">Opprettet</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.user_id} className="border-t border-[rgb(var(--lp-border))]">
                    <td className="px-4 py-3 font-medium">{u.full_name?.trim() ? u.full_name : "—"}</td>
                    <td className="px-4 py-3 text-[rgb(var(--lp-muted))]">{u.department?.trim() ? u.department : "—"}</td>
                    <td className="px-4 py-3 font-mono text-xs text-[rgb(var(--lp-muted))]">{u.user_id}</td>
                    <td className="px-4 py-3 text-xs text-[rgb(var(--lp-muted))]">
                      {u.created_at ? new Date(u.created_at).toLocaleDateString("nb-NO") : "—"}
                    </td>
                  </tr>
                ))}

                {users.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-6 text-sm text-[rgb(var(--lp-muted))]">
                      Ingen ansatte funnet.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>

          <div className="mt-6 rounded-xl bg-[rgb(var(--lp-surface))] p-4 text-xs text-[rgb(var(--lp-muted))] ring-1 ring-[rgb(var(--lp-border))]">
            Neste steg:
            <ul className="mt-2 list-disc pl-5">
              <li>Søk og filtrering</li>
              <li>Rollevisning per ansatt</li>
              <li>Eksport (CSV)</li>
            </ul>
          </div>
        </div>
      )}
    </main>
  );
}
