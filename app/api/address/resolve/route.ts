export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextRequest } from "next/server";
import { jsonErr, jsonOk, makeRid } from "@/lib/http/respond";

function safeStr(v: unknown) {
  return String(v ?? "").trim();
}

export async function GET(req: NextRequest) {
  const rid = makeRid();
  const { searchParams } = new URL(req.url);
  const id = safeStr(searchParams.get("id"));
  if (!id) return jsonErr(rid, "Mangler id.", 400, "BAD_REQUEST");

  // Kartverket: hent adresse-detaljer på id
  // Endpoint varierer litt; vi bruker "id" via "adresser/{id}"
  const url = `https://ws.geonorge.no/adresser/v1/adresser/${encodeURIComponent(id)}`;

  const r = await fetch(url, { cache: "no-store" });
  if (!r.ok) {
    // Fallback: prøv å resolve via sok på id hvis direkte-id ikke støttes i ditt tilfelle
    const fallback = await fetch(
      `https://ws.geonorge.no/adresser/v1/sok?adresseid=${encodeURIComponent(id)}`,
      { cache: "no-store" }
    );
    if (!fallback.ok) return jsonErr(rid, "Kunne ikke slå opp adresse.", 404, "ADDRESS_NOT_FOUND");

    const fd = (await fallback.json()) as any;
    const a = Array.isArray(fd?.adresser) ? fd.adresser?.[0] : null;

    return jsonOk(
      rid,
      {
      address: safeStr(a?.adressetekst),
      postalCode: safeStr(a?.postnummer),
      city: safeStr(a?.poststed),
      },
      200
    );
  }

  const a = (await r.json()) as any;

  return jsonOk(
    rid,
    {
      address: safeStr(a?.adressetekst),
      postalCode: safeStr(a?.postnummer),
      city: safeStr(a?.poststed),
    },
    200
  );
}
