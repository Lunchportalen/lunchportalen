export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import "server-only";

import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { computeRole, hasRole, type Role } from "@/lib/auth/roles";
import { getRoleForUser } from "@/lib/auth/getRoleForUser";
import { getMenusByMealTypes } from "@/lib/cms/getMenusByMealTypes";
import { getProductPlan } from "@/lib/cms/getProductPlan";
import { normalizeMealTypeKey } from "@/lib/cms/mealTypeKey";
import { loadSuperadminLedgerAgreementDetail } from "@/lib/server/agreements/ledgerAgreementApproval";
import { parseMealContractFromAgreementJson } from "@/lib/server/agreements/mealContract";
import { supabaseServer } from "@/lib/supabase/server";

import AgreementDetailClient from "./agreement-detail-client";

type PageProps = { params: Promise<{ id: string }> };

export default async function SuperadminAgreementDetailPage(props: PageProps) {
  const { id: rawId } = await props.params;
  const id = String(rawId ?? "").trim();

  {
    const sb = await supabaseServer();
    const { data, error } = await sb.auth.getUser();
    const user = data?.user ?? null;

    if (error || !user) redirect(`/login?next=/superadmin/agreements/${encodeURIComponent(id)}`);

    let profileRole: any = null;
    try {
      profileRole = await getRoleForUser(user.id);
    } catch {
      profileRole = null;
    }

    const role: Role = computeRole(user, profileRole);
    if (!hasRole(role, ["superadmin"])) redirect("/status?state=paused&next=/superadmin/agreements");
  }

  const detail = await loadSuperadminLedgerAgreementDetail(id);
  if (detail.ok === false) {
    if (detail.status === 404) notFound();
    return (
      <div className="w-full px-4 sm:px-6 lg:px-10 py-8">
        <Link href="/superadmin/agreements" className="text-sm font-medium text-neutral-700 hover:underline">
          ← Tilbake til avtaler
        </Link>
        <h1 className="lp-h1 mt-4">Avtale</h1>
        <p className="mt-2 text-sm text-rose-700">{detail.message}</p>
      </div>
    );
  }

  const [cmsBasis, cmsLuxus] = await Promise.all([getProductPlan("basis"), getProductPlan("luxus")]);

  const mealKeys = new Set<string>();
  const meal = parseMealContractFromAgreementJson(detail.agreement_json);
  if (meal?.plan === "basis" && meal.fixed_meal_type) {
    const nk = normalizeMealTypeKey(meal.fixed_meal_type);
    if (nk) mealKeys.add(nk);
  }
  if (meal?.plan === "luxus" && meal.menu_per_day) {
    for (const v of Object.values(meal.menu_per_day)) {
      const nk = normalizeMealTypeKey(v);
      if (nk) mealKeys.add(nk);
    }
  }
  for (const k of cmsBasis?.allowedMeals ?? []) {
    const nk = normalizeMealTypeKey(k);
    if (nk) mealKeys.add(nk);
  }
  for (const k of cmsLuxus?.allowedMeals ?? []) {
    const nk = normalizeMealTypeKey(k);
    if (nk) mealKeys.add(nk);
  }

  let menuTitles: Record<string, string> = {};
  if (mealKeys.size) {
    try {
      const menus = await getMenusByMealTypes([...mealKeys]);
      for (const [k, m] of menus) {
        const t = m?.title != null ? String(m.title).trim() : "";
        if (t) menuTitles[k] = t;
      }
    } catch {
      menuTitles = {};
    }
  }

  return (
    <div className="w-full px-4 sm:px-6 lg:px-10 py-8">
      <Link href="/superadmin/agreements" className="text-sm font-medium text-neutral-700 hover:underline">
        ← Tilbake til avtaler
      </Link>
      <h1 className="lp-h1 mt-4">Avtale · {detail.company_name}</h1>
      <p className="mt-2 text-sm lp-muted break-all">Avtale-id: {detail.agreement.id}</p>

      <div className="mt-6">
        <AgreementDetailClient detail={detail} cmsBasis={cmsBasis} cmsLuxus={cmsLuxus} menuTitles={menuTitles} />
      </div>
    </div>
  );
}
