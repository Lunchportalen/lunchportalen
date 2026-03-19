import { makeRid, jsonErr, jsonOk } from "@/lib/http/respond";

export async function POST(req: Request) {
  const rid = makeRid("ai_score");

  try {
    const payload: unknown = await req.json().catch(() => null);
    const body = payload as { text?: unknown };
    const text = typeof body?.text === "string" ? body.text : "";

    if (!text || typeof text !== "string") {
      return jsonErr(rid, "Missing text", 400, "INVALID");
    }

    const lengthScore = Math.min(100, Math.floor(text.length / 2));

    const hints: string[] = [];

    if (text.length < 80) {
      hints.push("Utvid teksten for bedre synlighet");
    }

    if (!text.match(/smak|opplevelse|kvalitet/i)) {
      hints.push("Bruk mer sanselige ord (smak, kvalitet, opplevelse)");
    }

    if (!text.match(/perfekt|beste|unik/i)) {
      hints.push("Legg til salgsutløsende ord");
    }

    // Guarantee actionable hint density (2–3).
    if (hints.length < 2) {
      hints.push("Gjør første setning mer konkret og salgsrettet");
    }
    if (hints.length < 2) {
      hints.push("Knyt teksten til en tydelig kundeopplevelse (smak, kvalitet, trygghet)");
    }

    return jsonOk(rid, { score: lengthScore, hints: hints.slice(0, 3) }, 200);
  } catch {
    return jsonErr(rid, "Failed", 500, "ERROR");
  }
}

