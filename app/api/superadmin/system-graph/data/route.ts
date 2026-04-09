export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import * as fs from "fs";
import * as path from "path";
import type { NextRequest } from "next/server";

import { buildSystemGraph } from "@/lib/repo-intelligence/buildSystemGraph";
import { denyResponse, requireRoleOr403, scopeOr401 } from "@/lib/http/routeGuard";
import { jsonErr, jsonOk, makeRid } from "@/lib/http/respond";

function readIntel(name: string): unknown {
  const p = path.join(process.cwd(), "repo-intelligence", name);
  if (!fs.existsSync(p)) {
    throw new Error(`missing_intel:${name}`);
  }
  return JSON.parse(fs.readFileSync(p, "utf8")) as unknown;
}

export async function GET(req: NextRequest): Promise<Response> {
  const rid = makeRid("superadmin_system_graph");
  const gate = await scopeOr401(req);
  if (gate.ok === false) return denyResponse(gate);
  const deny = requireRoleOr403(gate.ctx, ["superadmin"]);
  if (deny) return deny;

  try {
    const routes = readIntel("routes.json") as Parameters<typeof buildSystemGraph>[0]["routes"];
    const apiMap = readIntel("api-map.json") as Parameters<typeof buildSystemGraph>[0]["apiMap"];
    const dbMap = readIntel("db-map.json") as Parameters<typeof buildSystemGraph>[0]["dbMap"];
    const flows = readIntel("flows.json") as Parameters<typeof buildSystemGraph>[0]["flows"];
    const repoMap = readIntel("repo-map.json") as Parameters<typeof buildSystemGraph>[0]["repoMap"];
    const deps = readIntel("dependencies.json") as Parameters<typeof buildSystemGraph>[0]["deps"];

    const payload = buildSystemGraph({ routes, apiMap, dbMap, flows, repoMap, deps });
    return jsonOk(rid, payload, 200);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.startsWith("missing_intel:")) {
      return jsonErr(rid, "repo-intelligence mangler. Kjør npm run repo:scan.", 503, "INTEL_MISSING", e);
    }
    return jsonErr(rid, "Kunne ikke bygge systemgraf.", 500, "SYSTEM_GRAPH_FAILED", e);
  }
}
