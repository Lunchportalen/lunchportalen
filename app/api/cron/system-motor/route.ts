export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";
import { jsonErr, jsonOk, makeRid } from "@/lib/http/respond";
import { runSystemMotor } from "../../superadmin/system/repairs/run/route";

function safeStr(v: any) {
  return String(v ?? "").trim();
}

export async function POST(req: NextRequest): Promise<Response> {
  const rid = makeRid();

  const secret = safeStr(process.env.SYSTEM_MOTOR_SECRET);
  if (!secret) {
    return jsonErr(rid, "SYSTEM_MOTOR_SECRET er ikke satt i environment.", 501, "cron_secret_missing");
  }

  const got = safeStr(req.headers.get("x-cron-secret"));
  if (!got || got !== secret) {
    return jsonErr(rid, "Ugyldig eller manglende x-cron-secret.", 403, "cron_forbidden");
  }

  try {
    const result = await runSystemMotor({
      rid,
      source: "cron",
      jobLimit: 10,
      enqueueLimit: 100,
      includeOrderIntegrity: true,
    });

    return jsonOk(rid, result, 200);
  } catch (e: any) {
    return jsonErr(rid, "Kunne ikke kjÃ¸re systemmotor.", 500, {
      code: "SYSTEM_MOTOR_FAILED",
      detail: { message: String(e?.message ?? e) },
    });
  }
}
