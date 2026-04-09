import { loadPatternRows } from "@/lib/ai/learning";
import { withApiAiEntrypoint } from "@/lib/http/withApiAiEntrypoint";
import { makeRid } from "@/lib/http/rid";

const JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8",
} as const;

function okJson(ridValue: string, data: unknown, status = 200): Response {
  return new Response(JSON.stringify({ ok: true, rid: ridValue, data }), { status, headers: JSON_HEADERS });
}

function errJson(ridValue: string, error: string, status: number, message?: string): Response {
  return new Response(
    JSON.stringify({
      ok: false,
      rid: ridValue,
      error,
      message: message ?? error,
      status,
    }),
    { status, headers: JSON_HEADERS },
  );
}

function buildTrends(rows: Awaited<ReturnType<typeof loadPatternRows>>): string[] {
  const pos = rows.filter((r) => r.weight > 0.15).slice(0, 6);
  const neg = rows.filter((r) => r.weight < -0.15).slice(0, 6);
  const lines: string[] = [];
  for (const r of pos) {
    lines.push(
      `Positivt: «${r.pattern_key}» (vekt ${r.weight.toFixed(2)}, ${r.evidence_count} observasjoner) — ${(r.last_reason ?? "").slice(0, 120)}`,
    );
  }
  for (const r of neg) {
    lines.push(
      `Negativt: «${r.pattern_key}» (vekt ${r.weight.toFixed(2)}, ${r.evidence_count} observasjoner) — ${(r.last_reason ?? "").slice(0, 120)}`,
    );
  }
  if (lines.length === 0) {
    lines.push("Ingen sterke mønster ennå — kjør læring fra et fullført eksperiment med nok trafikk.");
  }
  return lines;
}

/**
 * GET — top learned patterns + trend strings.
 * Same shape as /api/ai/analyze: plain handler. Read-only.
 */
export async function GET(req: Request) {
  return withApiAiEntrypoint(req, "GET", async () => {
  const requestId = makeRid("ai_insights");
  try {
    const rows = await loadPatternRows(40);
    const topPatterns = rows.slice(0, 20).map((r) => ({
      patternKey: r.pattern_key,
      weight: Math.round(r.weight * 1000) / 1000,
      evidenceCount: r.evidence_count,
      lastReason: r.last_reason,
      basedOn: r.based_on,
      updatedAt: r.updated_at,
    }));

    return okJson(
      requestId,
      {
        topPatterns,
        trends: buildTrends(rows),
      },
      200,
    );
  } catch {
    return errJson(requestId, "INSIGHTS_FAILED", 500);
  }
  });
}
