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

export default async function CompanyAgreementPage(props: { params: { id: string } }) {
  const companyId = String(props?.params?.id ?? "").trim();
  if (!companyId || !isUuid(companyId)) redirect("/superadmin/companies");

  // ✅ Server auth check uten getScope(req) (som er API-only)
  const sb = await Promise.resolve(supabaseServer() as any);

  const { data: userRes, error: userErr } = await sb.auth.getUser();
  const user = userRes?.user ?? null;

  if (userErr || !user) {
    redirect(`/login?next=${encodeURIComponent(`/superadmin/companies/${companyId}/agreement`)}`);
  }

  // Hent rolle fra profiles (fasit hos dere)
  const { data: profile, error: profErr } = await sb
    .from("profiles")
    .select("role")
    .eq("user_id", user.id)
    .maybeSingle();

  if (profErr) {
    // Fail closed
    redirect(`/login?next=${encodeURIComponent(`/superadmin/companies/${companyId}/agreement`)}`);
  }

  const role = String((profile as any)?.role ?? "").toLowerCase();
  if (role !== "superadmin") {
    redirect(`/login?next=${encodeURIComponent(`/superadmin`)}`);
  }

  return (
    <div className="mx-auto max-w-5xl p-6">
      <div className="mb-6 flex items-center justify-between gap-3">
        <div>
          <div className="text-sm text-neutral-500">Superadmin</div>
          <h1 className="text-2xl font-semibold tracking-tight">Avtale / plan / binding</h1>
          <div className="text-sm text-neutral-500">Firma: {companyId}</div>
        </div>

        <div className="flex items-center gap-2">
          <Link className="rounded-xl border px-3 py-2 text-sm hover:bg-neutral-50" href={`/superadmin/companies/${companyId}`}>
            ← Tilbake
          </Link>
        </div>
      </div>

      <AgreementClient companyId={companyId} />
    </div>
  );
}
