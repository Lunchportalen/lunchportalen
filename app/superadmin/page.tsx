// app/superadmin/page.tsx — kontrollsenter (én inngang for superadmin)
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import "server-only";

import { redirect } from "next/navigation";

import SuperadminControlCenter from "@/components/superadmin/SuperadminControlCenter";
import BlockedAccess from "@/components/auth/BlockedAccess";
import { getAuthContext } from "@/lib/auth/getAuthContext";
import { loadSuperadminHomeSignals } from "@/lib/superadmin/loadSuperadminHomeSignals";

export default async function SuperadminControlCenterPage() {
  const auth = await getAuthContext();

  if (!auth.ok) {
    if (auth.reason === "UNAUTHENTICATED") {
      redirect("/login?next=/superadmin&code=NO_SESSION");
    }
    return <BlockedAccess reason={auth.reason} />;
  }

  if (auth.role !== "superadmin") {
    return (
      <div className="rounded-2xl border border-[rgb(var(--lp-border))] bg-white/90 p-8 text-center">
        <p className="font-body text-base text-[rgb(var(--lp-fg))]">Ingen tilgang</p>
      </div>
    );
  }

  const signals = await loadSuperadminHomeSignals();

  return <SuperadminControlCenter signals={signals} />;
}
