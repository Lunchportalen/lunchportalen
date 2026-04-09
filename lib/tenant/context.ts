/**
 * Edge / request hints only. Authoritative tenant scope remains server-side (`profiles.company_id`, etc.).
 * Never use these headers alone for authorization or data filtering.
 */
export type TenantContextHint = {
  tenantIdHint: string | null;
  planHint: string;
};

function readHeader(h: Headers, name: string): string | null {
  const v = h.get(name);
  const t = typeof v === "string" ? v.trim() : "";
  return t.length ? t : null;
}

/** Safe for Edge (Web Headers) and Node (NextRequest.headers). */
export function getTenantContext(req: { headers: Headers } | Headers): TenantContextHint {
  const h = req instanceof Headers ? req : req.headers;
  const plan = readHeader(h, "x-plan") ?? "standard";
  return {
    tenantIdHint: readHeader(h, "x-tenant-id"),
    planHint: plan || "standard",
  };
}
