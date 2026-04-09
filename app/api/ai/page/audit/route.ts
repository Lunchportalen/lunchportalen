import { logActivity } from "@/lib/ai/logActivity";
import { makeRid, jsonOk, jsonErr } from "@/lib/http/respond";
import { withApiAiEntrypoint } from "@/lib/http/withApiAiEntrypoint";

export async function POST(req: Request) {
  return withApiAiEntrypoint(req, "POST", async () => {
  const rid = makeRid("ai_audit");
  const start = Date.now();
  const logEnd = (status: "success" | "error", meta?: Record<string, unknown>) => {
    const duration = Date.now() - start;
    logActivity({
      rid,
      action: "audit",
      status,
      duration,
      metadataExtra: { route: "api/ai/page/audit", ...meta },
    });
  };

  try {
    const payload: unknown = await req.json().catch(() => null);
    const body = payload as { blocks?: unknown };
    const blocks = body?.blocks;

    if (!Array.isArray(blocks)) {
      logEnd("error", { code: "INVALID" });
      return jsonErr(rid, "Missing blocks", 400, "INVALID");
    }

    let score = 100;
    const issues: string[] = [];

    const types = blocks
      .map((b) => {
        if (!b || typeof b !== "object") return "";
        const t = (b as { type?: unknown }).type;
        return typeof t === "string" ? t : "";
      })
      .filter(Boolean);

    if (!types.includes("hero")) {
      score -= 20;
      issues.push("Mangler hero-seksjon (førsteinntrykk)");
    }

    if (!types.includes("cta")) {
      score -= 20;
      issues.push("Mangler tydelig CTA");
    }

    if (blocks.length < 3) {
      score -= 15;
      issues.push("For lite innhold – lav SEO verdi");
    }

    if (!types.includes("text") && !types.includes("richText")) {
      score -= 10;
      issues.push("Manglende forklarende tekst");
    }

    score = Math.max(score, 0);

    logEnd("success", { blockCount: blocks.length });
    return jsonOk(rid, { score, issues }, 200);
  } catch {
    logEnd("error", { code: "ERROR", thrown: true });
    return jsonErr(rid, "Failed", 500, "ERROR");
  }
  });
}

