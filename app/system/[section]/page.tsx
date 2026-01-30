// app/system/[section]/page.tsx
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { redirect, notFound } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import type { Role, SystemSectionId } from "@/lib/system/types";
import { getSystemSection } from "@/lib/system/docs";
import SystemNav from "@/components/system/SystemNav";
import SystemSectionView from "@/components/system/SystemSection";
import RuntimeFactsCard from "@/components/system/RuntimeFactsCard";
import { getRuntimeFacts } from "@/lib/system/runtimeFacts";
import RouteComplianceCard from "@/components/system/RouteComplianceCard";
import { ROUTE_REGISTRY } from "@/lib/system/routeRegistry";
import HealthCard from "@/components/system/HealthCard";
import { runHealthChecks } from "@/lib/system/health";

function safeStr(v: unknown) {
  return String(v ?? "").trim();
}

function asRole(v: unknown): Role {
  const r = safeStr(v) as Role;
  if (r === "employee" || r === "company_admin" || r === "superadmin" || r === "kitchen" || r === "driver") return r;
  return "employee";
}

function safeSectionParam(v: unknown) {
  const s = safeStr(v);
  // Minimal sanitization for path/redirect safety (avoid weird segments)
  // Allowed: letters, numbers, dash
  return /^[a-z0-9-]+$/i.test(s) ? s : "";
}

export default async function SystemSectionPage({
  params,
}: {
  params: Promise<{ section: string }>;
}) {
  const p = await params;
  const section = safeSectionParam(p?.section);

  // Hvis param er ugyldig: 404 (ikke redirect-loop)
  if (!section) return notFound();

  const sb = await supabaseServer();

  /* =========================
     🔐 AUTH GATE
  ========================= */
  const { data: auth, error: authErr } = await sb.auth.getUser();
  if (authErr || !auth?.user) {
    redirect(`/login?next=/system/${encodeURIComponent(section)}`);
  }

  /* =========================
     🔐 ROLE GATE
     profiles.id = auth.user.id
  ========================= */
  const { data: profile, error: profileErr } = await sb
    .from("profiles")
    .select("role")
    .eq("id", auth.user.id)
    .maybeSingle();

  // Hvis vi ikke klarer å lese profil: fail tydelig (unngå å vise system)
  if (profileErr) {
    redirect(`/login?next=/system/${encodeURIComponent(section)}`);
  }

  const role = asRole(profile?.role);

  /* =========================
     📄 SECTION LOOKUP
  ========================= */
  const sec = getSystemSection(section);
  if (!sec) return notFound();

  const active = sec.id as SystemSectionId;
  const isSecurity = sec.id === "security";

  /* =========================
     ✅ SECURITY EXTRAS
  ========================= */
  // Runtime facts: fail-fast hvis env mangler
  const facts = isSecurity ? getRuntimeFacts() : null;

  // Health report: light-mode checks
  const health = isSecurity ? await runHealthChecks() : null;

  return (
    <div className="flex flex-col lg:flex-row gap-6">
      <SystemNav active={active} />
      <main className="flex-1 min-w-0 space-y-4">
        <SystemSectionView section={sec} role={role} />
        {facts ? <RuntimeFactsCard facts={facts} /> : null}
        {isSecurity ? <RouteComplianceCard items={ROUTE_REGISTRY} /> : null}
        {isSecurity && health ? <HealthCard report={health} /> : null}
      </main>
    </div>
  );
}
