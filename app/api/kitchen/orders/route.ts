// app/api/kitchen/orders/route.ts
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { osloTodayISODate } from "@/lib/date/oslo";

function isISODate(d: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(d);
}

function asDetailString(detail: unknown) {
  if (!detail) return null;
  if (typeof detail === "string") return detail;
  try {
    return JSON.stringify(detail);
  } catch {
    return String(detail);
  }
}

export const revalidate = 0;

type KitchenOrdersApiRow = {
  order_id: string;
  created_at: string;

  delivery_date: string;
  delivery_slot: string;
  status: string;
  order_note: string | null;

  company_id: string;
  company_name: string;

  location_id: string;
  location_name: string;

  profile_id: string;
  employee_name: string;
  employee_department: string | null;
  employee_phone?: string | null;

  // Vi legger på disse (frontend tåler ekstra felter):
  packed_at?: string | null;
  delivered_at?: string | null;
};

type BatchRow = {
  delivery_date: string;
  delivery_window: string;
  company_location_id: string;
  status: string; // queued|packed|delivered
  packed_at: string | null;
  delivered_at: string | null;
};

export async function GET(req: Request) {
  const rid = `kitchen_orders_${Date.now().toString(36)}_${Math.random()
    .toString(36)
    .slice(2, 8)}`;

  try {
    const url = new URL(req.url);
    const qDate = url.searchParams.get("date") || "";
    const dateISO = isISODate(qDate) ? qDate : osloTodayISODate();

    const supabase = await supabaseServer();

    // 1) Krev innlogging (slik auth.uid() blir satt)
    const { data: userRes, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userRes?.user) {
      return NextResponse.json(
        { ok: false, error: "Not authenticated", rid },
        { status: 401, headers: { "Cache-Control": "no-store" } }
      );
    }

    // 2) Kall RPC (p_from = p_to = date)
    const { data, error } = await (supabase as any).rpc("get_kitchen_orders", {
      p_from: dateISO,
      p_to: dateISO,
      p_location_id: null,
    });

    if (error) {
      const msg = error?.message || "RPC failed";
      const detail = asDetailString(error);

      const lower = msg.toLowerCase();
      const isAuth = lower.includes("not authenticated");
      const isForbidden = lower.includes("forbidden") || lower.includes("permission");
      const isProfileMissing = lower.includes("profile not found");

      const status = isAuth ? 401 : isForbidden || isProfileMissing ? 403 : 500;

      if (status === 500) {
        console.error(`[api/kitchen/orders] rid=${rid}`, msg, error);
      }

      return NextResponse.json(
        { ok: false, error: msg, detail, rid },
        { status, headers: { "Cache-Control": "no-store" } }
      );
    }

    const rows = (data ?? []) as KitchenOrdersApiRow[];

    // 3) Hent batch-status fra tabell og merge inn i rows
    // NB: Bytt tabellnavn her hvis din heter noe annet.
    const BATCH_TABLE = "kitchen_batches";

    // For å redusere query, finn alle location_id som finnes i rows:
    const locationIds = Array.from(
      new Set(rows.map((r) => r.location_id).filter(Boolean))
    );

    let batchMap = new Map<string, BatchRow>();

    // Hvis vi har ingen rows, kan vi fortsatt returnere tomt uten batch-hent.
    if (locationIds.length > 0) {
      const { data: batches, error: batchErr } = await supabase
        .from(BATCH_TABLE)
        .select("delivery_date, delivery_window, company_location_id, status, packed_at, delivered_at")
        .eq("delivery_date", dateISO)
        .in("company_location_id", locationIds);

      if (batchErr) {
        // Ikke hard-fail – vi returnerer fortsatt orders, men logger for drift
        console.error(`[api/kitchen/orders] rid=${rid} batch fetch error`, batchErr);
      } else {
        for (const b of (batches ?? []) as BatchRow[]) {
          const k = `${b.delivery_date}__${b.delivery_window}__${b.company_location_id}`;
          batchMap.set(k, b);
        }
      }
    }

    // 4) Overstyr row.status med batch-status dersom den finnes,
    // slik at frontend sin eksisterende normalizeBatchStatus(r.status) begynner å virke.
    const merged = rows.map((r) => {
      const key = `${r.delivery_date}__${r.delivery_slot}__${r.location_id}`;
      const b = batchMap.get(key);

      if (!b) return r;

      return {
        ...r,
        status: b.status ?? r.status,
        packed_at: b.packed_at ?? null,
        delivered_at: b.delivered_at ?? null,
      };
    });

    return NextResponse.json(
      { ok: true, date: dateISO, rows: merged, rid },
      { status: 200, headers: { "Cache-Control": "no-store" } }
    );
  } catch (e: any) {
    const msg = e?.message ?? String(e);
    console.error(`[api/kitchen/orders] rid=${rid} (catch)`, msg, e);

    return NextResponse.json(
      { ok: false, error: "Bad Request", detail: msg, rid },
      { status: 400, headers: { "Cache-Control": "no-store" } }
    );
  }
}
