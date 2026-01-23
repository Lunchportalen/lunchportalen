export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function GET() {
  const c = await cookies();
  const list = c.getAll().map((x) => ({ name: x.name, value: x.value.slice(0, 12) + "…" }));
  return NextResponse.json({ ok: true, count: list.length, cookies: list }, { status: 200 });
}
