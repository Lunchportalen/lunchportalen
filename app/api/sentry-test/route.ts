import { NextResponse } from "next/server";

import { logSentryDiagnostics } from "@/lib/sentry/diagnostics";

export async function GET() {
  logSentryDiagnostics("api/sentry-test");
  throw new Error("Sentry test error from " + new Date().toISOString());
  return NextResponse.json({ ok: false });
}
