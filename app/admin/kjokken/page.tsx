export const revalidate = 0;

import KitchenClient from "./kitchenClient";
import { supabaseServer } from "@/lib/supabase/server";
import { osloTodayISO } from "@/lib/date/oslo";
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
  const date = qDateRaw && isISODate(qDateRaw) ? qDateRaw : osloTodayISO();

  const supabase = await supabaseServer();
  const { data: userRes } = await supabase.auth.getUser();

  if (!userRes?.user) {
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

  const isAdmin = (userRes.user.app_metadata as any)?.is_admin === true;
  if (!isAdmin) {
    return (
      <main className="p-6">
        <h1 className="text-2xl font-bold">Kjøkkenoversikt</h1>
        <p className="mt-2 text-sm opacity-80">Du har ikke tilgang til denne siden.</p>
        <a className="mt-4 inline-block underline" href="/today">
          Tilbake til i dag
        </a>
      </main>
    );
  }

  const { data: rows, error: oErr } = await supabase
    .from("orders")
    .select(
      `
      id,
      user_id,
      note,
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
        delivery_window_start,
        delivery_window_end
      )
    `
    )
    .eq("date", date)
    .eq("status", "active")
    .order("created_at", { ascending: true });

  if (oErr) {
    return (
      <main className="p-6">
        <h1 className="text-2xl font-bold">Kjøkkenoversikt</h1>
        <p className="mt-2 text-sm opacity-80">Kunne ikke hente bestillinger.</p>
        <pre className="mt-4 text-xs opacity-80 whitespace-pre-wrap">{oErr.message}</pre>
      </main>
    );
  }

  const orders = (rows ?? []) as DbOrderRow[];
  const userIds = Array.from(new Set(orders.map((o) => o.user_id)));

  const profilesMap = new Map<string, ProfileRow>();
  if (userIds.length) {
    const { data: profRows } = await supabase
      .from("profiles")
      .select("user_id,name,department")
      .in("user_id", userIds);

    for (const p of (profRows ?? []) as ProfileRow[]) {
      profilesMap.set(p.user_id, p);
    }
  }

  const groups: KitchenGroup[] = buildKitchenGroups(orders, profilesMap);
  const total = groups.reduce((sum, g) => sum + g.count, 0);

  const menu = await getMenuForDate(date);
  const menuText = menu?.isPublished ? menu.description || "—" : "Meny ikke publisert";
  const allergens = menu?.isPublished && menu?.allergens?.length ? menu.allergens : [];

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
