export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import "server-only";

import type { NextRequest } from "next/server";
import { makeRid, jsonErr, jsonOk } from "@/lib/http/respond";
import { POST as RegisterCompanyPOST } from "@/app/api/public/register-company/route";

export async function POST(req: NextRequest) {
  const rid = makeRid("rid_register_alias");

  try {
    const res = await RegisterCompanyPOST(req);
    if (res) return res;

    return jsonOk(rid, {
      companyId: null,
      receipt: { message: "Registreringen er mottatt." },
    });
  } catch {
    return jsonErr(rid, "Registreringen kunne ikke fullføres nå.", 500, "REGISTER_PROXY_FAILED");
  }
}
