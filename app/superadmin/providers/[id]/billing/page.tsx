export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import "server-only";

import Link from "next/link";
import { redirect } from "next/navigation";

import SubscriptionEditor from "@/components/superadmin/SubscriptionEditor";
import { loadProviderBilling } from "@/lib/providers/loadProviderBilling";
import { supabaseServer } from "@/lib/supabase/server";
import { getRoleForUser } from "@/lib/auth/getRoleForUser";
import { computeRole, hasRole, type Role } from "@/lib/auth/roles";

export default async function SuperadminProviderBillingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: providerId } = await params;

  const sb = await supabaseServer();
  const { data, error } = await sb.auth.getUser();
  const user = data?.user ?? null;
  if (error || !user) redirect(`/login?next=%2Fsuperadmin%2Fproviders%2F${providerId}%2Fbilling`);

  let profileRole: string | null = null;
  try {
    profileRole = await getRoleForUser(user.id);
  } catch {
    profileRole = null;
  }
  const role: Role = computeRole(user, profileRole);
  if (!hasRole(role, ["superadmin"])) redirect("/status?state=paused");

  const { data: providerRow } = await sb
    .from("providers")
    .select("id, name, contact_email, org_number")
    .eq("id", providerId)
    .is("deleted_at", null)
    .maybeSingle();

  if (!providerRow) redirect("/superadmin/providers");

  const bundle = await loadProviderBilling(providerId);

  return (
    <main className="lp-select-text mx-auto max-w-3xl px-4 py-10">
      <header className="mb-6">
        <Link href="/superadmin/providers" className="text-sm text-[rgb(var(--lp-muted))] hover:underline">
          ← Leverandører
        </Link>
        <h1 className="mt-3 text-2xl font-semibold">{providerRow.name}</h1>
        <p className="mt-1 text-sm text-[rgb(var(--lp-muted))]">SaaS-fakturering</p>
      </header>
      <SubscriptionEditor
        providerId={providerId}
        providerName={providerRow.name}
        defaultEmail={providerRow.contact_email}
        defaultOrgNumber={providerRow.org_number}
        bundle={bundle}
      />
      {bundle.invoices.length > 0 ? (
        <section className="ds-card mt-6">
          <h2 className="ds-h4">Genererte fakturaer</h2>
          <ul className="ds-provider-invoice-mini-list">
            {bundle.invoices.map((inv) => (
              <li key={inv.id}>
                {inv.invoice_period} · {inv.invoice_number} · {inv.amount_total} NOK ({inv.status})
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </main>
  );
}
