import { NextResponse } from "next/server";

export async function GET() {
  throw new Error("Sentry test error from " + new Date().toISOString());
  return NextResponse.json({ ok: false });
}
