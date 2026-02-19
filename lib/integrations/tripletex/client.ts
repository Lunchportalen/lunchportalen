import "server-only";

type AnyJson = Record<string, unknown> | unknown[] | string | number | boolean | null;

export type TripletexErrorKind = "CONFIG_MISSING" | "AUTH" | "TRANSIENT" | "PERMANENT";

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

type EnsureProductInput = {
  admin: any;
  tier: "BASIS" | "LUXUS";
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

function loadConfig(): TripletexConfig {
  const baseUrl = (safeStr(process.env.TRIPLETEX_BASE_URL) || DEFAULT_BASE_URL).replace(/\/+$/, "");
  const companyId = safeStr(process.env.TRIPLETEX_COMPANY_ID);
  const directToken = safeStr(process.env.TRIPLETEX_TOKEN || process.env.TRIPLETEX_SESSION_TOKEN) || null;
  const consumerToken = safeStr(process.env.TRIPLETEX_CONSUMER_TOKEN) || null;
  const employeeToken = safeStr(process.env.TRIPLETEX_EMPLOYEE_TOKEN) || null;
  const timeoutMs = asInt(process.env.TRIPLETEX_TIMEOUT_MS, DEFAULT_TIMEOUT_MS);
  const retries = Math.max(0, asInt(process.env.TRIPLETEX_MAX_RETRIES, DEFAULT_RETRIES));

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
    baseUrl,
    companyId,
    directToken,
    consumerToken,
    employeeToken,
    timeoutMs,
    retries,
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

async function createSessionToken(config: TripletexConfig): Promise<string> {
  if (!config.consumerToken || !config.employeeToken) {
    throw new TripletexClientError({
      message: "Tripletex config missing consumer/employee token",
      kind: "CONFIG_MISSING",
      code: "TRIPLETEX_CONFIG_MISSING",
    });
  }

  const expirationDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const url = buildUrl(config.baseUrl, "/token/session/:create", {
    consumerToken: config.consumerToken,
    employeeToken: config.employeeToken,
    expirationDate,
  });

  const response = await fetchWithTimeout(
    url,
    {
      method: "PUT",
      headers: { accept: "application/json" },
    },
    config.timeoutMs
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

export async function resolveTripletexAuth(options?: { tokenOverride?: string }): Promise<TripletexAuth> {
  const config = loadConfig();
  const tokenOverride = safeStr(options?.tokenOverride);

  if (tokenOverride) {
    return { companyId: config.companyId, token: tokenOverride };
  }

  if (config.directToken) {
    return { companyId: config.companyId, token: config.directToken };
  }

  const token = await createSessionToken(config);
  return { companyId: config.companyId, token };
}

export async function requestTripletex(input: RequestInput, options?: RequestOptions): Promise<RequestResult> {
  const config = loadConfig();
  const auth = options?.auth ?? (await resolveTripletexAuth());
  const retries = options?.retries ?? config.retries;
  const timeoutMs = options?.timeoutMs ?? config.timeoutMs;
  const authHeader = `Basic ${Buffer.from(`${auth.companyId}:${auth.token}`, "utf8").toString("base64")}`;
  const url = buildUrl(config.baseUrl, input.path, input.query);

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

export async function ensureProduct(input: EnsureProductInput): Promise<{ productId: string; created: boolean }> {
  const tier = safeStr(input.tier).toUpperCase();
  if (tier !== "BASIS" && tier !== "LUXUS") {
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


