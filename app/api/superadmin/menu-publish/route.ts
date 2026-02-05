// app/api/superadmin/menu-publish/route.ts
import { jsonErr, jsonOk, makeRid } from "@/lib/http/respond";

export async function POST(req: Request) {
  const r = makeRid();
  const body = await req.json();
  const { date, publish } = body;

  if (!date || typeof publish !== "boolean") {
    return jsonErr(r, "date/publish mangler eller er ugyldig.", 400, "BAD_REQUEST");
  }

  // Her kobler dere på eksisterende week-visibility / cron-logikk
  // Denne ruten er kun kontrollpunktet

  return jsonOk(r, { date, publish }, 200);
}
