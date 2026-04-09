import { logActivity } from "@/lib/ai/logActivity";
import { AI_RUNNER_TOOL, AiRunnerError, runAi } from "@/lib/ai/runner";
import { auditLog, buildAuditEvent } from "@/lib/audit/log";
import { getAuthContext } from "@/lib/auth/getAuthContext";
import { resolveAiTenantExecutionIds } from "@/lib/auth/resolveAiTenant";
import { makeRid, jsonErr, jsonOk } from "@/lib/http/respond";
import { withApiAiEntrypoint } from "@/lib/http/withApiAiEntrypoint";

export async function POST(req: Request) {
  return withApiAiEntrypoint(req, "POST", async () => {
  const rid = makeRid("ai_block");
  const start = Date.now();
  const logEnd = (status: "success" | "error", meta?: Record<string, unknown>) => {
    const duration = Date.now() - start;
    logActivity({
      rid,
      action: "improve",
      status,
      duration,
      metadataExtra: { route: "api/ai/block", ...meta },
    });
  };

  let payload: unknown = null;
  try {
    payload = await req.json();
  } catch {
    logEnd("error", { code: "INVALID_JSON" });
    return jsonErr(rid, "Invalid JSON", 400, "INVALID_JSON");
  }

  const body = payload as {
    text?: unknown;
    action?: unknown;
    companyId?: unknown;
    userId?: unknown;
  };
  const text = typeof body?.text === "string" ? body.text : "";
  const action = typeof body?.action === "string" ? body.action : "";

  if (typeof text !== "string" || text.length < 2) {
    logEnd("error", { code: "INVALID_TEXT", blockSubAction: action });
    return jsonErr(rid, "Invalid text", 400, "INVALID_TEXT");
  }

  const tenant = await resolveAiTenantExecutionIds({
    rid,
    bodyCompanyId: typeof body?.companyId === "string" ? body.companyId : "",
    bodyUserId: typeof body?.userId === "string" ? body.userId : "",
  });
  if (tenant.ok === false) {
    logEnd("error", { code: tenant.err.code });
    return jsonErr(rid, tenant.err.message, tenant.err.status, tenant.err.code);
  }
  const { companyId, userId } = tenant;

  const buildPrompt = (inputText: string, inputAction: string): string => {
    if (inputAction === "improve") {
      return `
Forbedre teksten under.

Krav:
- Eksklusiv, varm og tillitsbyggende tone
- Skriv som en premium delikatessebutikk
- Gjør teksten mer appetittvekkende og engasjerende
- Behold mening, men forbedre flyt og lesbarhet

Tekst:
${inputText}
`;
    }

    if (inputAction === "shorten") {
      return `
Forkort teksten under.

Krav:
- Behold hovedbudskapet
- Maks 60% lengde
- Fortsatt god flyt og kvalitet
- Unngå gjentakelser

Tekst:
${inputText}
`;
    }

    if (inputAction === "seo") {
      return `
Optimaliser teksten for SEO og konvertering.

Krav:
- Naturlig bruk av relevante søkeord (food / delikatesse / lunsj / catering)
- Øk klikkrate og lesbarhet
- Unngå keyword stuffing
- Skriv som en ekspert på delikatesser
- Prioriter tydelig verdi for kunden

Tekst:
${inputText}
`;
    }

    return inputText;
  };

  const prompt = buildPrompt(text, action);

  const systemPrompt =
    "You are an expert copywriter for premium food and delicatessen products. Return only the rewritten text, without headings, prefixes, or explanation.";

  try {
    const { result } = await runAi({
      companyId,
      userId,
      tool: AI_RUNNER_TOOL.BLOCK_COPY,
      input: {
        system: systemPrompt,
        user: prompt,
        temperature: 0.7,
        max_tokens: 2048,
      },
    });
    const resultStr = typeof result === "string" ? result : "";
    const cleaned = resultStr
      ? resultStr.replace(/^Tekst:\s*/i, "").replace(/\bTekst:\s*/gi, "").trim()
      : "";

    if (!cleaned) {
      logEnd("error", { code: "AI_EMPTY", blockSubAction: action });
      return jsonErr(rid, "Empty AI response", 500, "AI_EMPTY");
    }

    const safeResult = cleaned.slice(0, 5000);
    logEnd("success", { blockSubAction: action });
    void getAuthContext({ rid }).then((ctx) => {
      auditLog(
        buildAuditEvent(ctx, {
          action: "AI_EXECUTION",
          resource: "ai:block",
          metadata: { textLen: text.length, blockSubAction: action },
        }),
      );
    });
    return jsonOk(rid, { result: safeResult }, 200);
  } catch (e) {
    if (e instanceof AiRunnerError && (e.code === "AI_DISABLED" || e.code === "PROVIDER_ERROR")) {
      logEnd("error", { code: e.code, blockSubAction: action });
      const status = e.code === "AI_DISABLED" ? 503 : 502;
      return jsonErr(
        rid,
        e.message || (e.code === "AI_DISABLED" ? "AI er deaktivert." : "AI-leverandør feilet."),
        status,
        e.code,
      );
    }
    if (e instanceof AiRunnerError) {
      logEnd("error", { code: e.code, blockSubAction: action });
      const status =
        e.code === "PLAN_NOT_ALLOWED" ||
        e.code === "POLICY_DENIED" ||
        e.code === "USAGE_LIMIT_EXCEEDED" ||
        e.code === "PROFITABILITY_BLOCK" ||
        e.code === "PROFITABILITY_CONTEXT_FAILED"
          ? 403
          : e.code === "MISSING_COMPANY_ID" || e.code === "MISSING_USER_ID"
            ? 422
            : 500;
      return jsonErr(rid, e.message, status, e.code);
    }
    logEnd("error", { code: "AI_REQUEST_FAILED", blockSubAction: action, thrown: true });
    return jsonErr(rid, "AI request failed", 500, "AI_REQUEST_FAILED");
  }
  });
}
