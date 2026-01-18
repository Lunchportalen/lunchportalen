// app/api/superadmin/menu-publish/route.ts
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const body = await req.json();
  const { date, publish } = body;

  if (!date || typeof publish !== "boolean") {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  // Her kobler dere på eksisterende week-visibility / cron-logikk
  // Denne ruten er kun kontrollpunktet

  return NextResponse.json({ ok: true });
}
