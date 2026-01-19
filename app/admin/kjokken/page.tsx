// app/admin/kjokken/page.tsx
export const revalidate = 0;

import KitchenClient from "./kitchenClient";
import DownloadAgreementButton from "./komponent/DownloadAgreementButton";

import { supabaseServer } from "@/lib/supabase/server";
import { osloTodayISODate } from "@/lib/date/oslo";
import { getMenuForDate } from "@/lib/sanity/queries";

import { buildKitchenGroups } from "@/lib/kitchen/grouping";
import type { DbOrderRow, ProfileRow, KitchenGroup } from "@/lib/kitchen/grouping";

function isISODate(d: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(d);
}

export default async function KitchenPage(props: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const sp = props.searchParams ?? {};
  const qDateRaw = Array.isArray(sp.date) ? sp.date[0] : sp.date;
  const date = qDateRaw && isISODate(qDateRaw) ? qDateRaw : osloTodayISODate();

  const supabase = await supabaseServer();
  const { data: userRes, error: userErr } = await supabase.auth.getUser();

  if (userErr || !userRes?.user) {
    return (
      <main className="p-6">
        <h1 className="text-2xl font-bold">Kjøkkenoversikt</h1>
        <p className="mt-2 text-sm opacity-80">Du må være innlogget.</p>
        <a className="mt-4 inline-block underline" href="/login">
          Gå til innlogging
        </a>
      </main>
    );
  }

  // NB: dere bruker app_metadata.is_admin som “kjøkken/superadmin”-flagg
  const isAdmin = (userRes.user.app_metadata as any)?.is_admin === true;

  // ✅ Firma-admin (ikke kjøkken/superadmin) skal kunne laste ned avtale-PDF
  if (!isAdmin) {
    return (
      <main className="mx-auto max-w-3xl p-6">
        <h1 className="text-2xl font-bold">Admin</h1>
        <p className="mt-2 text-sm opacity-80">
          Her finner du firmainformasjon og avtale.
        </p>

        <div className="mt-6 rounded-3xl border bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold">Avtale</h2>
          <p className="mt-2 text-sm opacity-70">
            Last ned signert avtale-PDF (tidsbegrenset lenke).
          </p>
          <div className="mt-4">
            <DownloadAgreementButton />
          </div>
        </div>

        <div className="mt-6">
          <a className="inline-block underline text-sm opacity-80" href="/today">
            Tilbake til i dag
          </a>
        </div>
      </main>
    );
  }

  // ✅ Kjøkken / superadmin: vis kjøkkenoversikt
  // Viktig: kolonnenavn og relasjoner matcher ditt skjema
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
    // ✅ DB/view/RPC bruker "active" (ikke "ACTIVE") – behold dette som fasit
    .eq("status", "active")
    .order("created_at", { ascending: true });

  if (oErr) {
    return (
      <main className="p-6">
        <h1 className="text-2xl font-bold">Kjøkkenoversikt</h1>
        <p className="mt-2 text-sm opacity-80">Kunne ikke hente bestillinger.</p>
        <pre className="mt-4 whitespace-pre-wrap text-xs opacity-80">{oErr.message}</pre>
      </main>
    );
  }

  const orders = (rows ?? []) as DbOrderRow[];

  // ✅ orders.user_id matcher profiles.id hos deg
  const profileIds = Array.from(
    new Set(orders.map((o) => o.user_id).filter(Boolean))
  ) as string[];

  const profilesMap = new Map<string, ProfileRow>();

  if (profileIds.length) {
    const { data: profRows, error: pErr } = await (supabase as any)
      .from("profiles")
      // profiles: id, name, department
      .select("id,name,department")
      .in("id", profileIds);

    if (pErr) {
      console.error("[kjokken] profiles fetch failed", pErr.message);
    } else {
      // Build map keyed by profile.id (== orders.user_id)
      for (const p of (profRows ?? []) as any[]) {
        if (p?.id) {
          profilesMap.set(p.id, {
            user_id: p.id, // for kompatibilitet om grouping forventer user_id-key
            name: p.name ?? "",
            department: p.department ?? null,
          } as ProfileRow);
        }
      }
    }
  }

  const groups: KitchenGroup[] = buildKitchenGroups(orders, profilesMap);
  const total = groups.reduce((sum, g) => sum + g.count, 0);

  const menu = await getMenuForDate(date);
  const menuText = menu?.isPublished ? menu.description || "—" : "Meny ikke publisert";
  const allergens =
    menu?.isPublished && menu?.allergens?.length ? menu.allergens : [];

  return (
    <KitchenClient
      dateISO={date}
      total={total}
      menuText={menuText}
      allergens={allergens}
      groups={groups}
    />
  );
}
