// lib/guards/assertCompanyActive.ts
import { opsLog } from "@/lib/ops/log";

type CompanyStatus = "ACTIVE" | "PAUSED" | "CLOSED" | "PENDING" | "UNKNOWN";

function normStatus(v: any): CompanyStatus {
  const s = String(v ?? "").trim().toUpperCase();
  if (s === "ACTIVE") return "ACTIVE";
  if (s === "PAUSED") return "PAUSED";
  if (s === "CLOSED") return "CLOSED";
  if (s === "PENDING") return "PENDING";
  return "UNKNOWN";
}

export async function assertCompanyActive(args: {
  rid: string;
  sb: any;
  company_id: string;
}) {
  const { rid, sb, company_id } = args;

  let status: CompanyStatus = "UNKNOWN";

  // 1) preferred view if present (often mocked)
  try {
    const q = sb.from("profile_company_status");
    if (q && typeof q.eq === "function") {
      const r = await q.select("company_id,status").eq("company_id", company_id).maybeSingle?.() ?? await q.select("company_id,status").eq("company_id", company_id).single?.();
      status = normStatus(r?.data?.status);
    }
  } catch {}

  // 2) fallback companies
  if (status === "UNKNOWN") {
    try {
      const r = await sb.from("companies").select("id,status").eq("id", company_id).maybeSingle();
      status = normStatus(r?.data?.status);
    } catch {}
  }

  if (status === "UNKNOWN") {
    opsLog("company.lookup.failed", { rid, company_id });
    const err: any = new Error("Kunne ikke hente firmastatus.");
    err.status = 500;
    err.code = "COMPANY_LOOKUP_FAILED";
    throw err;
  }

  if (status === "PAUSED") {
    const err: any = new Error("Firma er pauset.");
    err.status = 403;
    err.code = "COMPANY_PAUSED";
    throw err;
  }
  if (status === "CLOSED") {
    const err: any = new Error("Firma er stengt.");
    err.status = 403;
    err.code = "COMPANY_CLOSED";
    throw err;
  }
  if (status !== "ACTIVE") {
    const err: any = new Error("Firma er ikke aktivt.");
    err.status = 403;
    err.code = "COMPANY_NOT_ACTIVE";
    throw err;
  }
}
