import { calculateResults } from "@/lib/experiments/evaluator";
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

function isUuid(v: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}

export async function GET(req: Request) {
  const requestId = makeRid("exp_results");
  const url = new URL(req.url);
  const experimentId = (url.searchParams.get("experimentId") ?? "").trim();

  if (!experimentId || !isUuid(experimentId)) {
    return errJson(requestId, "experimentId (uuid) is required", 422);
  }

  const out = await calculateResults(experimentId);
  if (out.ok === false) return errJson(requestId, out.error, 500);

  return okJson(requestId, { results: out.results }, 200);
}
