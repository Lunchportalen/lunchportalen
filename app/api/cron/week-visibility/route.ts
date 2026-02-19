// app/api/cron/week-visibility/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { addDaysISO, osloNowParts, osloTodayISODate, startOfWeekISO } from "@/lib/date/oslo";
import { writeAudit } from "@/lib/audit/log";
import { requireCronAuth } from "@/lib/http/cronAuth";
import { jsonErr, jsonOk, makeRid } from "@/lib/http/respond";

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v || !String(v).trim()) throw new Error(`Missing env: ${name}`);
  return String(v).trim();
}

function isISODate(s: any) {
  return typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
}

async function readJsonSafe(req: Request) {
  const t = await req.text();
  if (!t) return {};
  try {
    return JSON.parse(t);
  } catch {
    return {};
  }
}

async function getSanityWrite() {
  const { createClient } = await import("@sanity/client");
  return createClient({
    projectId: requireEnv("NEXT_PUBLIC_SANITY_PROJECT_ID"),
    dataset: requireEnv("NEXT_PUBLIC_SANITY_DATASET"),
    apiVersion: requireEnv("NEXT_PUBLIC_SANITY_API_VERSION"),
    token: requireEnv("SANITY_WRITE_TOKEN"),
    useCdn: false,
  });
}

async function getSupabaseAdmin() {
  const { supabaseAdmin } = await import("@/lib/supabase/admin");
  return supabaseAdmin();
}

async function getSupabaseAdminOrNull() {
  try {
    return await getSupabaseAdmin();
  } catch {
    return null;
  }
}

async function patchVisibilityForRange(opts: {
  fromISO: string;
  toISO: string;
  visible: boolean;
  onlyApproved: boolean;
}) {
  const { fromISO, toISO, visible, onlyApproved } = opts;
  const sanityWrite = await getSanityWrite();

  const ids: string[] = await sanityWrite.fetch(
    `*[
      _type=="menuContent" &&
      date >= $from && date < $to &&
      !(_id in path("drafts.**")) &&
      (${onlyApproved ? "approvedForPublish==true" : "true"})
    ]._id`,
    { from: fromISO, to: toISO }
  );

  if (!ids?.length) return { total: 0, changed: 0, patchedIds: [] as string[] };

  const docs: { _id: string; customerVisible?: boolean }[] = await sanityWrite.fetch(`*[_id in $ids]{ _id, customerVisible }`, { ids });

  const toPatch = docs.filter((d) => (d.customerVisible ?? false) !== visible);
  if (!toPatch.length) return { total: ids.length, changed: 0, patchedIds: [] as string[] };

  const now = new Date().toISOString();
  let tx = sanityWrite.transaction();
  for (const d of toPatch) {
    tx = tx.patch(d._id, { set: { customerVisible: visible, customerVisibleSetAt: now } });
  }
  await tx.commit();

  return { total: ids.length, changed: toPatch.length, patchedIds: toPatch.map((d) => d._id) };
}

async function patchVisibilityForDate(opts: { dateISO: string; visible: boolean; onlyApproved: boolean }) {
  const { dateISO, visible, onlyApproved } = opts;
  const sanityWrite = await getSanityWrite();

  const ids: string[] = await sanityWrite.fetch(
    `*[
      _type=="menuContent" &&
      date == $date &&
      !(_id in path("drafts.**")) &&
      (${onlyApproved ? "approvedForPublish==true" : "true"})
    ]._id`,
    { date: dateISO }
  );

  if (!ids?.length) return { total: 0, changed: 0, patchedIds: [] as string[] };

  const docs: { _id: string; customerVisible?: boolean }[] = await sanityWrite.fetch(`*[_id in $ids]{ _id, customerVisible }`, { ids });

  const toPatch = docs.filter((d) => (d.customerVisible ?? false) !== visible);
  if (!toPatch.length) return { total: ids.length, changed: 0, patchedIds: [] as string[] };

  const now = new Date().toISOString();
  let tx = sanityWrite.transaction();
  for (const d of toPatch) {
    tx = tx.patch(d._id, { set: { customerVisible: visible, customerVisibleSetAt: now } });
  }
  await tx.commit();

  return { total: ids.length, changed: toPatch.length, patchedIds: toPatch.map((d) => d._id) };
}

async function mirrorToDb(opts: { dateISO: string; visible: boolean; actorId?: string | null }) {
  const admin = await getSupabaseAdminOrNull();
  if (!admin) return { mirrored: false, skipped: "MISSING_SERVICE_ROLE_CLIENT" };
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

  if (error) return { mirrored: false, error: error.message };
  return { mirrored: true };
}

async function mirrorRangeToDb(opts: { fromISO: string; toISOExclusive: string; visible: boolean; actorId?: string | null }) {
  const admin = await getSupabaseAdminOrNull();
  if (!admin) return { mirrored: false, count: 0, skipped: "MISSING_SERVICE_ROLE_CLIENT" };

  const dates: string[] = [];
  let cur = opts.fromISO;
  while (cur < opts.toISOExclusive) {
    dates.push(cur);
    cur = addDaysISO(cur, 1);
  }

  const now = new Date().toISOString();
  const rows = dates.map((d) => ({
    date: d,
    is_published: opts.visible,
    updated_at: now,
    updated_by: opts.actorId ?? null,
  }));

  const { error } = await admin.from("menu_visibility_days").upsert(rows, { onConflict: "date" });
  if (error) return { mirrored: false, count: 0, error: error.message };

  return { mirrored: true, count: rows.length };
}

export async function GET(req: Request) {
  const rid = makeRid();

  try {
    requireCronAuth(req);
  } catch (e: any) {
    const msg = String(e?.message ?? e);
    const code = String(e?.code ?? "").trim();

    if (msg === "cron_secret_missing" || code === "cron_secret_missing") {
      return jsonErr(rid, "CRON_SECRET mangler i miljovariabler", 500, "misconfigured");
    }
    if (msg === "forbidden" || code === "forbidden") {
      return jsonErr(rid, "Ugyldig cron secret", 403, "forbidden");
    }
    return jsonErr(rid, "Uventet feil i cron-gate", 500, { code: "server_error", detail: { message: msg } });
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

  try {
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

      try {
        await writeAudit({
          actor_user_id: "00000000-0000-0000-0000-000000000000",
          actor_role: "system",
          action: "menu.week2_visible_scheduled",
          severity: "info",
          target_type: "range",
          target_id: `${week2From}..${week2To}`,
          target_label: `week2 ${week2From}..${week2To}`,
          before: null,
          after: { visible: true, onlyApproved: true, changed: res.changed },
          meta: { schedule: "Thu 08:00", mirror },
        });
      } catch {}
    }

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
          actor_user_id: "00000000-0000-0000-0000-000000000000",
          actor_role: "system",
          action: "menu.week1_hidden_scheduled",
          severity: "info",
          target_type: "range",
          target_id: `${week1From}..${week1To}`,
          target_label: `week1 ${week1From}..${week1To}`,
          before: null,
          after: { visible: false, onlyApproved: false, changed: res.changed },
          meta: { schedule: "Fri 14:00", mirror },
        });
      } catch {}
    }

    return jsonOk(
      rid,
      {
        ok: true,
        rid,
        oslo,
        todayISO,
        week: {
          week1: { from: week1From, to: week1To },
          week2: { from: week2From, to: week2To },
        },
        actions,
        note: actions.length ? "Executed scheduled actions." : "No action at this minute.",
      },
      200
    );
  } catch (e: any) {
    return jsonErr(rid, "Cron week-visibility feilet", 500, {
      code: "server_error",
      detail: { message: String(e?.message ?? e), oslo, todayISO },
    });
  }
}

export async function POST(req: Request) {
  const rid = makeRid();

  try {
    requireCronAuth(req);
  } catch (e: any) {
    const msg = String(e?.message ?? e);
    const code = String(e?.code ?? "").trim();

    if (msg === "cron_secret_missing" || code === "cron_secret_missing") {
      return jsonErr(rid, "CRON_SECRET mangler i miljovariabler", 500, "misconfigured");
    }
    if (msg === "forbidden" || code === "forbidden") {
      return jsonErr(rid, "Ugyldig cron secret", 403, "forbidden");
    }
    return jsonErr(rid, "Uventet feil i cron-gate", 500, { code: "server_error", detail: { message: msg } });
  }

  const body = await readJsonSafe(req);

  if (body?.mode !== "manual") {
    return jsonErr(rid, "Use { mode:'manual', date, publish }.", 400, "bad_request");
  }

  const dateISO = body?.date;
  const publish = body?.publish;
  const actorId = (body?.actorId ?? null) as string | null;

  if (!isISODate(dateISO) || typeof publish !== "boolean") {
    return jsonErr(rid, "Ugyldig payload", 400, {
      code: "bad_request",
      detail: { want: { mode: "manual", date: "YYYY-MM-DD", publish: true } },
    });
  }

  try {
    const res = await patchVisibilityForDate({
      dateISO,
      visible: publish,
      onlyApproved: true,
    });

    const mirror = await mirrorToDb({ dateISO, visible: publish, actorId });

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
          after: { customerVisible: publish, changed: res.changed },
          meta: { source: "superadmin", mode: "manual", mirror, sanity: res },
        });
      }
    } catch {}

    return jsonOk(
      rid,
      {
        ok: true,
        rid,
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
      },
      200
    );
  } catch (e: any) {
    return jsonErr(rid, "Manual week-visibility feilet", 500, {
      code: "server_error",
      detail: { message: String(e?.message ?? e), dateISO, publish },
    });
  }
}
