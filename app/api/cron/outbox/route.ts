// app/api/cron/outbox/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";

import { makeRid, jsonOk, jsonErr } from "@/lib/http/respond";
import { noStoreHeaders } from "@/lib/http/noStore";
import { processOutboxBatch } from "@/lib/orderBackup/outbox";

function safeStr(v: any) {
  return String(v ?? "").trim();
}

/**
 * CRON endpoint (uten auth/cookies).
 * Krever header: x-cron-secret: <CRON_SECRET>
 */
export async function POST(req: NextRequest) {
  const rid = makeRid();

  const secret = safeStr(process.env.CRON_SECRET);
  if (!secret) {
    // jsonErr-signaturen deres: jsonErr(rid, message, status?, error?)
    // Her bruker vi ctx-like { rid } for å matche resten av prosjektet.
    return jsonErr(rid, "CRON_SECRET er ikke satt i environment.", 400, "cron_secret_missing");
  }

  const got = safeStr(req.headers.get("x-cron-secret"));
  if (!got || got !== secret) {
    return jsonErr(rid, "Ugyldig eller manglende x-cron-secret.", 400, "cron_forbidden");
  }

  try {
    const batchSize = 25;
    const res = await processOutboxBatch(batchSize);

    // Sikre no-store selv om jsonOk allerede gjør det hos dere (belt & suspenders)
    const body = { ...(res ?? {}), ok: true, rid, batchSize };
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { ...noStoreHeaders(), "content-type": "application/json; charset=utf-8", "x-lp-rid": rid },
    });
  } catch (e: any) {
    return new Response(
      JSON.stringify({
        ok: false,
        rid,
        error: "outbox_failed",
        message: "Outbox processing feilet.",
        detail: { message: String(e?.message ?? e) },
      }),
      { status: 500, headers: { ...noStoreHeaders(), "content-type": "application/json; charset=utf-8", "x-lp-rid": rid } }
    );
  }
}
