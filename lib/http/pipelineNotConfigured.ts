import "server-only";

import { NextResponse } from "next/server";

/** DB har ikke `lead_pipeline` — deterministisk svar uten 500. */
export function pipelineNotConfiguredResponse(): NextResponse {
  return NextResponse.json(
    { ok: false, code: "PIPELINE_NOT_CONFIGURED" as const, data: [] as const },
    { status: 200, headers: { "content-type": "application/json; charset=utf-8" } },
  );
}
