// app/api/auth/me/route.ts

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { NextRequest } from "next/server";
import { getAuthContext } from "@/lib/auth/getAuthContext";
import { resolveRunnerCompanyIdForBackoffice } from "@/lib/ai/resolveRunnerCompanyForBackoffice";
import { jsonErr, jsonOk, makeRid } from "@/lib/http/respond";
import { withApiAiEntrypoint } from "@/lib/http/withApiAiEntrypoint";

export async function GET(req: NextRequest): Promise<Response> {
  return withApiAiEntrypoint(req, "GET", async () => {
    const rid = makeRid();

    try {
      const auth = await getAuthContext({ rid, reqHeaders: req.headers });
      if (!auth.isAuthenticated || !auth.userId) {
        return jsonErr(rid, "Ikke innlogget.", 401, {
          code: "not_authenticated",
          detail: { user: null },
        });
      }

      const aiRunnerCompanyId =
        auth.ok === true ? await resolveRunnerCompanyIdForBackoffice(auth).catch(() => null) : null;

      return jsonOk(
        rid,
        {
          ok: true,
          rid,
          user: {
            id: auth.userId,
            email: auth.email,
            role: auth.role,
            companyId: auth.company_id,
            aiRunnerCompanyId,
          },
        },
        200,
      );
    } catch {
      return jsonErr(rid, "Kunne ikke verifisere innlogging.", 401, {
        code: "auth_check_failed",
        detail: { user: null },
      });
    }
  });
}


