import "server-only";

import { supabaseAdmin } from "@/lib/supabase/admin";

/**
 * TPT-A-1 (2026-05-20): Multi-tenant signature.
 * - resolveTripletexAuth(opts?: { providerId?, env? })
 * - Default-args = Lp's env (unchanged behavior)
 * - providerId set → loadProviderCredentials() via Vault-backed RPC (TPT-B-1)
 * - Session cache keyed per (providerId|'lp', env), TTL ~6 days
 * References: TRIPLETEX-PLAN-V1 v3.1 §5 + Q8-discovery
 */

type AnyJson = Record<string, unknown> | unknown[] | string | number | boolean | null;

export type TripletexErrorKind =
  | "CONFIG_MISSING"
  | "AUTH"
  | "TRANSIENT"
  | "PERMANENT"
  | "PROVIDER_CREDENTIALS_NOT_CONFIGURED";

export type TripletexAuthOpts = {
  providerId?: string | null;
  env?: "test" | "prod";
  tokenOverride?: string;
};

export class TripletexClientError extends Error {
  readonly kind: TripletexErrorKind;
  readonly code: string;
  readonly status: number | null;
  readonly detail: AnyJson | null;

  constructor(input: {
    message: string;
    kind: TripletexErrorKind;
    code: string;
    status?: number | null;
    detail?: AnyJson | null;
  }) {
    super(input.message);
    this.name = "TripletexClientError";
    this.kind = input.kind;
    this.code = input.code;
    this.status = input.status ?? null;
    this.detail = input.detail ?? null;
  }
}

export type TripletexAuth = {
  companyId: string;
  token: string;
};

type TripletexConfig = {
  baseUrl: string;
  companyId: string;
  directToken: string | null;
  consumerToken: string | null;
  employeeToken: string | null;
  timeoutMs: number;
  retries: number;
};

type RequestInput = {
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  path: string;
  query?: Record<string, string | number | boolean | null | undefined>;
  body?: unknown;
};

type RequestOptions = {
  auth?: TripletexAuth;
  timeoutMs?: number;
  retries?: number;
};

type RequestResult = {
  status: number;
  raw: AnyJson;
  value: AnyJson;
};

type EnsureCustomerCompany = {
  id: string;
  orgnr: string;
  legal_name: string;
  billing_email: string | null;
  billing_address: string;
  billing_postcode: string;
  billing_city: string;
  billing_country: string;
  ehf_enabled: boolean;
  ehf_endpoint: string | null;
};

type EnsureCustomerInput = {
  admin: any;
  company: EnsureCustomerCompany;
  request?: RequestOptions;
};

export type EnsureProviderCustomerProvider = {
  id: string;
  name: string;
  org_number: string | null;
  contact_email: string;
  billing_address?: string | null;
  billing_postcode?: string | null;
  billing_city?: string | null;
  billing_country?: string | null;
};

type EnsureProviderCustomerInput = {
  admin: any;
  provider: EnsureProviderCustomerProvider;
  request?: RequestOptions;
};

type EnsureCompanyCustomerInput = {
  admin: any;
  providerId: string;
  company: EnsureCustomerCompany;
  env?: "test" | "prod";
  request?: RequestOptions;
};

type EnsureProviderProductInput = {
  admin: any;
  providerId: string;
  tier: "BASIS" | "LUXUS" | "ENTERPRISE";
  env?: "test" | "prod";
  request?: RequestOptions;
};

type EnsureProviderVatCodeInput = {
  admin: any;
  providerId: string;
  taxCodeId: string;
  env?: "test" | "prod";
  request?: RequestOptions;
};

type EnsureProductInput = {
  admin: any;
  tier: "BASIS" | "LUXUS" | "ENTERPRISE";
  request?: RequestOptions;
};

type CreateInvoiceLineInput = {
  productId: string;
  quantity: number;
  unit_price: number;
  product_name: string;
  tripletex_vat_code: string | null;
  revenue_account?: string | null;
  currency?: string | null;
};

type CreateInvoiceInput = {
  uniqueRef: string;
  customerId: string;
  productId?: string;
  invoiceLine?: {
    quantity: number;
    unit_price: number;
    product_name: string;
    tripletex_vat_code: string | null;
    revenue_account?: string | null;
    currency?: string | null;
  };
  invoiceLines?: CreateInvoiceLineInput[];
  request?: RequestOptions;
};

const DEFAULT_BASE_URL = "https://tripletex.no/v2";
const DEFAULT_TIMEOUT_MS = 15000;
const DEFAULT_RETRIES = 2;
/** Tripletex action endpoint — not top-level /whoAmI (returns 404). */
const TRIPLETEX_WHO_AM_I_PATH = "/token/session/>whoAmI";
const SESSION_TTL_MS = 6 * 24 * 60 * 60 * 1000;

interface CachedSession {
  auth: TripletexAuth;
  expiresAt: number;
}

const sessionCache = new Map<string, CachedSession>();

function cacheKey(providerId: string | null | undefined, env: string): string {
  return `${providerId ?? "lp"}:${env}`;
}

function resolveDefaultEnv(): "test" | "prod" {
  const appEnv = safeStr(process.env.NEXT_PUBLIC_APP_ENV).toLowerCase();
  if (appEnv === "staging") return "test";
  const vercelEnv = safeStr(process.env.VERCEL_ENV).toLowerCase();
  if (vercelEnv === "production") return "prod";
  return "test";
}

/** Clears in-process session cache (Vitest isolation only). */
export function __clearTripletexSessionCacheForTests(): void {
  sessionCache.clear();
}

function safeStr(value: unknown): string {
  return String(value ?? "").trim();
}

function safeNum(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function asInt(value: unknown, fallback: number): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(1, Math.floor(n));
}

function backoffMs(attempt: number): number {
  const base = 350 * Math.pow(2, attempt);
  const jitter = Math.floor(Math.random() * 150);
  return base + jitter;
}

function normalizePath(path: string): string {
  const p = safeStr(path);
  if (!p) return "/";
  return p.startsWith("/") ? p : `/${p}`;
}

function parseJsonSafe(text: string): AnyJson {
  const raw = safeStr(text);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AnyJson;
  } catch {
    return { raw };
  }
}

function extractValue(raw: AnyJson): AnyJson {
  if (raw && typeof raw === "object" && !Array.isArray(raw) && "value" in raw) {
    return (raw as any).value as AnyJson;
  }
  return raw;
}

function extractMessage(raw: AnyJson): string {
  const r = raw as any;
  const candidates = [r?.message, r?.error, r?.detail, r?.developerMessage, r?.value?.message];
  for (const c of candidates) {
    const s = safeStr(c);
    if (s) return s;
  }
  return "Tripletex request failed";
}

function classifyStatus(status: number): TripletexErrorKind {
  if (status === 401 || status === 403) return "AUTH";
  if (status === 429 || status >= 500) return "TRANSIENT";
  return "PERMANENT";
}

function buildUrl(baseUrl: string, path: string, query?: Record<string, string | number | boolean | null | undefined>): string {
  const url = new URL(`${baseUrl}${normalizePath(path)}`);
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value === null || value === undefined) continue;
    url.searchParams.set(key, String(value));
  }
  return url.toString();
}

function parseId(value: AnyJson): string {
  const v = value as any;
  const candidates = [
    v?.id,
    v?.invoiceId,
    v?.orderId,
    v?.customerId,
    v?.productId,
    Array.isArray(v) && v.length > 0 ? v[0]?.id : null,
  ];
  for (const c of candidates) {
    const s = safeStr(c);
    if (s) return s;
  }
  return "";
}

function loadTripletexNetworkConfig(): Pick<TripletexConfig, "baseUrl" | "timeoutMs" | "retries"> {
  return {
    baseUrl: (safeStr(process.env.TRIPLETEX_BASE_URL) || DEFAULT_BASE_URL).replace(/\/+$/, ""),
    timeoutMs: asInt(process.env.TRIPLETEX_TIMEOUT_MS, DEFAULT_TIMEOUT_MS),
    retries: Math.max(0, asInt(process.env.TRIPLETEX_MAX_RETRIES, DEFAULT_RETRIES)),
  };
}

function loadConfig(): TripletexConfig {
  const network = loadTripletexNetworkConfig();
  const companyId = safeStr(process.env.TRIPLETEX_COMPANY_ID);
  const directToken = safeStr(process.env.TRIPLETEX_TOKEN || process.env.TRIPLETEX_SESSION_TOKEN) || null;
  const consumerToken = safeStr(process.env.TRIPLETEX_CONSUMER_TOKEN) || null;
  const employeeToken = safeStr(process.env.TRIPLETEX_EMPLOYEE_TOKEN) || null;

  if (!companyId) {
    throw new TripletexClientError({
      message: "Tripletex config missing: TRIPLETEX_COMPANY_ID",
      kind: "CONFIG_MISSING",
      code: "TRIPLETEX_CONFIG_MISSING",
    });
  }

  if (!directToken && (!consumerToken || !employeeToken)) {
    throw new TripletexClientError({
      message: "Tripletex config missing: TRIPLETEX_TOKEN or TRIPLETEX_CONSUMER_TOKEN + TRIPLETEX_EMPLOYEE_TOKEN",
      kind: "CONFIG_MISSING",
      code: "TRIPLETEX_CONFIG_MISSING",
    });
  }

  return {
    ...network,
    companyId,
    directToken,
    consumerToken,
    employeeToken,
  };
}

function classifyUnknown(error: unknown): TripletexClientError {
  if (error instanceof TripletexClientError) return error;
  return new TripletexClientError({
    message: safeStr((error as any)?.message ?? error) || "Unknown Tripletex error",
    kind: "TRANSIENT",
    code: "TRIPLETEX_UNKNOWN_ERROR",
    detail: (error as any) ?? null,
  });
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
      cache: "no-store",
    });
  } catch (error: any) {
    if (error?.name === "AbortError") {
      throw new TripletexClientError({
        message: `Tripletex timeout after ${timeoutMs}ms`,
        kind: "TRANSIENT",
        code: "TRIPLETEX_TIMEOUT",
      });
    }

    throw new TripletexClientError({
      message: `Tripletex network error: ${safeStr(error?.message ?? error) || "unknown"}`,
      kind: "TRANSIENT",
      code: "TRIPLETEX_NETWORK_ERROR",
      detail: { message: safeStr(error?.message ?? error) },
    });
  } finally {
    clearTimeout(timer);
  }
}

async function createSessionTokenFromPair(input: {
  baseUrl: string;
  timeoutMs: number;
  consumerToken: string;
  employeeToken: string;
}): Promise<string> {
  const expirationDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const url = buildUrl(input.baseUrl, "/token/session/:create", {
    consumerToken: input.consumerToken,
    employeeToken: input.employeeToken,
    expirationDate,
  });

  const response = await fetchWithTimeout(
    url,
    {
      method: "PUT",
      headers: { accept: "application/json" },
    },
    input.timeoutMs,
  );

  const raw = parseJsonSafe(await response.text());
  if (!response.ok) {
    throw new TripletexClientError({
      message: `Tripletex session create failed: ${extractMessage(raw)}`,
      kind: classifyStatus(response.status),
      code: "TRIPLETEX_SESSION_CREATE_FAILED",
      status: response.status,
      detail: raw,
    });
  }

  const value = extractValue(raw) as any;
  const token = safeStr(value?.token || value?.sessionToken || (raw as any)?.token || (raw as any)?.sessionToken);
  if (!token) {
    throw new TripletexClientError({
      message: "Tripletex session create returned empty token",
      kind: "PERMANENT",
      code: "TRIPLETEX_SESSION_TOKEN_MISSING",
      detail: raw,
    });
  }

  return token;
}

async function createSessionToken(config: TripletexConfig): Promise<string> {
  if (!config.consumerToken || !config.employeeToken) {
    throw new TripletexClientError({
      message: "Tripletex config missing consumer/employee token",
      kind: "CONFIG_MISSING",
      code: "TRIPLETEX_CONFIG_MISSING",
    });
  }

  return createSessionTokenFromPair({
    baseUrl: config.baseUrl,
    timeoutMs: config.timeoutMs,
    consumerToken: config.consumerToken,
    employeeToken: config.employeeToken,
  });
}

async function loadLpCredentials(_env: "test" | "prod"): Promise<TripletexAuth> {
  const config = loadConfig();

  if (config.directToken) {
    return { companyId: config.companyId, token: config.directToken };
  }

  const token = await createSessionToken(config);
  return { companyId: config.companyId, token };
}

type ProviderTripletexCredentialRow = {
  provider_id?: string;
  env?: string;
  company_id_external?: number | string | null;
  consumer_token?: string;
  employee_token?: string;
};

function providerCredentialsNotConfigured(providerId: string, env: "test" | "prod", detail?: AnyJson | null) {
  return new TripletexClientError({
    message: `Provider Tripletex credentials not configured. providerId=${providerId}, env=${env}`,
    kind: "PROVIDER_CREDENTIALS_NOT_CONFIGURED",
    code: "PROVIDER_CREDENTIALS_NOT_CONFIGURED",
    detail: { providerId, env, ...(detail && typeof detail === "object" ? detail : {}) },
  });
}

async function loadProviderCredentials(providerId: string, env: "test" | "prod"): Promise<TripletexAuth> {
  const admin = supabaseAdmin();

  const { data, error } = await (admin as any).rpc("lp_provider_load_tripletex_credentials", {
    p_provider_id: providerId,
    p_env: env,
  });

  if (error) {
    const message = safeStr((error as any)?.message ?? error);
    if (message.includes("PROVIDER_CREDENTIALS_NOT_CONFIGURED")) {
      throw providerCredentialsNotConfigured(providerId, env, error);
    }
    if (message.includes("PROVIDER_CREDENTIALS_ENV_MISMATCH")) {
      throw new TripletexClientError({
        message: `Provider Tripletex credentials env mismatch. providerId=${providerId}, env=${env}`,
        kind: "CONFIG_MISSING",
        code: "PROVIDER_CREDENTIALS_ENV_MISMATCH",
        detail: { providerId, env, error },
      });
    }
    if (message.includes("PROVIDER_CREDENTIALS_DISABLED")) {
      throw new TripletexClientError({
        message: `Provider Tripletex credentials disabled. providerId=${providerId}, env=${env}`,
        kind: "CONFIG_MISSING",
        code: "PROVIDER_CREDENTIALS_DISABLED",
        detail: { providerId, env, error },
      });
    }
    throw new TripletexClientError({
      message: `Provider Tripletex credentials load failed: ${message || "unknown"}`,
      kind: "TRANSIENT",
      code: "PROVIDER_CREDENTIALS_LOAD_FAILED",
      detail: error,
    });
  }

  const row = (data ?? {}) as ProviderTripletexCredentialRow;
  const consumerToken = safeStr(row.consumer_token);
  const employeeToken = safeStr(row.employee_token);
  const companyId = safeStr(row.company_id_external ?? "0") || "0";

  if (!consumerToken || !employeeToken) {
    throw providerCredentialsNotConfigured(providerId, env, row);
  }

  const config = loadTripletexNetworkConfig();
  const token = await createSessionTokenFromPair({
    baseUrl: config.baseUrl,
    timeoutMs: config.timeoutMs,
    consumerToken,
    employeeToken,
  });

  return { companyId, token };
}

export async function resolveTripletexAuth(opts?: TripletexAuthOpts): Promise<TripletexAuth> {
  const tokenOverride = safeStr(opts?.tokenOverride);
  const rawProviderId = opts?.providerId;
  const providerId =
    rawProviderId != null && safeStr(rawProviderId) ? safeStr(rawProviderId) : null;
  const env = opts?.env ?? resolveDefaultEnv();
  const key = cacheKey(providerId, env);

  const cached = sessionCache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.auth;
  }

  if (tokenOverride) {
    const config = loadConfig();
    const auth = { companyId: config.companyId, token: tokenOverride };
    sessionCache.set(key, {
      auth,
      expiresAt: Date.now() + SESSION_TTL_MS,
    });
    return auth;
  }

  const auth = providerId
    ? await loadProviderCredentials(providerId, env)
    : await loadLpCredentials(env);

  sessionCache.set(key, {
    auth,
    expiresAt: Date.now() + SESSION_TTL_MS,
  });

  return auth;
}

export async function requestTripletex(input: RequestInput, options?: RequestOptions): Promise<RequestResult> {
  const network = loadTripletexNetworkConfig();
  const auth = options?.auth ?? (await resolveTripletexAuth());
  const retries = options?.retries ?? network.retries;
  const timeoutMs = options?.timeoutMs ?? network.timeoutMs;
  const authHeader = `Basic ${Buffer.from(`${auth.companyId}:${auth.token}`, "utf8").toString("base64")}`;
  const url = buildUrl(network.baseUrl, input.path, input.query);

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const response = await fetchWithTimeout(
        url,
        {
          method: input.method,
          headers: {
            accept: "application/json",
            authorization: authHeader,
            ...(input.body !== undefined ? { "content-type": "application/json" } : {}),
          },
          body: input.body !== undefined ? JSON.stringify(input.body) : undefined,
        },
        timeoutMs
      );

      const raw = parseJsonSafe(await response.text());
      const value = extractValue(raw);

      if (!response.ok) {
        const kind = classifyStatus(response.status);
        const err = new TripletexClientError({
          message: `Tripletex ${input.method} ${input.path} failed: ${extractMessage(raw)}`,
          kind,
          code: "TRIPLETEX_REQUEST_FAILED",
          status: response.status,
          detail: raw,
        });

        if (kind === "TRANSIENT" && attempt < retries) {
          await sleep(backoffMs(attempt));
          continue;
        }

        throw err;
      }

      return { status: response.status, raw, value };
    } catch (error: unknown) {
      const err = classifyUnknown(error);
      if (err.kind === "TRANSIENT" && attempt < retries) {
        await sleep(backoffMs(attempt));
        continue;
      }
      throw err;
    }
  }

  throw new TripletexClientError({
    message: "Tripletex request retry budget exhausted",
    kind: "TRANSIENT",
    code: "TRIPLETEX_RETRY_EXHAUSTED",
  });
}

function parseVatTypeId(tripletexVatCode: string | null): number {
  const code = safeStr(tripletexVatCode);
  if (!code) {
    throw new TripletexClientError({
      message: "tripletex_vat_code is required",
      kind: "PERMANENT",
      code: "TRIPLETEX_VAT_CODE_MISSING",
    });
  }

  const n = safeNum(code);
  if (!Number.isFinite(n) || n <= 0) {
    throw new TripletexClientError({
      message: "tripletex_vat_code must be a positive numeric id",
      kind: "PERMANENT",
      code: "TRIPLETEX_VAT_CODE_INVALID",
      detail: { tripletex_vat_code: code },
    });
  }

  return Math.floor(n);
}

function maybeAccount(revenueAccount: string | null | undefined): { id: number } | undefined {
  const n = safeNum(revenueAccount);
  if (!Number.isFinite(n) || n <= 0) return undefined;
  return { id: Math.floor(n) };
}

export function classifyTripletexError(error: unknown): TripletexClientError {
  return classifyUnknown(error);
}

export async function ensureCustomer(input: EnsureCustomerInput): Promise<{ customerId: string; created: boolean }> {
  const { admin, company, request } = input;
  const companyId = safeStr(company.id);
  const orgnr = safeStr(company.orgnr);
  const legalName = safeStr(company.legal_name);
  const billingAddress = safeStr(company.billing_address);
  const billingPostcode = safeStr(company.billing_postcode);
  const billingCity = safeStr(company.billing_city);
  const billingCountry = safeStr(company.billing_country);

  if (!companyId || !orgnr || !legalName || !billingAddress || !billingPostcode || !billingCity || !billingCountry) {
    throw new TripletexClientError({
      message: "Company billing profile incomplete",
      kind: "PERMANENT",
      code: "COMPANY_BILLING_FIELDS_MISSING",
    });
  }

  const { data: existing, error: lookupError } = await admin
    .from("tripletex_customers")
    .select("company_id,tripletex_customer_id")
    .eq("company_id", companyId)
    .maybeSingle();

  if (lookupError) {
    throw new TripletexClientError({
      message: `Customer mapping lookup failed: ${safeStr(lookupError?.message ?? lookupError)}`,
      kind: "TRANSIENT",
      code: "TRIPLETEX_CUSTOMER_MAPPING_LOOKUP_FAILED",
      detail: lookupError,
    });
  }

  const mappedId = safeStr((existing as any)?.tripletex_customer_id);
  if (mappedId) return { customerId: mappedId, created: false };

  const customerRes = await requestTripletex(
    {
      method: "POST",
      path: "/customer",
      body: {
        name: legalName,
        organizationNumber: orgnr,
        isPrivateIndividual: false,
        email: safeStr(company.billing_email) || undefined,
        postalAddress: {
          addressLine1: billingAddress,
          postalCode: billingPostcode,
          city: billingCity,
          country: billingCountry,
        },
        ...(company.ehf_enabled && safeStr(company.ehf_endpoint)
          ? { electronicInvoiceAddress: safeStr(company.ehf_endpoint) }
          : {}),
      },
    },
    request
  );

  const customerId = parseId(customerRes.value);
  if (!customerId) {
    throw new TripletexClientError({
      message: "Tripletex customer create returned no id",
      kind: "PERMANENT",
      code: "TRIPLETEX_CUSTOMER_ID_MISSING",
      detail: customerRes.raw,
    });
  }

  const { error: upsertError } = await admin.from("tripletex_customers").upsert(
    {
      company_id: companyId,
      tripletex_customer_id: customerId,
      orgnr,
      legal_name: legalName,
      billing_email: safeStr(company.billing_email) || null,
      billing_address: billingAddress,
      billing_postcode: billingPostcode,
      billing_city: billingCity,
      billing_country: billingCountry,
      ehf_enabled: Boolean(company.ehf_enabled),
      ehf_endpoint: safeStr(company.ehf_endpoint) || null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "company_id" }
  );

  if (upsertError) {
    throw new TripletexClientError({
      message: `Customer mapping upsert failed: ${safeStr(upsertError?.message ?? upsertError)}`,
      kind: "TRANSIENT",
      code: "TRIPLETEX_CUSTOMER_MAPPING_UPSERT_FAILED",
      detail: upsertError,
    });
  }

  return { customerId, created: true };
}

function extractCustomerRows(value: AnyJson): AnyJson[] {
  const v = value as { values?: unknown } | unknown[] | null;
  if (Array.isArray(v)) return v as AnyJson[];
  if (v && typeof v === "object" && Array.isArray((v as { values?: unknown }).values)) {
    return ((v as { values: unknown[] }).values ?? []) as AnyJson[];
  }
  return [];
}

async function findTripletexCustomerIdByOrgnr(orgnr: string, request?: RequestOptions): Promise<string | null> {
  const normalized = safeStr(orgnr);
  if (!normalized) return null;

  const res = await requestTripletex(
    {
      method: "GET",
      path: "/customer",
      query: { organizationNumber: normalized, from: 0, count: 20 },
    },
    request,
  );

  for (const row of extractCustomerRows(res.value)) {
    const id = parseId(row);
    if (id) return id;
  }

  return null;
}

function parseCustomerIdFromConflictDetail(detail: AnyJson | null): string {
  const d = detail as any;
  const candidates = [d?.value?.id, d?.id, d?.customerId, d?.value?.customerId];
  for (const c of candidates) {
    const id = safeStr(c);
    if (id) return id;
  }
  return "";
}

/**
 * Flow A: provider → Customer in Lp's Tripletex account (company_id NULL, provider_id set).
 */
export async function ensureProviderCustomer(
  input: EnsureProviderCustomerInput,
): Promise<{ customerId: string; created: boolean }> {
  const { admin, provider, request } = input;
  const providerId = safeStr(provider.id);
  const orgnr = safeStr(provider.org_number);
  const legalName = safeStr(provider.name);
  const billingEmail = safeStr(provider.contact_email);
  const billingAddress = safeStr(provider.billing_address) || "Ikke oppgitt";
  const billingPostcode = safeStr(provider.billing_postcode) || "0001";
  const billingCity = safeStr(provider.billing_city) || "Oslo";
  const billingCountry = safeStr(provider.billing_country) || "NO";

  if (!providerId || !legalName || !billingEmail) {
    throw new TripletexClientError({
      message: "Provider billing profile incomplete",
      kind: "PERMANENT",
      code: "PROVIDER_BILLING_FIELDS_MISSING",
    });
  }

  if (!orgnr) {
    throw new TripletexClientError({
      message: "Provider org_number is required for Tripletex customer",
      kind: "PERMANENT",
      code: "PROVIDER_ORG_NUMBER_MISSING",
    });
  }

  const { data: existing, error: lookupError } = await admin
    .from("tripletex_customers")
    .select("provider_id,tripletex_customer_id,company_id")
    .eq("provider_id", providerId)
    .is("company_id", null)
    .maybeSingle();

  if (lookupError) {
    throw new TripletexClientError({
      message: `Provider customer mapping lookup failed: ${safeStr(lookupError?.message ?? lookupError)}`,
      kind: "TRANSIENT",
      code: "TRIPLETEX_PROVIDER_MAPPING_LOOKUP_FAILED",
      detail: lookupError,
    });
  }

  const mappedId = safeStr((existing as any)?.tripletex_customer_id);
  if (mappedId) return { customerId: mappedId, created: false };

  let customerId = "";

  try {
    const customerRes = await requestTripletex(
      {
        method: "POST",
        path: "/customer",
        body: {
          name: legalName,
          organizationNumber: orgnr,
          isPrivateIndividual: false,
          email: billingEmail,
          postalAddress: {
            addressLine1: billingAddress,
            postalCode: billingPostcode,
            city: billingCity,
            country: billingCountry,
          },
        },
      },
      request,
    );
    customerId = parseId(customerRes.value);
  } catch (error: unknown) {
    const err = classifyUnknown(error);
    if (err.status === 409) {
      customerId =
        parseCustomerIdFromConflictDetail(err.detail) || (await findTripletexCustomerIdByOrgnr(orgnr, request)) || "";
      if (!customerId) {
        throw new TripletexClientError({
          message: "Tripletex customer conflict (409) but existing id could not be resolved",
          kind: "PERMANENT",
          code: "TRIPLETEX_CUSTOMER_CONFLICT_UNRESOLVED",
          status: 409,
          detail: err.detail,
        });
      }
    } else {
      throw err;
    }
  }

  if (!customerId) {
    throw new TripletexClientError({
      message: "Tripletex provider customer create returned no id",
      kind: "PERMANENT",
      code: "TRIPLETEX_CUSTOMER_ID_MISSING",
    });
  }

  const { error: upsertError } = await admin.from("tripletex_customers").upsert(
    {
      company_id: null,
      provider_id: providerId,
      tripletex_customer_id: customerId,
      orgnr,
      legal_name: legalName,
      billing_email: billingEmail,
      billing_address: billingAddress,
      billing_postcode: billingPostcode,
      billing_city: billingCity,
      billing_country: billingCountry,
      ehf_enabled: false,
      ehf_endpoint: null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "provider_id" },
  );

  if (upsertError) {
    throw new TripletexClientError({
      message: `Provider customer mapping upsert failed: ${safeStr(upsertError?.message ?? upsertError)}`,
      kind: "TRANSIENT",
      code: "TRIPLETEX_PROVIDER_MAPPING_UPSERT_FAILED",
      detail: upsertError,
    });
  }

  return { customerId, created: true };
}

/**
 * Flow B: company → Customer in provider's Tripletex account (company_id + provider_id set).
 */
export async function ensureCompanyCustomer(
  input: EnsureCompanyCustomerInput,
): Promise<{ customerId: string; created: boolean }> {
  const { admin, company, providerId, env = "prod", request } = input;
  const companyId = safeStr(company.id);
  const providerIdSafe = safeStr(providerId);
  const orgnr = safeStr(company.orgnr);
  const legalName = safeStr(company.legal_name);
  const billingAddress = safeStr(company.billing_address);
  const billingPostcode = safeStr(company.billing_postcode);
  const billingCity = safeStr(company.billing_city);
  const billingCountry = safeStr(company.billing_country);

  if (!companyId || !providerIdSafe || !orgnr || !legalName || !billingAddress || !billingPostcode || !billingCity || !billingCountry) {
    throw new TripletexClientError({
      message: "Company billing profile incomplete for provider customer sync",
      kind: "PERMANENT",
      code: "COMPANY_BILLING_FIELDS_MISSING",
    });
  }

  const { data: existing, error: lookupError } = await admin
    .from("tripletex_customers")
    .select("company_id,provider_id,tripletex_customer_id")
    .eq("company_id", companyId)
    .eq("provider_id", providerIdSafe)
    .maybeSingle();

  if (lookupError) {
    throw new TripletexClientError({
      message: `Company provider customer mapping lookup failed: ${safeStr(lookupError?.message ?? lookupError)}`,
      kind: "TRANSIENT",
      code: "TRIPLETEX_COMPANY_PROVIDER_MAPPING_LOOKUP_FAILED",
      detail: lookupError,
    });
  }

  const mappedId = safeStr((existing as any)?.tripletex_customer_id);
  if (mappedId) return { customerId: mappedId, created: false };

  const auth = request?.auth ?? (await resolveTripletexAuth({ providerId: providerIdSafe, env }));
  const requestWithAuth = { ...request, auth };

  let customerId = "";

  try {
    const customerRes = await requestTripletex(
      {
        method: "POST",
        path: "/customer",
        body: {
          name: legalName,
          organizationNumber: orgnr,
          isPrivateIndividual: false,
          email: safeStr(company.billing_email) || undefined,
          postalAddress: {
            addressLine1: billingAddress,
            postalCode: billingPostcode,
            city: billingCity,
            country: billingCountry,
          },
          ...(company.ehf_enabled && safeStr(company.ehf_endpoint)
            ? { electronicInvoiceAddress: safeStr(company.ehf_endpoint) }
            : {}),
        },
      },
      requestWithAuth,
    );
    customerId = parseId(customerRes.value);
  } catch (error: unknown) {
    const err = classifyUnknown(error);
    if (err.status === 409) {
      customerId =
        parseCustomerIdFromConflictDetail(err.detail) ||
        (await findTripletexCustomerIdByOrgnr(orgnr, requestWithAuth)) ||
        "";
      if (!customerId) {
        throw new TripletexClientError({
          message: "Tripletex company customer conflict (409) but existing id could not be resolved",
          kind: "PERMANENT",
          code: "TRIPLETEX_CUSTOMER_CONFLICT_UNRESOLVED",
          status: 409,
          detail: err.detail,
        });
      }
    } else {
      throw err;
    }
  }

  if (!customerId) {
    throw new TripletexClientError({
      message: "Tripletex company provider customer create returned no id",
      kind: "PERMANENT",
      code: "TRIPLETEX_CUSTOMER_ID_MISSING",
    });
  }

  const { error: upsertError } = await admin.from("tripletex_customers").upsert(
    {
      company_id: companyId,
      provider_id: providerIdSafe,
      tripletex_customer_id: customerId,
      orgnr,
      legal_name: legalName,
      billing_email: safeStr(company.billing_email) || null,
      billing_address: billingAddress,
      billing_postcode: billingPostcode,
      billing_city: billingCity,
      billing_country: billingCountry,
      ehf_enabled: Boolean(company.ehf_enabled),
      ehf_endpoint: safeStr(company.ehf_endpoint) || null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "provider_id,company_id" },
  );

  if (upsertError) {
    throw new TripletexClientError({
      message: `Company provider customer mapping upsert failed: ${safeStr(upsertError?.message ?? upsertError)}`,
      kind: "TRANSIENT",
      code: "TRIPLETEX_COMPANY_PROVIDER_MAPPING_UPSERT_FAILED",
      detail: upsertError,
    });
  }

  return { customerId, created: true };
}

function extractVatTypeRows(value: AnyJson): AnyJson[] {
  return extractCustomerRows(value);
}

/**
 * Flow B: resolve VAT type id in provider's Tripletex by local tax code rate.
 */
export async function ensureProviderVatCode(input: EnsureProviderVatCodeInput): Promise<{
  vatTypeId: number;
  vatCode: string;
}> {
  const providerId = safeStr(input.providerId);
  const taxCodeId = safeStr(input.taxCodeId);
  const env = input.env ?? "prod";

  if (!providerId || !taxCodeId) {
    throw new TripletexClientError({
      message: "providerId and taxCodeId are required",
      kind: "PERMANENT",
      code: "PROVIDER_VAT_INPUT_MISSING",
    });
  }

  const { data: taxRow, error: taxError } = await input.admin
    .from("billing_tax_codes")
    .select("id,rate,tripletex_vat_code")
    .eq("id", taxCodeId)
    .maybeSingle();

  if (taxError || !taxRow) {
    throw new TripletexClientError({
      message: "Tax code lookup failed",
      kind: "PERMANENT",
      code: "TAX_CODE_LOOKUP_FAILED",
      detail: taxError ?? null,
    });
  }

  const targetRate = safeNum((taxRow as any).rate);
  const auth = input.request?.auth ?? (await resolveTripletexAuth({ providerId, env }));

  const res = await requestTripletex(
    {
      method: "GET",
      path: "/vatType",
      query: { from: 0, count: 100 },
    },
    { ...input.request, auth },
  );

  for (const row of extractVatTypeRows(res.value)) {
    const id = parseId(row);
    const percentage = safeNum((row as any)?.percentage ?? (row as any)?.rate);
    if (id && Math.abs(percentage - targetRate) < 0.01) {
      return { vatTypeId: parseVatTypeId(id), vatCode: id };
    }
  }

  const fallback = safeStr((taxRow as any).tripletex_vat_code);
  if (fallback) {
    return { vatTypeId: parseVatTypeId(fallback), vatCode: fallback };
  }

  throw new TripletexClientError({
    message: `No Tripletex VAT type found for rate ${targetRate}`,
    kind: "PERMANENT",
    code: "PROVIDER_VAT_TYPE_NOT_FOUND",
    detail: { providerId, taxCodeId, targetRate },
  });
}

/**
 * Flow B: ensure meal-tier product exists in provider's Tripletex + local mapping.
 */
export async function ensureProviderProduct(
  input: EnsureProviderProductInput,
): Promise<{ productId: string; vatCode: string; created: boolean }> {
  const tier = safeStr(input.tier).toUpperCase();
  const providerId = safeStr(input.providerId);
  const env = input.env ?? "prod";

  if (tier !== "BASIS" && tier !== "LUXUS" && tier !== "ENTERPRISE") {
    throw new TripletexClientError({
      message: "Invalid product tier",
      kind: "PERMANENT",
      code: "PRODUCT_TIER_INVALID",
      detail: { tier: input.tier },
    });
  }

  if (!providerId) {
    throw new TripletexClientError({
      message: "providerId is required",
      kind: "PERMANENT",
      code: "PROVIDER_ID_MISSING",
    });
  }

  const { data: existing, error: existingError } = await input.admin
    .from("provider_tripletex_products")
    .select("tripletex_product_id,tripletex_vat_code")
    .eq("provider_id", providerId)
    .eq("tier", tier)
    .eq("env", env)
    .maybeSingle();

  if (existingError) {
    throw new TripletexClientError({
      message: `Provider product mapping lookup failed: ${safeStr(existingError?.message ?? existingError)}`,
      kind: "TRANSIENT",
      code: "PROVIDER_PRODUCT_MAPPING_LOOKUP_FAILED",
      detail: existingError,
    });
  }

  const mappedId = safeStr((existing as any)?.tripletex_product_id);
  const mappedVat = safeStr((existing as any)?.tripletex_vat_code);
  if (mappedId && mappedVat) {
    return { productId: mappedId, vatCode: mappedVat, created: false };
  }

  const { data: productMap, error: productError } = await input.admin
    .from("billing_products")
    .select("tier,product_name,revenue_account,tax_code_id,unit")
    .eq("tier", tier)
    .maybeSingle();

  if (productError || !productMap) {
    throw new TripletexClientError({
      message: "Billing product mapping missing",
      kind: "PERMANENT",
      code: "PRODUCT_MAPPING_MISSING",
      detail: productError ?? null,
    });
  }

  const taxCodeId = safeStr((productMap as any).tax_code_id);
  const auth = input.request?.auth ?? (await resolveTripletexAuth({ providerId, env }));
  const vat = await ensureProviderVatCode({
    admin: input.admin,
    providerId,
    taxCodeId,
    env,
    request: { ...input.request, auth },
  });

  let productId = "";

  try {
    const productRes = await requestTripletex(
      {
        method: "POST",
        path: "/product",
        body: {
          name: safeStr((productMap as any).product_name),
          number: `LP-${providerId.slice(0, 8)}-${tier}`,
          unit: safeStr((productMap as any).unit) || "stk",
          isStockItem: false,
          vatType: { id: vat.vatTypeId },
          ...(maybeAccount((productMap as any).revenue_account)
            ? { account: maybeAccount((productMap as any).revenue_account) }
            : {}),
        },
      },
      { ...input.request, auth },
    );
    productId = parseId(productRes.value);
  } catch (error: unknown) {
    const err = classifyUnknown(error);
    if (err.status === 409) {
      productId = parseId(err.detail) || "";
    } else {
      throw err;
    }
  }

  if (!productId) {
    throw new TripletexClientError({
      message: "Tripletex provider product create returned no id",
      kind: "PERMANENT",
      code: "TRIPLETEX_PRODUCT_ID_MISSING",
    });
  }

  const { error: upsertError } = await input.admin.from("provider_tripletex_products").upsert(
    {
      provider_id: providerId,
      tier,
      env,
      tripletex_product_id: productId,
      tripletex_vat_code: vat.vatCode,
      synced_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "provider_id,tier,env" },
  );

  if (upsertError) {
    throw new TripletexClientError({
      message: `Provider product mapping upsert failed: ${safeStr(upsertError?.message ?? upsertError)}`,
      kind: "TRANSIENT",
      code: "PROVIDER_PRODUCT_MAPPING_UPSERT_FAILED",
      detail: upsertError,
    });
  }

  return { productId, vatCode: vat.vatCode, created: true };
}

export async function ensureProduct(input: EnsureProductInput): Promise<{ productId: string; created: boolean }> {
  const tier = safeStr(input.tier).toUpperCase();
  if (tier !== "BASIS" && tier !== "LUXUS" && tier !== "ENTERPRISE") {
    throw new TripletexClientError({
      message: "Invalid product tier",
      kind: "PERMANENT",
      code: "PRODUCT_TIER_INVALID",
      detail: { tier: input.tier },
    });
  }

  const { data: productMap, error: productError } = await input.admin
    .from("billing_products")
    .select("tier,product_name,tripletex_product_id,revenue_account,tax_code_id,unit")
    .eq("tier", tier)
    .maybeSingle();

  if (productError || !productMap) {
    throw new TripletexClientError({
      message: "Billing product mapping missing",
      kind: "PERMANENT",
      code: "PRODUCT_MAPPING_MISSING",
      detail: productError ?? null,
    });
  }

  const mappedId = safeStr((productMap as any).tripletex_product_id);
  if (mappedId) return { productId: mappedId, created: false };

  const taxCodeId = safeStr((productMap as any).tax_code_id);
  if (!taxCodeId) {
    throw new TripletexClientError({
      message: "Tax code missing on billing product",
      kind: "PERMANENT",
      code: "TAX_CODE_MISSING",
    });
  }

  const { data: taxCode, error: taxError } = await input.admin
    .from("billing_tax_codes")
    .select("id,tripletex_vat_code")
    .eq("id", taxCodeId)
    .maybeSingle();

  if (taxError || !taxCode) {
    throw new TripletexClientError({
      message: "Tax code lookup failed",
      kind: "PERMANENT",
      code: "TAX_CODE_LOOKUP_FAILED",
      detail: taxError ?? null,
    });
  }

  const vatTypeId = parseVatTypeId(safeStr((taxCode as any).tripletex_vat_code));
  const productRes = await requestTripletex(
    {
      method: "POST",
      path: "/product",
      body: {
        name: safeStr((productMap as any).product_name),
        number: `LP-${tier}`,
        unit: safeStr((productMap as any).unit) || "stk",
        isStockItem: false,
        vatType: { id: vatTypeId },
        ...(maybeAccount((productMap as any).revenue_account)
          ? { account: maybeAccount((productMap as any).revenue_account) }
          : {}),
      },
    },
    input.request
  );

  const productId = parseId(productRes.value);
  if (!productId) {
    throw new TripletexClientError({
      message: "Tripletex product create returned no id",
      kind: "PERMANENT",
      code: "TRIPLETEX_PRODUCT_ID_MISSING",
      detail: productRes.raw,
    });
  }

  const { error: updateError } = await input.admin
    .from("billing_products")
    .update({ tripletex_product_id: productId, updated_at: new Date().toISOString() })
    .eq("tier", tier);

  if (updateError) {
    throw new TripletexClientError({
      message: `Product mapping update failed: ${safeStr(updateError?.message ?? updateError)}`,
      kind: "TRANSIENT",
      code: "TRIPLETEX_PRODUCT_MAPPING_UPDATE_FAILED",
      detail: updateError,
    });
  }

  return { productId, created: true };
}

export async function createInvoice(input: CreateInvoiceInput): Promise<{ externalId: string; raw: AnyJson }> {
  const uniqueRef = safeStr(input.uniqueRef);
  const customerId = safeStr(input.customerId);

  const normalizedLines: Array<{
    productId: string;
    quantity: number;
    unitPrice: number;
    productName: string;
    vatTypeId: number;
    revenueAccount: string | null;
    currency: string;
  }> = [];

  const invoiceLines = Array.isArray(input.invoiceLines) ? input.invoiceLines : [];
  for (const line of invoiceLines) {
    const productId = safeStr(line?.productId);
    const quantity = Math.floor(safeNum(line?.quantity));
    const unitPrice = safeNum(line?.unit_price);
    const productName = safeStr(line?.product_name);
    const currency = safeStr(line?.currency) || "NOK";
    const vatTypeId = parseVatTypeId(line?.tripletex_vat_code ?? null);

    if (!productId || quantity <= 0 || unitPrice <= 0) {
      throw new TripletexClientError({
        message: "Invalid invoice line",
        kind: "PERMANENT",
        code: "INVOICE_LINE_INVALID",
      });
    }

    normalizedLines.push({
      productId,
      quantity,
      unitPrice,
      productName,
      vatTypeId,
      revenueAccount: safeStr(line?.revenue_account) || null,
      currency,
    });
  }

  if (normalizedLines.length === 0 && input.invoiceLine) {
    const productId = safeStr(input.productId);
    const quantity = Math.floor(safeNum(input.invoiceLine.quantity));
    const unitPrice = safeNum(input.invoiceLine.unit_price);
    const productName = safeStr(input.invoiceLine.product_name);
    const currency = safeStr(input.invoiceLine.currency) || "NOK";
    const vatTypeId = parseVatTypeId(input.invoiceLine.tripletex_vat_code);

    if (!productId || quantity <= 0 || unitPrice <= 0) {
      throw new TripletexClientError({
        message: "Invalid invoice line",
        kind: "PERMANENT",
        code: "INVOICE_LINE_INVALID",
      });
    }

    normalizedLines.push({
      productId,
      quantity,
      unitPrice,
      productName,
      vatTypeId,
      revenueAccount: safeStr(input.invoiceLine.revenue_account) || null,
      currency,
    });
  }

  if (!uniqueRef) {
    throw new TripletexClientError({
      message: "uniqueRef is required",
      kind: "PERMANENT",
      code: "UNIQUE_REF_MISSING",
    });
  }
  if (!customerId) {
    throw new TripletexClientError({
      message: "customerId is required",
      kind: "PERMANENT",
      code: "TRIPLETEX_RELATION_MISSING",
    });
  }
  if (normalizedLines.length === 0) {
    throw new TripletexClientError({
      message: "At least one invoice line is required",
      kind: "PERMANENT",
      code: "INVOICE_LINE_INVALID",
    });
  }

  const currency = normalizedLines[0]?.currency || "NOK";
  const orderLines = normalizedLines.map((line) => {
    const orderLine: Record<string, unknown> = {
      product: { id: line.productId },
      description: line.productName || "Invoice line",
      count: line.quantity,
      unitPriceExcludingVatCurrency: line.unitPrice,
      vatType: { id: line.vatTypeId },
    };

    const account = maybeAccount(line.revenueAccount);
    if (account) orderLine.account = account;
    return orderLine;
  });

  const orderRes = await requestTripletex(
    {
      method: "POST",
      path: "/order",
      body: {
        customer: { id: customerId },
        orderDate: new Date().toISOString().slice(0, 10),
        currency,
        ourReference: uniqueRef,
        yourReference: uniqueRef,
        orderLines,
      },
    },
    input.request
  );

  const orderId = parseId(orderRes.value);
  if (!orderId) {
    throw new TripletexClientError({
      message: "Tripletex order create returned no id",
      kind: "PERMANENT",
      code: "TRIPLETEX_ORDER_ID_MISSING",
      detail: orderRes.raw,
    });
  }

  const invoiceRes = await requestTripletex(
    {
      method: "PUT",
      path: `/order/${encodeURIComponent(orderId)}/:invoice`,
      query: { sendToCustomer: false },
    },
    input.request
  );

  const invoiceId = parseId(invoiceRes.value) || orderId;
  return {
    externalId: safeStr(invoiceId),
    raw: {
      order: orderRes.raw,
      invoice: invoiceRes.raw,
    },
  };
}

export type TripletexInvoicePaymentStatus = {
  tripletexId: string;
  isPaid: boolean;
  amountOutstanding: number | null;
  source: "invoice" | "order";
  raw: AnyJson;
};

function parseAmountOutstanding(value: unknown): number | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  const direct = row.amountOutstanding ?? row.amount_outstanding;
  if (direct != null && Number.isFinite(Number(direct))) return Number(direct);
  const invoice = row.invoice;
  if (invoice && typeof invoice === "object") {
    const nested = (invoice as Record<string, unknown>).amountOutstanding;
    if (nested != null && Number.isFinite(Number(nested))) return Number(nested);
  }
  return null;
}

/** Re-verify invoice paid state via Tripletex API (defense in depth). */
export async function getTripletexInvoicePaymentStatus(
  tripletexId: string,
  options: { auth: TripletexAuth; retries?: number },
): Promise<TripletexInvoicePaymentStatus> {
  const id = safeStr(tripletexId);
  if (!id) {
    throw new TripletexClientError({
      message: "tripletexId is required",
      kind: "PERMANENT",
      code: "TRIPLETEX_ID_MISSING",
    });
  }

  const reqOpts: RequestOptions = { auth: options.auth, retries: options.retries };

  try {
    const invoiceRes = await requestTripletex(
      { method: "GET", path: `/invoice/${encodeURIComponent(id)}` },
      reqOpts,
    );
    const outstanding = parseAmountOutstanding(invoiceRes.value);
    return {
      tripletexId: id,
      isPaid: outstanding != null ? outstanding <= 0 : false,
      amountOutstanding: outstanding,
      source: "invoice",
      raw: invoiceRes.raw,
    };
  } catch (e) {
    const notFound =
      e instanceof TripletexClientError && (e.status === 404 || e.code === "TRIPLETEX_NOT_FOUND");
    if (!notFound) throw e;
  }

  const orderRes = await requestTripletex(
    { method: "GET", path: `/order/${encodeURIComponent(id)}` },
    reqOpts,
  );
  const outstanding = parseAmountOutstanding(orderRes.value);
  return {
    tripletexId: id,
    isPaid: outstanding != null ? outstanding <= 0 : false,
    amountOutstanding: outstanding,
    source: "order",
    raw: orderRes.raw,
  };
}

/** TPT-B-7 — Build session auth from raw consumer + employee tokens + Tripletex company id. */
export async function createTripletexAuthFromTokens(input: {
  tripletexCompanyId: string | number;
  consumerToken: string;
  employeeToken: string;
}): Promise<TripletexAuth> {
  const companyId = safeStr(input.tripletexCompanyId);
  const consumerToken = safeStr(input.consumerToken);
  const employeeToken = safeStr(input.employeeToken);

  if (!companyId || !consumerToken || !employeeToken) {
    throw new TripletexClientError({
      message: "tripletexCompanyId, consumerToken and employeeToken are required",
      kind: "PERMANENT",
      code: "TRIPLETEX_AUTH_INPUT_MISSING",
    });
  }

  const config = loadTripletexNetworkConfig();
  const token = await createSessionTokenFromPair({
    baseUrl: config.baseUrl,
    timeoutMs: config.timeoutMs,
    consumerToken,
    employeeToken,
  });

  return { companyId, token };
}

export type TripletexWhoAmIResult = {
  companyId: number;
  companyName: string | null;
};

/** TPT-B-7 — GET /token/session/>whoAmI for token verification and daily health checks. */
export async function tripletexWhoAmI(options?: RequestOptions): Promise<TripletexWhoAmIResult> {
  const baseAuth = options?.auth ?? (await resolveTripletexAuth());
  // Tripletex docs: whoAmI requires username "0" (not companyId).
  // https://developer.tripletex.no/docs/documentation/authentication-and-tokens/
  const whoAmIAuth: TripletexAuth = { companyId: "0", token: baseAuth.token };
  const res = await requestTripletex(
    { method: "GET", path: TRIPLETEX_WHO_AM_I_PATH },
    { ...options, auth: whoAmIAuth },
  );
  const value = res.value as any;
  const companyId = safeNum(value?.companyId ?? value?.company?.id ?? value?.company?.companyId);
  const companyName = safeStr(value?.companyName ?? value?.company?.name ?? value?.company?.displayName) || null;

  if (!companyId) {
    throw new TripletexClientError({
      message: "Tripletex whoAmI returned no companyId",
      kind: "PERMANENT",
      code: "TRIPLETEX_WHOAMI_INVALID",
      detail: res.raw,
    });
  }

  return { companyId, companyName };
}

/** TPT-B-7 — Scope check via GET /product?count=1. */
export async function tripletexVerifyProductAccess(
  options?: RequestOptions,
): Promise<{
  ok: boolean;
  error: string | null;
  status: number | null;
  developerMessage: string | null;
}> {
  try {
    await requestTripletex(
      { method: "GET", path: "/product", query: { from: 0, count: 1 } },
      options,
    );
    return { ok: true, error: null, status: 200, developerMessage: null };
  } catch (error: unknown) {
    if (error instanceof TripletexClientError) {
      const detail = error.detail as Record<string, unknown> | null;
      const developerMessage = detail ? safeStr(detail.developerMessage) || null : null;
      return { ok: false, error: error.message, status: error.status, developerMessage };
    }
    return {
      ok: false,
      error: safeStr((error as Error)?.message ?? error),
      status: null,
      developerMessage: null,
    };
  }
}

