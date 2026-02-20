export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import "server-only";

import React from "react";
import { redirect } from "next/navigation";

import { supabaseServer } from "@/lib/supabase/server";
import { getRoleForUser } from "@/lib/auth/getRoleForUser";
import { computeRole, hasRole, type Role } from "@/lib/auth/roles";

import AgreementsClient from "./agreements-client";

async function fetchAgreements() {
  const sb = await supabaseServer();
  const { data, error } = await sb
    .from("agreements")
    .select(
      `
      id,
      company_id,
      location_id,
      status,
      tier,
      delivery_days,
      starts_at,
      ends_at,
      slot_start,
      slot_end,
      binding_months,
      notice_months,
      price_per_employee,
      created_at,
      updated_at,
      companies:company_id ( name )
    `
    )
    .order("updated_at", { ascending: false })
    .limit(200);

  if (error) return { ok: false as const, message: error.message, agreements: [] as any[] };

  const agreements =
    (data ?? []).map((a: any) => ({
      id: String(a.id),
      company_id: String(a.company_id),
      company_name: String(a.companies?.name ?? "Firma"),
      location_id: a.location_id ?? null,
      status: String(a.status ?? "UNKNOWN").toUpperCase(),
      tier: String(a.tier ?? ""),
      delivery_days: Array.isArray(a.delivery_days) ? a.delivery_days : [],
      starts_at: a.starts_at ?? null,
      ends_at: a.ends_at ?? null,
      slot_start: a.slot_start ?? null,
      slot_end: a.slot_end ?? null,
      binding_months: a.binding_months ?? null,
      notice_months: a.notice_months ?? null,
      price_per_employee: a.price_per_employee ?? null,
      created_at: a.created_at ?? null,
      updated_at: a.updated_at ?? null,
    })) ?? [];

  return { ok: true as const, agreements };
}

export default async function SuperadminAgreementsPage() {
  {
    const sb = await supabaseServer();
    const { data, error } = await sb.auth.getUser();
    const user = data?.user ?? null;

    if (error || !user) redirect("/login?next=/superadmin/agreements");

    let profileRole: any = null;
    try {
      profileRole = await getRoleForUser(user.id);
    } catch {
      profileRole = null;
    }

    const role: Role = computeRole(user, profileRole);
    if (!hasRole(role, ["superadmin"])) redirect("/status?state=paused&next=/superadmin/agreements");
  }

  const initial = await fetchAgreements();

  return (
    <div className="w-full px-4 sm:px-6 lg:px-10 py-8">
      <h1 className="lp-h1">Avtaler</h1>
      <p className="mt-2 text-sm lp-muted">Opprett avtale som Venter og godkjenn den når alt er klart.</p>

      <div className="mt-6">
        <AgreementsClient initial={initial} />
      </div>
    </div>
  );
}
