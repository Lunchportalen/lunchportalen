export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextRequest } from "next/server";
import { jsonErr, jsonOk, makeRid } from "@/lib/http/respond";

type Item = { id: string; title: string; subtitle?: string | null };

function safeStr(v: unknown) {
  return String(v ?? "").trim();
}

export async function GET(req: NextRequest) {
  const rid = makeRid();
  const { searchParams } = new URL(req.url);
  const q = safeStr(searchParams.get("q"));
  if (q.length < 3) return jsonOk(rid, { items: [] }, 200);

  // Kartverket Geonorge: adresse-søk (gratis)
  // Vi bruker "sok" endpoint for adresse, returnerer treff med id
  const url =
    "https://ws.geonorge.no/adresser/v1/sok" +
    `?sok=${encodeURIComponent(q)}` +
    "&fuzzy=true&utkoordsys=4258&treffPerSide=8&side=1";

  const r = await fetch(url, { cache: "no-store" });
  if (!r.ok) {
    return jsonErr(rid, "Adressesøk feilet.", 502, {
      code: "ADDRESS_SEARCH_UPSTREAM_FAILED",
      detail: { status: r.status },
    });
  }

  const data = (await r.json()) as any;
  const hits = Array.isArray(data?.adresser) ? data.adresser : [];

  const items: Item[] = hits.slice(0, 8).map((a: any) => {
    const adr = safeStr(a?.adressetekst);
    const postnr = safeStr(a?.postnummer);
    const poststed = safeStr(a?.poststed);
    const kommune = safeStr(a?.kommunenavn);

    // ID vi kan resolve på (Kartverket har 'adresseId' eller 'id' avhengig av variant)
    const id = safeStr(a?.adresseId || a?.id || a?.objektId || "");

    return {
      id,
      title: adr || q,
      subtitle: [postnr && poststed ? `${postnr} ${poststed}` : "", kommune ? `(${kommune})` : ""]
        .filter(Boolean)
        .join(" "),
    };
  });

  return jsonOk(rid, { items }, 200);
}
