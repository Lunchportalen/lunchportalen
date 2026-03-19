import { makeRid, jsonOk, jsonErr } from "@/lib/http/respond";

export async function POST(req: Request) {
  const rid = makeRid("ai_build");

  try {
    const payload: unknown = await req.json().catch(() => null);
    const body = payload as { intent?: unknown; product?: unknown; audience?: unknown };
    const intent = typeof body?.intent === "string" ? body.intent.trim() : "";
    const product = typeof body?.product === "string" ? body.product.trim() : "";
    const audience = typeof body?.audience === "string" ? body.audience.trim() : "";

    if (!intent || !product || !audience) {
      return jsonErr(rid, "Missing intent, product or audience", 400, "INVALID");
    }

    const buildPrompt = () => `
Du er en ekspert i konvertering og SEO for delikatesseprodukter.

Lag en landingsside struktur.

Krav:
- Hero (tydelig verdi)
- Intro (tillit + historie)
- Produktseksjon (fordeler)
- Sosial proof
- CTA (kjøp / handling)

Produkt:
${product}

Målgruppe:
${audience}

Mål:
${intent}

Returner som JSON array:
[{ type, content }]
`;

    const prompt = buildPrompt();
    const blocks = [
      {
        id: "hero-1",
        type: "hero",
        title: `Oppdag ${product} i toppklasse`,
        subtitle: `Skapt for ${audience} med fokus på kvalitet, smak og trygg leveranse`,
        imageUrl: "",
        imageAlt: "",
        ctaLabel: "Bestill nå",
        ctaHref: "/",
      },
      {
        id: "intro-1",
        type: "richText",
        heading: "Historie og tillit",
        body: `For ${audience} som ønsker dokumentert kvalitet, ekte råvarer og en premium opplevelse i hver levering.`,
      },
      {
        id: "product-1",
        type: "richText",
        heading: `${product} med tydelige fordeler`,
        body: `${product} med fokus på smak, opprinnelse og håndverk, optimalisert for ${intent.toLowerCase()} uten å miste lesbarhet.`,
      },
      {
        id: "proof-1",
        type: "richText",
        heading: "Sosial proof",
        body: "Foretrukket av kvalitetsbevisste kunder som verdsetter premium råvarer, presisjon og forutsigbar levering.",
      },
      {
        id: "cta-1",
        type: "cta",
        title: "Klar for neste steg?",
        body: "Se hele utvalget og bestill med en enkel, trygg prosess.",
        buttonLabel: "Bestill nå",
        buttonHref: "/",
      },
    ];

    // Keep prompt available for transparent future model swap (no external call yet).
    if (!prompt.trim()) {
      return jsonErr(rid, "Prompt build failed", 500, "ERROR");
    }

    return jsonOk(rid, { blocks }, 200);
  } catch {
    return jsonErr(rid, "Failed", 500, "ERROR");
  }
}

