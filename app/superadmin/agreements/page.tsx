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
import {
  deriveSuperadminAgreementListRowPresentation,
  indexLedgerAgreementsByCompanyId,
} from "@/lib/server/superadmin/loadCompanyRegistrationsInbox";

function safeStr(v: unknown, fallback = "") {
  const s = String(v ?? "").trim();
  return s || fallback;
}

function companyFieldFromJoin(comp: unknown, key: "name" | "status"): string | null {
  if (comp && typeof comp === "object" && !Array.isArray(comp)) {
    const v = (comp as Record<string, unknown>)[key];
    return key === "status" ? safeStr(v).toUpperCase() || null : safeStr(v) || null;
  }
  if (Array.isArray(comp) && comp[0] && typeof comp[0] === "object") {
    const v = (comp[0] as Record<string, unknown>)[key];
    return key === "status" ? safeStr(v).toUpperCase() || null : safeStr(v) || null;
  }
  return null;
}

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
      activated_at,
      rejection_reason,
      companies:company_id ( name, status )
    `
    )
    .eq("status", "PENDING")
    .order("updated_at", { ascending: false })
    .limit(200);

  if (error) return { ok: false as const, message: error.message, agreements: [] as any[] };

  const rawRows = data ?? [];
  const companyIds = [...new Set(rawRows.map((a: any) => safeStr(a.company_id)).filter(Boolean))];
  let pendingIdByCompany = new Map<string, string>();
  let activeIdByCompany = new Map<string, string>();
  if (companyIds.length) {
    const { data: ledgerData, error: ledgerErr } = await sb
      .from("agreements")
      .select("id,company_id,status,created_at")
      .in("company_id", companyIds)
      .in("status", ["PENDING", "ACTIVE"]);
    if (!ledgerErr && Array.isArray(ledgerData)) {
      const idx = indexLedgerAgreementsByCompanyId(ledgerData as Record<string, unknown>[]);
      pendingIdByCompany = idx.pendingIdByCompany;
      activeIdByCompany = idx.activeIdByCompany;
    }
  }

  const agreements =
    rawRows.map((a: any) => {
      const id = String(a.id);
      const company_id = String(a.company_id);
      const company_status = companyFieldFromJoin(a.companies, "status");
      const company_name = companyFieldFromJoin(a.companies, "name") || "Firma";
      const ledger_pending_agreement_id = pendingIdByCompany.get(company_id) ?? null;
      const ledger_active_agreement_id = activeIdByCompany.get(company_id) ?? null;
      const pres = deriveSuperadminAgreementListRowPresentation({
        agreement_id: id,
        agreement_status: String(a.status ?? ""),
        company_status,
        ledger_pending_agreement_id,
        ledger_active_agreement_id,
      });
      return {
        id,
        company_id,
        company_name,
        company_status,
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
        activated_at: a.activated_at ?? null,
        rejection_reason: a.rejection_reason ?? null,
        ledger_pending_agreement_id,
        ledger_active_agreement_id,
        pipeline_stage_label: pres.pipeline_stage_label,
        next_label: pres.next_label,
        next_href: pres.next_href,
      };
    }) ?? [];

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
      <p className="mt-2 text-sm lp-muted">
        Operativ oversikt fra <code className="rounded bg-white/80 px-1 text-xs">agreements</code> og{" "}
        <code className="rounded bg-white/80 px-1 text-xs">companies</code>. Standard visning: venter på godkjenning.
      </p>

      <div className="mt-6">
        <AgreementsClient initial={initial} />
      </div>
    </div>
  );
}
