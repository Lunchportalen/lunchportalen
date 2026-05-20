export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import "server-only";

import Link from "next/link";
import { redirect } from "next/navigation";

import { PLAN_LABELS, loadAllProvidersWithSubscriptions } from "@/lib/providers/loadProviderBilling";
import { supabaseServer } from "@/lib/supabase/server";
import { getRoleForUser } from "@/lib/auth/getRoleForUser";
import { computeRole, hasRole, type Role } from "@/lib/auth/roles";

function formatNok(amount: number | null) {
  if (amount == null) return "—";
  return new Intl.NumberFormat("nb-NO", { style: "currency", currency: "NOK" }).format(amount);
}

export default async function SuperadminProvidersPage() {
  const sb = await supabaseServer();
  const { data, error } = await sb.auth.getUser();
  const user = data?.user ?? null;
  if (error || !user) redirect("/login?next=/superadmin/providers");

  let profileRole: string | null = null;
  try {
    profileRole = await getRoleForUser(user.id);
  } catch {
    profileRole = null;
  }
  const role: Role = computeRole(user, profileRole);
  if (!hasRole(role, ["superadmin"])) redirect("/status?state=paused&next=/superadmin/providers");

  const providers = await loadAllProvidersWithSubscriptions();

  return (
    <main className="lp-select-text mx-auto max-w-6xl px-4 py-10">
      <header className="mb-8">
        <p className="text-xs text-[rgb(var(--lp-muted))]">Superadmin</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight md:text-3xl">Leverandører</h1>
        <p className="mt-2 text-sm text-[rgb(var(--lp-muted))]">
          SaaS-lisens og fakturering per leverandør.
        </p>
        <div className="mt-4">
          <Link href="/superadmin" className="rounded-2xl border bg-white px-3 py-2 text-xs font-semibold">
            Dashboard
          </Link>
        </div>
      </header>

      <div className="overflow-x-auto rounded-2xl border bg-white">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b text-left text-xs uppercase tracking-wide text-neutral-500">
              <th className="px-4 py-3">Leverandør</th>
              <th className="px-4 py-3">Lisens</th>
              <th className="px-4 py-3">Beløp / mnd</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {providers.map((p) => (
              <tr key={p.id} className="border-b last:border-0">
                <td className="px-4 py-3 font-medium">{p.name}</td>
                <td className="px-4 py-3">
                  {p.has_subscription ? (PLAN_LABELS[p.plan ?? ""] ?? p.plan) : "Ikke satt"}
                </td>
                <td className="px-4 py-3">{formatNok(p.monthly_amount)}</td>
                <td className="px-4 py-3 text-right">
                  <Link
                    href={`/superadmin/providers/${p.id}/billing`}
                    className="rounded-xl border px-3 py-1.5 text-xs font-semibold hover:bg-neutral-50"
                  >
                    {p.has_subscription ? "Rediger lisens" : "Sett SaaS-fee"}
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
