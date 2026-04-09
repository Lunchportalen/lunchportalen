export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import "server-only";

import type { NextRequest } from "next/server";
import { getCmsRuntimeStatus } from "@/lib/localRuntime/runtime";
import { jsonErr, jsonOk, makeRid } from "@/lib/http/respond";
import {
  ensureRemoteBackendAuthHarnessUser,
  getRemoteBackendAuthHarnessCredentials,
  isRemoteBackendAuthHarnessEnabled,
} from "@/lib/auth/remoteBackendAuthHarness";
import { ensureRemoteBackendCmsHarnessContent } from "@/lib/auth/remoteBackendCmsHarness";

function safeTrim(value: unknown): string {
  return String(value ?? "").trim();
}

function isLoopbackHost(req: NextRequest): boolean {
  const host = safeTrim(req.headers.get("host")).toLowerCase();
  return host.startsWith("localhost:") || host.startsWith("127.0.0.1:") || host.startsWith("[::1]:");
}

export async function POST(req: NextRequest) {
  const rid = makeRid();
  const runtimeStatus = getCmsRuntimeStatus();

  if (!isLoopbackHost(req)) {
    return jsonErr(rid, "Remote harness er kun tilgjengelig via localhost.", 403, "HARNESS_LOCALHOST_ONLY");
  }

  if (!isRemoteBackendAuthHarnessEnabled()) {
    return jsonErr(rid, "Remote backend auth harness er ikke aktivert for dette miljøet.", 404, "HARNESS_DISABLED", {
      mode: runtimeStatus.mode,
      source: runtimeStatus.source,
    });
  }

  const ensured = await ensureRemoteBackendAuthHarnessUser();
  if (ensured.ok === false) {
    const reason = ensured.reason;
    return jsonErr(
      rid,
      reason === "missing_admin_config"
        ? "Remote backend harness mangler Supabase admin-konfigurasjon."
        : "Remote backend harness er ikke aktivert for dette miljøet.",
      503,
      reason === "missing_admin_config" ? "HARNESS_ADMIN_CONFIG_MISSING" : "HARNESS_DISABLED",
      { mode: runtimeStatus.mode, source: runtimeStatus.source },
    );
  }

  let seededContent: Awaited<ReturnType<typeof ensureRemoteBackendCmsHarnessContent>> | null = null;
  try {
    seededContent = await ensureRemoteBackendCmsHarnessContent();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Ukjent feil ved CMS-seeding.";
    return jsonErr(rid, message, 503, "HARNESS_CMS_SEED_FAILED", {
      mode: runtimeStatus.mode,
      source: runtimeStatus.source,
    });
  }

  const credentials = getRemoteBackendAuthHarnessCredentials();

  return jsonOk(
    rid,
    {
      mode: runtimeStatus.mode,
      source: runtimeStatus.source,
      explicit: runtimeStatus.explicit,
      email: credentials?.email ?? ensured.email,
      created: ensured.created,
      userId: ensured.userId,
      seededContent,
      next: "/backoffice/content",
    },
    200,
  );
}
