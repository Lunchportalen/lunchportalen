import "server-only";

export type TripletexErrorKind = "CONFIG" | "AUTH" | "TRANSIENT" | "PERMANENT";

export class TripletexError extends Error {
  kind: TripletexErrorKind;
  code: string;
  status: number | null;
  detail: unknown;

  constructor(input: {
    message: string;
    kind: TripletexErrorKind;
    code: string;
    status?: number | null;
    detail?: unknown;
  }) {
    super(input.message);
    this.name = "TripletexError";
    this.kind = input.kind;
    this.code = input.code;
    this.status = input.status ?? null;
    this.detail = input.detail;
  }
}

type TripletexConfig = {
  baseUrl: string;
  companyId: string;
  sessionToken: string | null;
  consumerToken: string | null;
  employeeToken: string | null;
};

type TripletexRequestOptions = {
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  path: string;
  query?: Record<string, string | number | boolean | null | undefined>;
  body?: unknown;
};

export type TripletexCustomerInput = {
  orgnr: string;
  legalName: string;
  billingEmail: string | null;
  billingAddress: string;
  billingPostcode: string;
  billingCity: string;
  billingCountry: string;
  ehfEnabled: boolean;
  ehfEndpoint: string | null;
};

export type TripletexProductInput = {
  tier: "BASIS" | "LUXUS";
  productName: string;
  unit: string;
  revenueAccount: string | null;
  tripletexVatCode: string;
};

export type TripletexInvoiceInput = {
  reference: string;
  customerId: string;
  productId: string;
  quantity: number;
  unitPrice: number;
  productName: string;
  tripletexVatCode: string;
  revenueAccount: string | null;
  currency: string;
};

export type TripletexInvoiceLineInput = {
  tier: "BASIS" | "LUXUS";
  productId: string;
  quantity: number;
  unitPrice: number;
  productName: string;
  tripletexVatCode: string;
  revenueAccount: string | null;
  currency?: string | null;
};

export type TripletexCreateInvoiceInput = {
  company: {
    customerId: string;
    currency?: string | null;
  };
  lines: TripletexInvoiceLineInput[];
  uniqueRef: string;
};

type TripletexRequestResult = {
  status: number;
  raw: any;
  value: any;
};

let cachedSessionToken: { token: string; expiresAtMs: number } | null = null;

function safeStr(v: unknown): string {
  return String(v ?? "").trim();
}

function safeNum(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function parseJsonSafe(text: string): any {
  const raw = safeStr(text);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return { raw };
  }
}

function configFromEnv(): TripletexConfig {
  const baseUrl = (safeStr(process.env.TRIPLETEX_BASE_URL) || "https://tripletex.no/v2").replace(/\/+$/, "");
  const companyId = safeStr(process.env.TRIPLETEX_COMPANY_ID) || "0";

  const sessionToken = safeStr(process.env.TRIPLETEX_SESSION_TOKEN) || null;
  const consumerToken = safeStr(process.env.TRIPLETEX_CONSUMER_TOKEN) || null;
  const employeeToken = safeStr(process.env.TRIPLETEX_EMPLOYEE_TOKEN) || null;

  return {
    baseUrl,
    companyId,
    sessionToken,
    consumerToken,
    employeeToken,
  };
}

function normalizePath(path: string): string {
  const p = safeStr(path);
  if (!p) return "/";
  return p.startsWith("/") ? p : `/${p}`;
}

function buildUrl(baseUrl: string, path: string, query?: Record<string, string | number | boolean | null | undefined>): string {
  const url = new URL(`${baseUrl}${normalizePath(path)}`);
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value === null || value === undefined) continue;
    url.searchParams.set(key, String(value));
  }
  return url.toString();
}

function extractErrorMessage(raw: any): string {
  const candidates = [
    raw?.message,
    raw?.error,
    raw?.detail,
    raw?.value?.message,
    raw?.value?.error,
    raw?.developerMessage,
  ];
  for (const item of candidates) {
    const value = safeStr(item);
    if (value) return value;
  }
  return "Tripletex request failed";
}

function extractValue(raw: any): any {
  if (raw && typeof raw === "object" && "value" in raw) {
    return (raw as any).value;
  }
  return raw;
}

function extractId(value: any): string {
  const candidates = [
    value?.id,
    value?.invoiceId,
    value?.orderId,
    value?.customerId,
    value?.productId,
    Array.isArray(value) && value.length > 0 ? value[0]?.id : null,
  ];
  for (const item of candidates) {
    const id = safeStr(item);
    if (id) return id;
  }
  return "";
}

async function createSessionToken(config: TripletexConfig): Promise<string> {
  const consumerToken = safeStr(config.consumerToken);
  const employeeToken = safeStr(config.employeeToken);
  if (!consumerToken || !employeeToken) {
    throw new TripletexError({
      message: "Tripletex auth missing: TRIPLETEX_SESSION_TOKEN or TRIPLETEX_CONSUMER_TOKEN + TRIPLETEX_EMPLOYEE_TOKEN",
      kind: "CONFIG",
      code: "TRIPLETEX_AUTH_CONFIG_MISSING",
    });
  }

  const now = Date.now();
  if (cachedSessionToken && cachedSessionToken.expiresAtMs > now + 60_000) {
    return cachedSessionToken.token;
  }

  const expirationDate = new Date(now + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const url = buildUrl(config.baseUrl, "/token/session/:create", {
    consumerToken,
    employeeToken,
    expirationDate,
  });

  let response: Response;
  try {
    response = await fetch(url, {
      method: "PUT",
      headers: {
        accept: "application/json",
      },
      cache: "no-store",
    });
  } catch (error: any) {
    throw new TripletexError({
      message: `Tripletex session create failed: ${safeStr(error?.message ?? error) || "network_error"}`,
      kind: "TRANSIENT",
      code: "TRIPLETEX_SESSION_CREATE_NETWORK_FAILED",
      detail: { message: safeStr(error?.message ?? error) },
    });
  }

  const raw = parseJsonSafe(await response.text());
  if (!response.ok) {
    const message = extractErrorMessage(raw);
    const kind: TripletexErrorKind = response.status === 401 || response.status === 403 ? "AUTH" : response.status >= 500 ? "TRANSIENT" : "PERMANENT";

    throw new TripletexError({
      message: `Tripletex session create failed: ${message}`,
      kind,
      code: "TRIPLETEX_SESSION_CREATE_FAILED",
      status: response.status,
      detail: raw,
    });
  }

  const value = extractValue(raw);
  const token = safeStr(value?.token || value?.sessionToken || raw?.token || raw?.sessionToken);
  if (!token) {
    throw new TripletexError({
      message: "Tripletex session create returned empty token",
      kind: "PERMANENT",
      code: "TRIPLETEX_SESSION_TOKEN_MISSING",
      detail: raw,
    });
  }

  cachedSessionToken = {
    token,
    expiresAtMs: now + 23 * 60 * 60 * 1000,
  };
  return token;
}

async function getSessionToken(config: TripletexConfig): Promise<string> {
  const explicit = safeStr(config.sessionToken);
  if (explicit) return explicit;
  return createSessionToken(config);
}

async function requestTripletex(input: TripletexRequestOptions): Promise<TripletexRequestResult> {
  const config = configFromEnv();
  const sessionToken = await getSessionToken(config);

  const url = buildUrl(config.baseUrl, input.path, input.query);
  const authRaw = `${config.companyId}:${sessionToken}`;
  const auth = `Basic ${Buffer.from(authRaw, "utf8").toString("base64")}`;

  let response: Response;
  try {
    response = await fetch(url, {
      method: input.method,
      headers: {
        accept: "application/json",
        authorization: auth,
        ...(input.body !== undefined ? { "content-type": "application/json" } : {}),
      },
      body: input.body !== undefined ? JSON.stringify(input.body) : undefined,
      cache: "no-store",
    });
  } catch (error: any) {
    throw new TripletexError({
      message: `Tripletex request failed: ${safeStr(error?.message ?? error) || "network_error"}`,
      kind: "TRANSIENT",
      code: "TRIPLETEX_REQUEST_NETWORK_FAILED",
      detail: { message: safeStr(error?.message ?? error), path: input.path },
    });
  }

  const raw = parseJsonSafe(await response.text());
  const value = extractValue(raw);

  if (!response.ok) {
    const message = extractErrorMessage(raw);
    const status = response.status;

    let kind: TripletexErrorKind = "PERMANENT";
    if (status === 401 || status === 403) kind = "AUTH";
    else if (status === 429 || status >= 500) kind = "TRANSIENT";

    throw new TripletexError({
      message: `Tripletex ${input.method} ${input.path} failed: ${message}`,
      kind,
      code: "TRIPLETEX_REQUEST_FAILED",
      status,
      detail: raw,
    });
  }

  return {
    status: response.status,
    raw,
    value,
  };
}

function asOptionalAccount(revenueAccount: string | null): { id: number } | undefined {
  const num = safeNum(revenueAccount);
  if (!Number.isFinite(num) || num <= 0) return undefined;
  return { id: Math.floor(num) };
}

function asRequiredVatTypeId(tripletexVatCode: string): number {
  const vatTypeId = safeNum(tripletexVatCode);
  if (!Number.isFinite(vatTypeId) || vatTypeId <= 0) {
    throw new TripletexError({
      message: "tripletex_vat_code must be a positive numeric vatType id",
      kind: "PERMANENT",
      code: "TRIPLETEX_VAT_CODE_INVALID",
      detail: { tripletexVatCode },
    });
  }
  return Math.floor(vatTypeId);
}

export function classifyTripletexError(error: unknown): TripletexError {
  if (error instanceof TripletexError) return error;
  return new TripletexError({
    message: safeStr((error as any)?.message ?? error) || "Unknown Tripletex error",
    kind: "TRANSIENT",
    code: "TRIPLETEX_UNKNOWN_ERROR",
    detail: error,
  });
}

export async function createTripletexCustomer(input: TripletexCustomerInput): Promise<{ customerId: string; raw: any }> {
  const body: Record<string, unknown> = {
    name: input.legalName,
    organizationNumber: input.orgnr,
    email: input.billingEmail || undefined,
    isPrivateIndividual: false,
    postalAddress: {
      addressLine1: input.billingAddress,
      postalCode: input.billingPostcode,
      city: input.billingCity,
      country: safeStr(input.billingCountry) || "NO",
    },
  };

  if (input.ehfEnabled && safeStr(input.ehfEndpoint)) {
    body.electronicInvoiceAddress = input.ehfEndpoint;
  }

  const res = await requestTripletex({
    method: "POST",
    path: "/customer",
    body,
  });

  const customerId = extractId(res.value);
  if (!customerId) {
    throw new TripletexError({
      message: "Tripletex customer create succeeded but no customer id was returned",
      kind: "PERMANENT",
      code: "TRIPLETEX_CUSTOMER_ID_MISSING",
      detail: res.raw,
    });
  }

  return { customerId, raw: res.raw };
}

export async function createTripletexProduct(input: TripletexProductInput): Promise<{ productId: string; raw: any }> {
  const vatTypeId = asRequiredVatTypeId(input.tripletexVatCode);

  const body: Record<string, unknown> = {
    name: input.productName,
    number: `LP-${input.tier}`,
    unit: safeStr(input.unit) || "stk",
    isStockItem: false,
    vatType: { id: vatTypeId },
  };

  const account = asOptionalAccount(input.revenueAccount);
  if (account) body.account = account;

  const res = await requestTripletex({
    method: "POST",
    path: "/product",
    body,
  });

  const productId = extractId(res.value);
  if (!productId) {
    throw new TripletexError({
      message: "Tripletex product create succeeded but no product id was returned",
      kind: "PERMANENT",
      code: "TRIPLETEX_PRODUCT_ID_MISSING",
      detail: res.raw,
    });
  }

  return { productId, raw: res.raw };
}

export async function createTripletexInvoice(input: TripletexInvoiceInput): Promise<{ externalId: string; raw: any }> {
  return createInvoice({
    company: {
      customerId: input.customerId,
      currency: input.currency,
    },
    lines: [
      {
        tier: "BASIS",
        productId: input.productId,
        quantity: input.quantity,
        unitPrice: input.unitPrice,
        productName: input.productName,
        tripletexVatCode: input.tripletexVatCode,
        revenueAccount: input.revenueAccount,
        currency: input.currency,
      },
    ],
    uniqueRef: input.reference,
  });
}

export async function createInvoice(input: TripletexCreateInvoiceInput): Promise<{ externalId: string; raw: any }> {
  const uniqueRef = safeStr(input.uniqueRef);
  const customerId = safeStr(input.company?.customerId);
  const currency = safeStr(input.company?.currency) || "NOK";

  if (!uniqueRef) {
    throw new TripletexError({
      message: "uniqueRef er påkrevd",
      kind: "PERMANENT",
      code: "UNIQUE_REF_MISSING",
    });
  }

  if (!customerId) {
    throw new TripletexError({
      message: "customerId er påkrevd",
      kind: "PERMANENT",
      code: "CUSTOMER_ID_MISSING",
    });
  }

  if (!Array.isArray(input.lines) || input.lines.length === 0) {
    throw new TripletexError({
      message: "Minst én fakturalinje er påkrevd",
      kind: "PERMANENT",
      code: "INVOICE_LINES_MISSING",
    });
  }

  const orderLines = input.lines.map((line) => {
    const productId = safeStr(line.productId);
    const productName = safeStr(line.productName);
    const quantity = Math.floor(safeNum(line.quantity));
    const unitPrice = safeNum(line.unitPrice);
    const vatTypeId = asRequiredVatTypeId(line.tripletexVatCode);

    if (!productId || quantity <= 0 || unitPrice <= 0) {
      throw new TripletexError({
        message: "Ugyldig fakturalinje",
        kind: "PERMANENT",
        code: "INVOICE_LINE_INVALID",
        detail: { tier: safeStr(line.tier), quantity, unitPrice, productId },
      });
    }

    const orderLine: Record<string, unknown> = {
      product: { id: productId },
      description: productName || `Lunchportalen ${safeStr(line.tier)}`,
      count: quantity,
      unitPriceExcludingVatCurrency: unitPrice,
      vatType: { id: vatTypeId },
    };

    const account = asOptionalAccount(line.revenueAccount);
    if (account) orderLine.account = account;
    return orderLine;
  });

  const orderRes = await requestTripletex({
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
  });

  const orderId = extractId(orderRes.value);
  if (!orderId) {
    throw new TripletexError({
      message: "Tripletex order create succeeded but no order id was returned",
      kind: "PERMANENT",
      code: "TRIPLETEX_ORDER_ID_MISSING",
      detail: orderRes.raw,
    });
  }

  const invoiceRes = await requestTripletex({
    method: "PUT",
    path: `/order/${encodeURIComponent(orderId)}/:invoice`,
    query: { sendToCustomer: false },
  });

  const invoiceId = extractId(invoiceRes.value) || orderId;
  return {
    externalId: safeStr(invoiceId),
    raw: {
      order: orderRes.raw,
      invoice: invoiceRes.raw,
    },
  };
}


