import "server-only";

export type MembershipLookupSource = "rpc" | "profiles";

export type MembershipLookupOk = {
  ok: true;
  source: MembershipLookupSource;
  role: string | null;
  company_id: string | null;
  location_id: string | null;
  status: string | null;
  updated_at: string | null;
};

export type MembershipLookupErr = {
  ok: false;
  source: MembershipLookupSource;
  reason: "NO_PROFILE" | "BLOCKED" | "ERROR";
  detail?: string;
};

export type MembershipLookupResult = MembershipLookupOk | MembershipLookupErr;

const PROFILE_SELECT_COLUMNS = "user_id, role, company_id, location_id";

type RpcState = "unknown" | "available" | "missing";

function safeStr(v: unknown) {
  return String(v ?? "").trim();
}

function normalize(value: unknown): string | null {
  const s = safeStr(value);
  return s || null;
}

function normalizeStatus(value: unknown): string | null {
  const s = safeStr(value).toLowerCase();
  return s || null;
}

function blockedByStatus(status: string | null) {
  return status === "blocked" || status === "disabled" || status === "inactive";
}

function schemaMissingError(error: any) {
  const code = safeStr(error?.code).toUpperCase();
  const message = safeStr(error?.message).toLowerCase();
  return code === "42P01" || code === "42703" || code === "PGRST204" || message.includes("column") || message.includes("relation");
}

function rpcMissingError(error: any) {
  const code = safeStr(error?.code).toUpperCase();
  const message = safeStr(error?.message).toLowerCase();
  return code === "PGRST202" || message.includes("could not find the function") || message.includes("lp_membership_get");
}

function preferredSource() {
  const env = safeStr(process.env.LP_AUTH_MEMBERSHIP_SOURCE).toLowerCase();
  if (env === "rpc") return "rpc";
  if (env === "auto") return "auto";
  return "profiles";
}

let rpcState: RpcState = preferredSource() === "profiles" ? "missing" : "unknown";

async function viaRpc(sb: any, userId: string): Promise<MembershipLookupResult> {
  const { data, error } = await sb.rpc("lp_membership_get", { p_user_id: userId });

  if (error) {
    if (rpcMissingError(error)) {
      return { ok: false, source: "rpc", reason: "ERROR", detail: "RPC_NOT_FOUND" };
    }
    return { ok: false, source: "rpc", reason: "ERROR", detail: safeStr(error?.message || error?.code || "RPC_FAILED") };
  }

  const row = Array.isArray(data) ? data[0] : data;
  if (!row) {
    return { ok: false, source: "rpc", reason: "NO_PROFILE" };
  }

  const role = normalize((row as any)?.role);
  const company_id = normalize((row as any)?.company_id);
  const location_id = normalize((row as any)?.location_id);
  const updated_at = normalize((row as any)?.updated_at);
  const statusFromRpc = normalizeStatus((row as any)?.status);
  const status = statusFromRpc ?? ((row as any)?.is_active === false ? "inactive" : null);

  if (blockedByStatus(status)) {
    return { ok: false, source: "rpc", reason: "BLOCKED" };
  }

  return {
    ok: true,
    source: "rpc",
    role,
    company_id,
    location_id,
    status,
    updated_at,
  };
}

async function viaProfiles(sb: any, userId: string): Promise<MembershipLookupResult> {
  const { data, error } = await sb
    .from("profiles")
    .select(PROFILE_SELECT_COLUMNS)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    if (schemaMissingError(error)) {
      return { ok: false, source: "profiles", reason: "NO_PROFILE", detail: "SCHEMA_MISMATCH" };
    }
    return { ok: false, source: "profiles", reason: "ERROR", detail: safeStr(error?.message || error?.code || "PROFILE_LOOKUP_FAILED") };
  }

  if (!data) {
    return { ok: false, source: "profiles", reason: "NO_PROFILE" };
  }

  return {
    ok: true,
    source: "profiles",
    role: normalize((data as any)?.role),
    company_id: normalize((data as any)?.company_id),
    location_id: normalize((data as any)?.location_id),
    status: null,
    updated_at: null,
  };
}

export async function lookupMembership(sb: any, userId: string, _input?: { rid?: string }): Promise<MembershipLookupResult> {
  const uid = safeStr(userId);
  if (!uid) {
    return { ok: false, source: "profiles", reason: "NO_PROFILE" };
  }

  const pref = preferredSource();
  if (pref === "profiles") {
    return viaProfiles(sb, uid);
  }

  if (pref === "rpc") {
    const rpc = await viaRpc(sb, uid);
    if (rpc.ok === false && rpc.detail === "RPC_NOT_FOUND") {
      return viaProfiles(sb, uid);
    }
    return rpc;
  }

  if (rpcState !== "missing") {
    const rpc = await viaRpc(sb, uid);
    if (rpc.ok) {
      rpcState = "available";
      return rpc;
    }
    if (rpc.ok === false && rpc.detail === "RPC_NOT_FOUND") {
      rpcState = "missing";
      return viaProfiles(sb, uid);
    }
    return rpc;
  }

  return viaProfiles(sb, uid);
}
