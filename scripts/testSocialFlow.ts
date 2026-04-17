/**
 * Verifies SoMe → klikk → lead → ordre → attribusjon (lesing + valgfri skrivetest).
 *
 * Lesing (alltid):
 *   npx tsx scripts/testSocialFlow.ts
 *
 * Skrivetest (krever service role + eksplisitt flagg):
 *   SOCIAL_FLOW_TEST_WRITE=1 npx tsx scripts/testSocialFlow.ts
 *
 * Valgfri ordre-kobling (oppdaterer én rad, tilbakestilles):
 *   SOCIAL_FLOW_TEST_WRITE=1 FLOW_TEST_ORDER_ID=<uuid> npx tsx scripts/testSocialFlow.ts
 *
 * Krever: SUPABASE_URL (eller NEXT_PUBLIC_SUPABASE_URL) + SUPABASE_SERVICE_ROLE_KEY i .env / .env.local
 */
import { buildAiActivityLogRow } from "../lib/ai/logging/aiActivityLogRow";
import { buildStandardSocialContentV1 } from "../lib/social/socialPostContent";
import { getSupabaseAdmin } from "./system-test/utils/supabaseAdmin";

/** Bruk gyldig UUID-streng — noen miljøer har `social_posts.id` som uuid-typed kolonne. */
function testPostId(): string {
  return crypto.randomUUID();
}

async function main() {
  // eslint-disable-next-line no-console
  console.log("TEST START — social flow verification");

  const admin = getSupabaseAdmin();

  const { count: c1, error: e1 } = await admin.from("social_posts").select("*", { count: "exact", head: true });
  const { count: c2, error: e2 } = await admin.from("lead_pipeline").select("*", { count: "exact", head: true });
  const { count: c3, error: e3 } = await admin
    .from("orders")
    .select("*", { count: "exact", head: true })
    .not("social_post_id", "is", null);
  const { count: c4, error: e4 } = await admin.from("ai_activity_log").select("*", { count: "exact", head: true }).eq("action", "social_click");

  const countsOk = !e1 && !e2 && !e3 && !e4;
  if (!countsOk) {
    // eslint-disable-next-line no-console
    console.error("[COUNT_ERR]", {
      social_posts: e1?.message,
      lead_pipeline: e2?.message,
      orders: e3?.message,
      ai_activity_log: e4?.message,
    });
  }

  // eslint-disable-next-line no-console
  console.log("[DB_COUNTS]", {
    social_posts: typeof c1 === "number" ? c1 : null,
    lead_pipeline: typeof c2 === "number" ? c2 : null,
    orders_with_social_post_id: typeof c3 === "number" ? c3 : null,
    ai_activity_log_social_click: typeof c4 === "number" ? c4 : null,
  });

  const { data: posts } = await admin.from("social_posts").select("id").limit(20);
  const postIds = (posts ?? []).map((p) => p.id).filter((x): x is string => typeof x === "string");
  if (postIds.length > 0) {
    const { data: ords } = await admin.from("orders").select("id, social_post_id, line_total").in("social_post_id", postIds);
    const byPost = new Map<string, { orders: number; revenue: number }>();
    for (const p of postIds) byPost.set(p, { orders: 0, revenue: 0 });
    for (const o of ords ?? []) {
      const sid = typeof o.social_post_id === "string" ? o.social_post_id : "";
      if (!sid || !byPost.has(sid)) continue;
      const cur = byPost.get(sid)!;
      cur.orders += 1;
      const lt = o.line_total;
      const n = typeof lt === "number" ? lt : typeof lt === "string" ? Number(lt) : 0;
      if (Number.isFinite(n)) cur.revenue += n;
    }
    // eslint-disable-next-line no-console
    console.log(
      "[REVENUE_BY_POST]",
      [...byPost.entries()].map(([id, v]) => ({ id, ...v })),
    );
  } else {
    // eslint-disable-next-line no-console
    console.log("[REVENUE_BY_POST]", []);
  }

  const write = process.env.SOCIAL_FLOW_TEST_WRITE === "1";
  if (!write) {
    // eslint-disable-next-line no-console
    console.log("[WRITE] skipped (set SOCIAL_FLOW_TEST_WRITE=1 to insert smoke rows)");
    // eslint-disable-next-line no-console
    console.log("FLOW STATUS:", countsOk ? "OK (read-only)" : "FAILED (count error)");
    process.exit(countsOk ? 0 : 1);
  }

  const id = testPostId();
  // eslint-disable-next-line no-console
  console.log("[WRITE] test post id", id);

  const content = buildStandardSocialContentV1({
    text: "FLOW TEST",
    hashtags: ["#test"],
    images: [],
    source: "deterministic",
    platform: "linkedin",
    data: { calendarPostId: id },
  });

  const insPost = await admin.from("social_posts").insert({
    id,
    content: content as unknown as Record<string, unknown>,
    platform: "linkedin",
    status: "planned",
  });
  if (insPost.error) {
    // eslint-disable-next-line no-console
    console.error("[WRITE_FAIL] social_posts", insPost.error.message);
    // eslint-disable-next-line no-console
    console.log("FLOW STATUS: FAILED");
    process.exit(1);
  }
  // eslint-disable-next-line no-console
  console.log("POST CREATED");

  const logRow = buildAiActivityLogRow({
    action: "social_click",
    metadata: { postId: id, source: "flow_test_script" },
  });
  const insLog = await admin.from("ai_activity_log").insert({
    ...logRow,
    rid: `flow_${id}`,
    status: "success" as const,
  } as Record<string, unknown>);
  if (insLog.error) {
    // eslint-disable-next-line no-console
    console.error("[WRITE_FAIL] ai_activity_log", insLog.error.message);
  } else {
    // eslint-disable-next-line no-console
    console.log("CLICK LOGGED");
  }

  /** Minimalt innhold — samme kjerne som `20260324170000_lead_pipeline.sql` (source_post_id + status). */
  const insLead = await admin.from("lead_pipeline").insert({ source_post_id: id, status: "new" }).select().single();

  if (insLead.error) {
    // eslint-disable-next-line no-console
    console.warn("[LEAD_PIPELINE]", insLead.error.message, "— sjekk at migrering `lead_pipeline` er kjørt (source_post_id, status).");
  } else {
    // eslint-disable-next-line no-console
    console.log("LEAD CREATED", insLead.data);
  }

  const orderId = String(process.env.FLOW_TEST_ORDER_ID ?? "").trim();
  if (orderId) {
    const { data: before } = await admin.from("orders").select("social_post_id").eq("id", orderId).maybeSingle();
    const prevSocial =
      before && typeof before === "object" && typeof (before as { social_post_id?: unknown }).social_post_id === "string"
        ? String((before as { social_post_id: string }).social_post_id)
        : null;
    const upd = await admin.from("orders").update({ social_post_id: id }).eq("id", orderId);
    if (upd.error) {
      // eslint-disable-next-line no-console
      console.error("[ORDER_LINK_FAIL]", upd.error.message);
    } else {
      // eslint-disable-next-line no-console
      console.log("[ORDER_ATTRIBUTION]", { orderId, social_post_id: id });
    }
    const rev = await admin.from("orders").update({ social_post_id: prevSocial }).eq("id", orderId);
    if (rev.error) {
      // eslint-disable-next-line no-console
      console.error("[ORDER_REVERT_FAIL]", rev.error.message);
    } else {
      // eslint-disable-next-line no-console
      console.log("[ORDER_REVERTED] social_post_id restored");
    }
  } else {
    // eslint-disable-next-line no-console
    console.log("[ORDER] skipped — set FLOW_TEST_ORDER_ID to test FK update on a real order row");
  }

  await admin.from("lead_pipeline").delete().eq("source_post_id", id);
  await admin.from("social_posts").delete().eq("id", id);

  // eslint-disable-next-line no-console
  console.log("TEST DONE — smoke rows cleaned (social_posts + lead_pipeline der mulig)");
  const leadOk = !insLead.error;
  // eslint-disable-next-line no-console
  console.log(
    "FLOW STATUS:",
    leadOk ? "OK (write smoke)" : "PARTIAL (post+click OK; lead_pipeline insert avvist — verifiser DB-skjema)",
  );
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(e);
  process.exit(1);
});
