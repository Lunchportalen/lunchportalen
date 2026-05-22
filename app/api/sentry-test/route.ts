import * as Sentry from "@sentry/nextjs";
import { NextResponse } from "next/server";

import { logSentryDiagnostics } from "@/lib/sentry/diagnostics";

export async function GET() {
  logSentryDiagnostics("api/sentry-test");
  const err = new Error("Sentry test error from " + new Date().toISOString());
  Sentry.captureException(err);
  await Sentry.flush(2000);
  throw err;
  return NextResponse.json({ ok: false });
}
