import { makeRid, jsonErr, jsonOk } from "@/lib/http/respond";

export async function POST(req: Request) {
  const rid = makeRid("ai_block");

  let payload: unknown = null;
  try {
    payload = await req.json();
  } catch {
    return jsonErr(rid, "Invalid JSON", 400, "INVALID_JSON");
  }

  const body = payload as { text?: unknown; action?: unknown };
  const text = typeof body?.text === "string" ? body.text : "";
  const action = typeof body?.action === "string" ? body.action : "";

  if (typeof text !== "string" || text.length < 2) {
    return jsonErr(rid, "Invalid text", 400, "INVALID_TEXT");
  }

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

  const apiKey = process.env.OPENAI_API_KEY ?? process.env.AI_API_KEY ?? "";
  if (!apiKey) {
    // Fail-safe: when env is missing we do not crash and keep the editor stable.
    return jsonOk(rid, { result: text }, 200);
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 60_000);
  try {
    const completionRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.7,
        messages: [
          {
            role: "system",
            content:
              "You are an expert copywriter for premium food and delicatessen products. Return only the rewritten text, without headings, prefixes, or explanation.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
      }),
      signal: controller.signal,
    });

    if (!completionRes.ok) {
      return jsonErr(rid, "AI request failed", 500, "AI_REQUEST_FAILED");
    }

    const completionJson: unknown = await completionRes.json().catch(() => null);
    const resultRaw = (completionJson as any)?.choices?.[0]?.message?.content;
    const result =
      typeof resultRaw === "string" && resultRaw.trim()
        ? resultRaw.replace(/^Tekst:\s*/i, "").replace(/\bTekst:\s*/gi, "").trim()
        : "";

    if (!result) {
      return jsonErr(rid, "Empty AI response", 500, "AI_EMPTY");
    }

    const safeResult = result.slice(0, 5000);
    return jsonOk(rid, { result: safeResult }, 200);
  } catch {
    return jsonErr(rid, "AI request failed", 500, "AI_REQUEST_FAILED");
  } finally {
    clearTimeout(timeoutId);
  }

}

