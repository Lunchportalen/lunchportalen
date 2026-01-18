// app/api/cron/week-visibility/route.ts
import { NextResponse } from "next/server";
import { createClient as createSanityClient } from "@sanity/client";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import {
  addDaysISO,
  osloNowParts,
  osloTodayISODate,
  startOfWeekISO,
} from "@/lib/date/oslo";
import { writeAudit } from "@/lib/audit/log";

/**
 * =========================================================
 * CRON: Week visibility (LOCKED)
 * - Scheduled behavior:
 *   - Thu 08:00 Oslo: show week2 (only approved)
 *   - Fri 14:00 Oslo: hide week1 (always)
 *
 * - Manual behavior (Superadmin bridge):
 *   POST { mode:"manual", date:"YYYY-MM-DD", publish:boolean, actorId?:string }
 *   -> updates Sanity customerVisible for that date (requires approvedForPublish)
 *   -> writes DB mirror menu_visibility_days (recommended)
 *   -> writes audit (if actorId present)
 *
 * Security:
 * - GET uses ?key=CRON_SECRET (backwards compatible)
 * - POST uses header: x-cron-secret: CRON_SECRET (recommended)
 *   (Authorization: Bearer also supported)
 * =========================================================
 */

const sanityWrite = createSanityClient({
  projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID!,
  dataset: process.env.NEXT_PUBLIC_SANITY_DATASET!,
  apiVersion: process.env.NEXT_PUBLIC_SANITY_API_VERSION!,
  token: process.env.SANITY_WRITE_TOKEN!, // ✅ write-token
  useCdn: false,
});

function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createSupabaseClient(url, key, { auth: { persistSession: false } });
}

function verifyCron(req: Request): boolean {
  const url = new URL(req.url);

  // ✅ Backwards compatible: GET ?key=
  const keyParam = url.searchParams.get("key");
  if (keyParam && process.env.CRON_SECRET && keyParam === process.env.CRON_SECRET) return true;

  // ✅ Preferred: header x-cron-secret or Authorization: Bearer
  const hdr = req.headers.get("x-cron-secret") || "";
  const auth = req.headers.get("authorization") || "";
  const token = hdr || (auth.toLowerCase().startsWith("bearer ") ? auth.slice(7) : "");

  return Boolean(token && process.env.CRON_SECRET && token === process.env.CRON_SECRET);
}

function isISODate(s: any) {
  return typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
}

// ---------------------------
// Sanity patch helpers
// ---------------------------
async function patchVisibilityForRange(opts: {
  fromISO: string;
  toISO: string; // eksklusiv
  visible: boolean;
  onlyApproved: boolean;
}) {
  const { fromISO, toISO, visible, onlyApproved } = opts;

  // ⚠️ Viktig: dere bruker _type=="menuContent" i queries.ts (ikke "menuDay")
  const ids: string[] = await sanityWrite.fetch(
    `*[
      _type=="menuContent" &&
      date >= $from && date < $to &&
      !(_id in path("drafts.**")) &&
      (${onlyApproved ? "approvedForPublish==true" : "true"})
    ]._id`,
    { from: fromISO, to: toISO }
  );

  if (!ids?.length) return { total: 0, changed: 0 };

  const docs: { _id: string; customerVisible?: boolean }[] = await sanityWrite.fetch(
    `*[_id in $ids]{_id, customerVisible}`,
    { ids }
  );

  const toPatch = docs.filter((d) => (d.customerVisible ?? false) !== visible);
  if (!toPatch.length) return { total: ids.length, changed: 0 };

  const now = new Date().toISOString();
  let tx = sanityWrite.transaction();
  for (const d of toPatch) {
    tx = tx.patch(d._id, {
      set: { customerVisible: visible, customerVisibleSetAt: now },
    });
  }
  await tx.commit();

  return { total: ids.length, changed: toPatch.length };
}

/** Manual: patch single day by date */
async function patchVisibilityForDate(opts: {
  dateISO: string;
  visible: boolean;
  onlyApproved: boolean;
}) {
  const { dateISO, visible, onlyApproved } = opts;

  const ids: string[] = await sanityWrite.fetch(
    `*[
      _type=="menuContent" &&
      date == $date &&
      !(_id in path("drafts.**")) &&
      (${onlyApproved ? "approvedForPublish==true" : "true"})
    ]._id`,
    { date: dateISO }
  );

  if (!ids?.length) return { total: 0, changed: 0 };

  const docs: { _id: string; customerVisible?: boolean }[] = await sanityWrite.fetch(
    `*[_id in $ids]{_id, customerVisible}`,
    { ids }
  );

  const toPatch = docs.filter((d) => (d.customerVisible ?? false) !== visible);
  if (!toPatch.length) return { total: ids.length, changed: 0 };

  const now = new Date().toISOString();
  let tx = sanityWrite.transaction();
  for (const d of toPatch) {
    tx = tx.patch(d._id, {
      set: { customerVisible: visible, customerVisibleSetAt: now },
    });
  }
  await tx.commit();

  return { total: ids.length, changed: toPatch.length };
}

// ---------------------------
// DB mirror helpers
// ---------------------------
async function mirrorToDb(opts: { dateISO: string; visible: boolean; actorId?: string | null }) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return { mirrored: false, skipped: "MISSING_SERVICE_ROLE_KEY" };

  const admin = supabaseAdmin();
  const { error } = await admin
    .from("menu_visibility_days")
    .upsert(
      {
        date: opts.dateISO,
        is_published: opts.visible,
        updated_at: new Date().toISOString(),
        updated_by: opts.actorId ?? null,
      },
      { onConflict: "date" }
    );

  if (error) {
    return { mirrored: false, error: error.message };
  }
  return { mirrored: true };
}

async function mirrorRangeToDb(opts: {
  fromISO: string;
  toISOExclusive: string;
  visible: boolean;
  actorId?: string | null;
}) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return { mirrored: false, count: 0, skipped: "MISSING_SERVICE_ROLE_KEY" };
  }

  const dates: string[] = [];
  let cur = opts.fromISO;
  while (cur < opts.toISOExclusive) {
    dates.push(cur);
    cur = addDaysISO(cur, 1);
  }

  const admin = supabaseAdmin();
  const nowISO = new Date().toISOString();
  const rows = dates.map((d) => ({
    date: d,
    is_published: opts.visible,
    updated_at: nowISO,
    updated_by: opts.actorId ?? null,
  }));

  const { error } = await admin.from("menu_visibility_days").upsert(rows, { onConflict: "date" });
  if (error) return { mirrored: false, count: 0, error: error.message };

  return { mirrored: true, count: rows.length };
}

// ---------------------------
// GET: scheduled runner (backwards compatible)
// ---------------------------
export async function GET(req: Request) {
  if (!verifyCron(req)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const oslo = osloNowParts();
  const todayISO = osloTodayISODate();
  const weekStart = startOfWeekISO(todayISO);

  const week1From = weekStart;
  const week1To = addDaysISO(weekStart, 7);

  const week2From = addDaysISO(weekStart, 7);
  const week2To = addDaysISO(weekStart, 14);

  const isThu0800 = oslo.weekday === "Thu" && oslo.hh === 8 && oslo.mi === 0;
  const isFri1400 = oslo.weekday === "Fri" && oslo.hh === 14 && oslo.mi === 0;

  const actions: any[] = [];

  // ✅ Thu 08:00: show week2 if approved
  if (isThu0800) {
    const res = await patchVisibilityForRange({
      fromISO: week2From,
      toISO: week2To,
      visible: true,
      onlyApproved: true,
    });

    const mirror = await mirrorRangeToDb({
      fromISO: week2From,
      toISOExclusive: week2To,
      visible: true,
      actorId: null,
    });

    actions.push({
      action: "show_week2_if_approved",
      range: { from: week2From, to: week2To },
      ...res,
      mirror,
    });

    // Audit (system action) – fail-quiet
    try {
      await writeAudit({
        actor_user_id: "00000000-0000-0000-0000-000000000000", // system
        actor_role: "system",
        action: "menu.week2_visible_scheduled",
        severity: res.changed > 0 ? "info" : "info",
        target_type: "range",
        target_id: `${week2From}..${week2To}`,
        target_label: `week2 ${week2From}..${week2To}`,
        before: null,
        after: { visible: true, onlyApproved: true, changed: res.changed },
        meta: { schedule: "Thu 08:00", mirror },
      });
    } catch {}
  }

  // ✅ Fri 14:00: hide week1 always
  if (isFri1400) {
    const res = await patchVisibilityForRange({
      fromISO: week1From,
      toISO: week1To,
      visible: false,
      onlyApproved: false,
    });

    const mirror = await mirrorRangeToDb({
      fromISO: week1From,
      toISOExclusive: week1To,
      visible: false,
      actorId: null,
    });

    actions.push({
      action: "hide_week1",
      range: { from: week1From, to: week1To },
      ...res,
      mirror,
    });

    try {
      await writeAudit({
        actor_user_id: "00000000-0000-0000-0000-000000000000", // system
        actor_role: "system",
        action: "menu.week1_hidden_scheduled",
        severity: res.changed > 0 ? "info" : "info",
        target_type: "range",
        target_id: `${week1From}..${week1To}`,
        target_label: `week1 ${week1From}..${week1To}`,
        before: null,
        after: { visible: false, onlyApproved: false, changed: res.changed },
        meta: { schedule: "Fri 14:00", mirror },
      });
    } catch {}
  }

  return NextResponse.json({
    ok: true,
    oslo,
    todayISO,
    week: {
      week1: { from: week1From, to: week1To },
      week2: { from: week2From, to: week2To },
    },
    actions,
    note: actions.length ? "Executed scheduled actions." : "No action at this minute.",
  });
}

// ---------------------------
// POST: manual publish/unpublish (superadmin bridge calls this)
// ---------------------------
export async function POST(req: Request) {
  if (!verifyCron(req)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));

  if (body?.mode !== "manual") {
    return NextResponse.json(
      { ok: false, error: "BAD_REQUEST", message: "Use { mode:'manual', date, publish }." },
      { status: 400 }
    );
  }

  const dateISO = body?.date;
  const publish = body?.publish;
  const actorId = (body?.actorId ?? null) as string | null;

  if (!isISODate(dateISO) || typeof publish !== "boolean") {
    return NextResponse.json({ ok: false, error: "BAD_REQUEST" }, { status: 400 });
  }

  // Manual must respect onlyApproved to prevent leaking unapproved menus
  const res = await patchVisibilityForDate({
    dateISO,
    visible: publish,
    onlyApproved: true,
  });

  const mirror = await mirrorToDb({ dateISO, visible: publish, actorId });

  // Audit (manual) – fail-quiet
  try {
    if (actorId) {
      await writeAudit({
        actor_user_id: actorId,
        actor_role: "superadmin",
        action: "menu.visibility_changed",
        severity: "info",
        target_type: "menuContent",
        target_id: dateISO,
        target_label: dateISO,
        before: null,
        after: { customerVisible: publish },
        meta: { source: "superadmin", mode: "manual", mirror, sanity: res },
      });
    }
  } catch {}

  return NextResponse.json({
    ok: true,
    mode: "manual",
    date: dateISO,
    publish,
    result: res,
    mirror,
    note:
      res.total === 0
        ? "No menuContent found for date (or not approved)."
        : res.changed === 0
        ? "No change (already in desired state)."
        : "Patched successfully.",
  });
}
