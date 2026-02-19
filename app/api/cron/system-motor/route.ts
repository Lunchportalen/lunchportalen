// app/api/cron/system-motor/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";

import { requireCronAuth } from "@/lib/http/cronAuth";
import { jsonErr, jsonOk, makeRid } from "@/lib/http/respond";
import { runSystemMotor } from "../../superadmin/system/repairs/run/route";

export async function POST(req: NextRequest): Promise<Response> {
  const rid = makeRid();

  try {
    requireCronAuth(req, { secretEnvVar: "SYSTEM_MOTOR_SECRET", missingCode: "system_motor_secret_missing" });
  } catch (e: any) {
    const msg = String(e?.message ?? e);
    const code = String(e?.code ?? "").trim();

    if (msg === "system_motor_secret_missing" || code === "system_motor_secret_missing") {
      return jsonErr(rid, "SYSTEM_MOTOR_SECRET er ikke satt i environment.", 500, "misconfigured");
    }
    if (msg === "forbidden" || code === "forbidden") {
      return jsonErr(rid, "Ugyldig system-motor secret.", 403, "forbidden");
    }
    return jsonErr(rid, "Uventet feil i cron-gate.", 500, { code: "server_error", detail: { message: msg } });
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
    return jsonErr(rid, "Kunne ikke kjore systemmotor.", 500, {
      code: "SYSTEM_MOTOR_FAILED",
      detail: { message: String(e?.message ?? e) },
    });
  }
}
