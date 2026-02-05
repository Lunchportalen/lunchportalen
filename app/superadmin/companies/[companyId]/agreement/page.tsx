// app/superadmin/companies/[id]/agreement/page.tsx
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import Link from "next/link";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";

import AgreementClient from "./agreementClient";

function isUuid(v: any) {
  return (
    typeof v === "string" &&
    /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/.test(v)
  );
}

function nextUrl(companyId: string) {
  return `/superadmin/companies/${companyId}/agreement`;
}

export default async function CompanyAgreementPage(props: { params: { id: string } }) {
  const companyId = String(props?.params?.id ?? "").trim();
  if (!companyId || !isUuid(companyId)) redirect("/superadmin/companies");

  const sb = await supabaseServer();

  // -----------------------------
  // Auth gate
  // -----------------------------
  const { data: auth, error: authErr } = await sb.auth.getUser();
  const user = auth?.user ?? null;

  if (authErr || !user) {
    redirect(`/login?next=${encodeURIComponent(nextUrl(companyId))}`);
  }

  // -----------------------------
  // Role gate (fasit: profiles.id = auth.user.id)
  // -----------------------------
  const { data: profile, error: profErr } = await sb
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  // Fail closed
  if (profErr || !profile?.role) {
    redirect(`/login?next=${encodeURIComponent(nextUrl(companyId))}`);
  }

  const role = String(profile.role).toLowerCase();
  if (role !== "superadmin") {
    // Fail closed (ikke slippe inn)
    redirect("/login?next=/superadmin");
  }

  // -----------------------------
  // UI
  // -----------------------------
  return (
    <main className="mx-auto max-w-5xl p-6 lp-select-text">
      <header className="mb-6 flex items-center justify-between gap-3">
        <div>
          <div className="text-sm text-neutral-500">Superadmin</div>
          <h1 className="text-2xl font-semibold tracking-tight">Avtale / plan / binding</h1>
          <div className="text-sm text-neutral-500">Firma: {companyId}</div>
        </div>

        <div className="flex items-center gap-2">
          <Link
            className="rounded-xl border px-3 py-2 text-sm hover:bg-neutral-50"
            href={`/superadmin/companies/${companyId}`}
          >
            â Tilbake
          </Link>
        </div>
      </header>

      <AgreementClient companyId={companyId} />
    </main>
  );
}
