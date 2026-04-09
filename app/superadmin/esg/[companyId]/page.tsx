// app/superadmin/esg/[companyId]/page.tsx
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { redirect, notFound } from "next/navigation";
import SuperadminEsgClient from "./SuperadminEsgClient";
import { supabaseServer } from "@/lib/supabase/server";
import { isSuperadminProfile } from "@/lib/auth/isSuperadminProfile";

type Props = { params: { companyId: string } | Promise<{ companyId: string }> };

function safeStr(v: any) {
  return String(v ?? "").trim();
}

function isUuid(v: any) {
  return (
    typeof v === "string" &&
    /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/.test(v)
  );
}

export default async function SuperadminEsgCompanyPage({ params }: Props) {
  const p = (await params) as { companyId: string };
  const companyId = safeStr(p?.companyId);

  if (!companyId || !isUuid(companyId)) notFound();

  const sb = await supabaseServer();

  // Auth gate
  const { data: auth, error: authErr } = await sb.auth.getUser();
  const user = auth?.user ?? null;

  if (authErr || !user) {
    redirect(`/login?next=/superadmin/esg/${encodeURIComponent(companyId)}`);
  }

  if (!(await isSuperadminProfile(user.id))) {
    redirect("/login?next=/superadmin");
  }

  return (
    <main className="mx-auto max-w-6xl px-4 pb-16 pt-8 lp-select-text">
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold tracking-tight">ESG</h1>
        <p className="mt-1 text-sm text-[rgb(var(--lp-muted))]">
          Firma: <span className="font-mono text-xs">{companyId}</span>
        </p>
      </div>

      <SuperadminEsgClient companyId={companyId} />
    </main>
  );
}
