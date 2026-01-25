// app/superadmin/firms/[companyId]/employees/page.tsx
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import Link from "next/link";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import FirmEmployeesClient from "@/components/superadmin/FirmEmployeesClient";

type PageProps = { params: { companyId: string } };

function isUuid(v: any) {
  return (
    typeof v === "string" &&
    /^[0-9a-fA-F-]{8}-[0-9a-fA-F-]{4}-[1-5][0-9a-fA-F-]{3}-[89abAB][0-9a-fA-F-]{3}-[0-9a-fA-F-]{12}$/.test(v)
  );
}

function norm(v: any) {
  return String(v ?? "").trim().toLowerCase();
}

export default async function SuperadminFirmEmployeesPage({ params }: PageProps) {
  const companyId = String(params?.companyId ?? "");
  if (!isUuid(companyId)) redirect("/superadmin/firms");

  const supabase = await supabaseServer();
  const { data: auth, error } = await supabase.auth.getUser();
  const user = auth?.user ?? null;

  if (error || !user) redirect(`/login?next=/superadmin/firms/${companyId}/employees`);

  // superadmin gate (samme fasit som du bruker ellers)
  if (norm(user.email) !== "superadmin@lunchportalen.no") redirect("/");

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <div className="mb-6">
        <Link href={`/superadmin/firms/${companyId}`} className="text-xs text-[rgb(var(--lp-muted))] hover:underline">
          ← Tilbake til firma
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Ansatte (full oversikt)</h1>
        <p className="mt-1 text-sm text-[rgb(var(--lp-muted))]">Superadmin: full oversikt + slett bruker.</p>
      </div>

      <div className="rounded-3xl bg-white/70 p-6 ring-1 ring-[rgb(var(--lp-border))]">
        <FirmEmployeesClient companyId={companyId} />
      </div>
    </main>
  );
}
