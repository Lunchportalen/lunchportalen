// app/admin/kjokken/page.tsx
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import Link from "next/link";
import { redirect } from "next/navigation";

import KitchenClient from "./kitchenClient";

// ✅ RIKTIG import for ditt repo (app/admin/kjokken → components)
import DownloadAgreementButton from "@/components/DownloadAgreementButton";

import { supabaseServer } from "@/lib/supabase/server";
import { osloTodayISODate } from "@/lib/date/oslo";
import { getMenuForDate } from "@/lib/sanity/queries";

import { buildKitchenGroups } from "@/lib/kitchen/grouping";
import type { DbOrderRow, ProfileRow, KitchenGroup } from "@/lib/kitchen/grouping";

function isISODate(d: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(d ?? ""));
}

export default async function KitchenPage(props: { searchParams?: Record<string, string | string[] | undefined> }) {
  const sp = props.searchParams ?? {};
  const qDateRaw = Array.isArray(sp.date) ? sp.date[0] : sp.date;
  const date = qDateRaw && isISODate(qDateRaw) ? qDateRaw : osloTodayISODate();

  const supabase = await supabaseServer();
  const { data: userRes, error: userErr } = await supabase.auth.getUser();

  if (userErr || !userRes?.user) {
    redirect(`/login?next=/admin/kjokken?date=${encodeURIComponent(date)}`);
  }

  const user = userRes.user;

  // NB: dere bruker app_metadata.is_admin som “kjøkken/superadmin”-flagg
  const appMeta = (user.app_metadata ?? {}) as any;
  const isAdminSystem = appMeta?.is_admin === true;

  // ✅ Firma-admin: vis avtale-kort
  if (!isAdminSystem) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-10">
        <div className="rounded-3xl bg-white/70 p-6 ring-1 ring-[rgb(var(--lp-border))]">
          <h1 className="text-2xl font-semibold tracking-tight">Admin</h1>
          <p className="mt-1 text-sm text-[rgb(var(--lp-muted))]">Firmainformasjon og avtale (PDF).</p>

          <div className="mt-6 rounded-3xl bg-white p-6 ring-1 ring-[rgb(var(--lp-border))]">
            <h2 className="text-lg font-semibold">Avtale</h2>
            <p className="mt-2 text-sm text-[rgb(var(--lp-muted))]">Last ned signert avtale-PDF (tidsbegrenset lenke).</p>
            <div className="mt-4">
              <DownloadAgreementButton />
            </div>
          </div>

          <div className="mt-6">
            <Link className="inline-block text-sm text-[rgb(var(--lp-muted))] hover:underline" href="/today">
              Tilbake til i dag
            </Link>
          </div>
        </div>
      </main>
    );
  }

  // ✅ Kjøkken / superadmin: hent bestillinger for dato
  const { data: rows, error: oErr } = await (supabase as any)
    .from("orders")
    .select(
      `
      id,
      user_id,
      note,
      slot,
      created_at,
      company_id,
      location_id,
      companies ( id, name ),
      company_locations (
        id,
        label,
        address_line1,
        postal_code,
        city,
        delivery_json
      )
    `
    )
    .eq("date", date)
    .eq("status", "active")
    .order("created_at", { ascending: true });

  if (oErr) {
    return (
      <main className="mx-auto max-w-4xl px-4 py-10">
        <div className="rounded-3xl bg-white/70 p-6 ring-1 ring-[rgb(var(--lp-border))]">
          <h1 className="text-2xl font-semibold tracking-tight">Kjøkkenoversikt</h1>
          <p className="mt-2 text-sm text-[rgb(var(--lp-muted))]">Kunne ikke hente bestillinger.</p>
          <pre className="mt-4 whitespace-pre-wrap rounded-2xl bg-white p-4 text-xs text-[rgb(var(--lp-muted))] ring-1 ring-[rgb(var(--lp-border))]">
            {oErr.message}
          </pre>
        </div>
      </main>
    );
  }

  const orders = (rows ?? []) as DbOrderRow[];

  const profileIds = Array.from(new Set(orders.map((o) => o.user_id).filter(Boolean))) as string[];
  const profilesMap = new Map<string, ProfileRow>();

  if (profileIds.length) {
    const { data: profRows, error: pErr } = await (supabase as any)
      .from("profiles")
      .select("id,name,department")
      .in("id", profileIds);

    if (!pErr) {
      for (const p of (profRows ?? []) as any[]) {
        if (p?.id) {
          profilesMap.set(p.id, {
            user_id: p.id,
            name: p.name ?? "",
            department: p.department ?? null,
          } as ProfileRow);
        }
      }
    } else {
      console.error("[admin/kjokken] profiles fetch failed:", pErr.message);
    }
  }

  const groups: KitchenGroup[] = buildKitchenGroups(orders, profilesMap);
  const total = groups.reduce((sum, g) => sum + g.count, 0);

  const menu = await getMenuForDate(date);
  const menuText = menu?.isPublished ? menu.description || "—" : "Meny ikke publisert";
  const allergens = menu?.isPublished && menu?.allergens?.length ? menu.allergens : [];

  return <KitchenClient dateISO={date} total={total} menuText={menuText} allergens={allergens} groups={groups} />;
}
