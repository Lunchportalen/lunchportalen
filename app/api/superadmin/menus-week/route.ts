// app/api/superadmin/menus-week/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { addDaysISO, osloTodayISODate, startOfWeekISO } from "@/lib/date/oslo";
import { getMenuForDatesAdmin, type MenuContent } from "@/lib/sanity/queries";

type DayStatus = "published" | "unpublished" | "missing";

function safeStr(v: unknown) {
  return String(v ?? "").trim();
}

function makeRid() {
  return `rid_${Math.random().toString(16).slice(2)}_${Date.now()}`;
}

function jsonOk(rid: string, data: any, init?: number) {
  return NextResponse.json({ ok: true, rid, ...data }, { status: init ?? 200 });
}

function jsonErr(rid: string, status: number, error: string, message?: string, detail?: any) {
  return NextResponse.json(
    {
      ok: false,
      rid,
      error,
      message: message ?? error,
      detail: detail ?? null,
    },
    { status }
  );
}

function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url) throw new Error("MISSING_NEXT_PUBLIC_SUPABASE_URL");
  if (!key) throw new Error("MISSING_SUPABASE_SERVICE_ROLE_KEY");

  return createSupabaseClient(url, key, { auth: { persistSession: false } });
}

function weekdayNoShortByIndex(i: number) {
  return ["Man", "Tir", "Ons", "Tor", "Fre"][i] ?? "";
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function hasText(v: unknown) {
  return typeof v === "string" && v.trim().length > 0;
}

function hasAllergens(arr: unknown) {
  return Array.isArray(arr) && arr.length > 0;
}

/**
 * ✅ Superadmin Menyoversikt – uke (Man–Fre)
 * - Guard: session + profiles.role === superadmin
 * - offset: uke +/- n (0 = inneværende uke)
 * - Innhold: Sanity (admin) via getMenuForDatesAdmin (inkl upublisert, ekskl drafts)
 * - Publisering: DB mirror menu_visibility_days (is_published)
 * - Status:
 *    missing     => ingen doc ELLER ufullstendig (tittel/desc/allergener)
 *    published   => komplett + (DB is_published true OR menu.isPublished true)
 *    unpublished => komplett + ikke publisert
 */
export async function GET(req: Request) {
  const rid = safeStr((req.headers as any)?.get?.("x-rid")) || makeRid();

  try {
    // 1) Auth + superadmin guard
    const supabase = await supabaseServer();
    const { data: userRes, error: userErr } = await supabase.auth.getUser();
    const user = userRes?.user ?? null;

    if (!user || userErr) {
      return jsonErr(rid, 401, "AUTH_REQUIRED", "Du må være innlogget for å bruke denne ruten.");
    }

    const { data: profile, error: profErr } = await supabase
      .from("profiles")
      .select("role")
      .eq("user_id", user.id)
      .maybeSingle();

    if (profErr) {
      return jsonErr(rid, 500, "PROFILE_READ_FAILED", "Kunne ikke lese profil.", profErr.message);
    }

    if (profile?.role !== "superadmin") {
      return jsonErr(rid, 403, "FORBIDDEN", "Kun superadmin har tilgang.");
    }

    // 2) Offset
    const url = new URL(req.url);
    const offsetRaw = url.searchParams.get("offset");
    const offset = Number(offsetRaw ?? 0);
    const safeOffset = Number.isFinite(offset) ? clamp(offset, -52, 104) : 0;

    // 3) Week dates (Mon–Fri)
    const todayISO = osloTodayISODate();
    const weekStart = startOfWeekISO(todayISO);
    const monday = addDaysISO(weekStart, safeOffset * 7);

    const days = Array.from({ length: 5 }).map((_, i) => ({
      date: addDaysISO(monday, i),
      weekday: weekdayNoShortByIndex(i),
    }));
    const dates = days.map((d) => d.date);

    // 4) Sanity (admin): hent ALT (ikke drafts)
    const sanityRows: MenuContent[] = await getMenuForDatesAdmin(dates);
    const byDate = new Map<string, MenuContent>();
    for (const m of sanityRows) byDate.set(m.date, m);

    // 5) Visibility mirror (DB) – service role
    let admin;
    try {
      admin = supabaseAdmin();
    } catch (e: any) {
      // Dette skal ikke stoppe bygg/CI – men vil stoppe ruten runtime hvis env mangler
      return jsonErr(rid, 500, "MISSING_ENV", "Mangler nødvendige miljøvariabler for admin-lesing.", safeStr(e?.message));
    }

    const { data: visRows, error: visErr } = await admin
      .from("menu_visibility_days")
      .select("date,is_published")
      .in("date", dates);

    if (visErr) {
      return jsonErr(rid, 500, "VIS_READ_FAILED", "Kunne ikke lese publiseringsstatus.", visErr.message);
    }

    const dbPublished = new Map<string, boolean>();
    for (const r of visRows ?? []) {
      const key = String((r as any).date);
      dbPublished.set(key, Boolean((r as any).is_published));
    }

    // 6) Build payload
    const payload = days.map((d) => {
      const menu = byDate.get(d.date);

      const title = menu?.title ?? null;
      const description = menu?.description ?? null;
      const allergens = menu?.allergens ?? null;
      const tier = (menu as any)?.tier ?? null;

      const approvedForPublish = (menu as any)?.approvedForPublish ?? null;
      const customerVisible = (menu as any)?.customerVisible ?? null;

      const missing = !menu || !hasText(title) || !hasText(description) || !hasAllergens(allergens);

      // “Published” = DB mirror (styrer hva kundene ser) – fallback til menu.isPublished
      const published = (dbPublished.get(d.date) ?? false) || Boolean((menu as any)?.isPublished ?? false);

      const status: DayStatus = missing ? "missing" : published ? "published" : "unpublished";

      return {
        date: d.date,
        weekday: d.weekday,

        // Innhold (fra Sanity)
        title,
        description,
        allergens,
        tier,

        // Kontrollfelt (fra Sanity)
        approvedForPublish,
        customerVisible,

        // Status for UI
        status,

        // Debug/diag (admin only)
        _id: (menu as any)?._id ?? null,
        isPublished: Boolean((menu as any)?.isPublished ?? false),
        dbPublished: dbPublished.get(d.date) ?? false,
      };
    });

    // 7) OK
    return jsonOk(
      rid,
      {
        week: {
          weekStart: monday,
          days: payload,
        },
      },
      200
    );
  } catch (e: any) {
    return jsonErr(rid, 500, "INTERNAL_ERROR", "Uventet feil i menus-week.", safeStr(e?.message ?? e));
  }
}
