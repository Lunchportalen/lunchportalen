/**
 * Attribution session/cookie — isomorphic parse/serialize.
 * Browser write: {@link storeAttribution}, AttributionCapture, getOrderAttributionForApi().
 */

import { AI_SOCIAL_ATTRIBUTION_SOURCE, type OrderAttributionRecord } from "@/lib/revenue/types";

export const ORDER_ATTRIBUTION_STORAGE_KEY = "lp_order_attr_v1";
export const ORDER_ATTRIBUTION_COOKIE_NAME = "lp_order_attr";

const POST_ID_RE = /^[a-zA-Z0-9_.:-]{1,128}$/;
const PRODUCT_ID_RE = /^[a-zA-Z0-9_.:-]{0,128}$/;

function safeStr(v: unknown): string {
  return String(v ?? "").trim();
}

function safeOptAttrId(v: unknown): string | undefined {
  const s = safeStr(v);
  return POST_ID_RE.test(s) ? s : undefined;
}

export type StoredOrderAttribution = OrderAttributionRecord & {
  postId: string;
  source: typeof AI_SOCIAL_ATTRIBUTION_SOURCE;
};

export function parseLandingAttributionFromSearchParams(
  searchParams: URLSearchParams | Record<string, string | string[] | undefined>,
): StoredOrderAttribution | null {
  const get = (k: string): string | null => {
    if (searchParams instanceof URLSearchParams) {
      const v = searchParams.get(k);
      return v && v.trim() ? v.trim() : null;
    }
    const raw = searchParams[k];
    if (Array.isArray(raw)) return raw[0] && String(raw[0]).trim() ? String(raw[0]).trim() : null;
    return raw && String(raw).trim() ? String(raw).trim() : null;
  };

  const src = get("src");
  const postIdRaw = get("postId") ?? get("post_id");
  const postId = postIdRaw;
  if (src !== AI_SOCIAL_ATTRIBUTION_SOURCE || !postId || !POST_ID_RE.test(postId)) {
    return null;
  }
  const productRaw = get("productId");
  const productId = productRaw && PRODUCT_ID_RE.test(productRaw) ? productRaw : undefined;
  return { postId, source: AI_SOCIAL_ATTRIBUTION_SOURCE, productId, capturedAt: Date.now() };
}

/**
 * Klient: lagre gyldig AI-attributjon (sessionStorage + cookie, SameSite=Lax).
 * Server: ingen effekt (returnerer false). Skal aldri kaste.
 */
export function storeAttribution(data: StoredOrderAttribution | null | undefined): boolean {
  if (typeof window === "undefined" || !data) return false;
  try {
    const json = serializeAttribution(data);
    if (!json) return false;
    try {
      window.sessionStorage.setItem(ORDER_ATTRIBUTION_STORAGE_KEY, json);
    } catch {
      /* ignore quota */
    }
    const maxAge = 60 * 60 * 24 * 7;
    document.cookie = `${ORDER_ATTRIBUTION_COOKIE_NAME}=${encodeURIComponent(json)}; path=/; max-age=${maxAge}; samesite=lax`;
    return true;
  } catch {
    return false;
  }
}

/** Encode for Cookie / sessionStorage (client). */
export function serializeAttribution(data: StoredOrderAttribution): string {
  try {
    return JSON.stringify({
      postId: data.postId,
      source: data.source,
      productId: data.productId,
      capturedAt: data.capturedAt ?? Date.now(),
    });
  } catch {
    return "";
  }
}

export function deserializeAttribution(raw: string | null | undefined): StoredOrderAttribution | null {
  if (!raw || !raw.trim()) return null;
  try {
    const o = JSON.parse(raw) as Record<string, unknown>;
    const postId = safeStr(o.postId);
    const source = safeStr(o.source);
    if (source !== AI_SOCIAL_ATTRIBUTION_SOURCE || !POST_ID_RE.test(postId)) return null;
    const productIdRaw = safeStr(o.productId);
    const productId = productIdRaw && PRODUCT_ID_RE.test(productIdRaw) ? productIdRaw : undefined;
    const capturedAt = typeof o.capturedAt === "number" && Number.isFinite(o.capturedAt) ? o.capturedAt : Date.now();
    const campaignId = safeOptAttrId(o.campaignId);
    const creativeId = safeOptAttrId(o.creativeId);
    const accountId = safeOptAttrId(o.accountId);
    return {
      postId,
      source: AI_SOCIAL_ATTRIBUTION_SOURCE,
      productId,
      capturedAt,
      ...(campaignId ? { campaignId } : {}),
      ...(creativeId ? { creativeId } : {}),
      ...(accountId ? { accountId } : {}),
    };
  } catch {
    return null;
  }
}

/**
 * Merge request body + cookie (body wins). Returns null if nothing valid — never throws.
 */
export function normalizeOrderAttributionInput(body: unknown, cookieValue: string | null | undefined): OrderAttributionRecord | null {
  const fromCookie = deserializeAttribution(cookieValue ?? null);

  if (!body || typeof body !== "object") {
    return fromCookie ? stripForPersist(fromCookie) : null;
  }

  const o = body as Record<string, unknown>;
  const attr = o.attribution;
  if (!attr || typeof attr !== "object") {
    return fromCookie ? stripForPersist(fromCookie) : null;
  }

  const a = attr as Record<string, unknown>;
  const postId = safeStr(a.postId);
  const source = safeStr(a.source);
  const productIdRaw = safeStr(a.productId);

  if (source !== AI_SOCIAL_ATTRIBUTION_SOURCE || !POST_ID_RE.test(postId)) {
    return fromCookie ? stripForPersist(fromCookie) : null;
  }

  const productId = productIdRaw && PRODUCT_ID_RE.test(productIdRaw) ? productIdRaw : fromCookie?.productId;
  const capturedAt =
    typeof a.capturedAt === "number" && Number.isFinite(a.capturedAt)
      ? a.capturedAt
      : (fromCookie?.capturedAt ?? Date.now());

  return stripForPersist({
    postId,
    source: AI_SOCIAL_ATTRIBUTION_SOURCE,
    productId,
    capturedAt,
    campaignId: safeOptAttrId(a.campaignId) ?? safeOptAttrId(fromCookie?.campaignId),
    creativeId: safeOptAttrId(a.creativeId) ?? safeOptAttrId(fromCookie?.creativeId),
    accountId: safeOptAttrId(a.accountId) ?? safeOptAttrId(fromCookie?.accountId),
  });
}

function stripForPersist(s: OrderAttributionRecord & { postId?: string }): OrderAttributionRecord {
  const out: OrderAttributionRecord = {
    postId: s.postId,
    source: s.source,
    productId: s.productId,
    capturedAt: s.capturedAt,
  };
  const c = safeOptAttrId(s.campaignId);
  const cr = safeOptAttrId(s.creativeId);
  const ac = safeOptAttrId(s.accountId);
  if (c) out.campaignId = c;
  if (cr) out.creativeId = cr;
  if (ac) out.accountId = ac;
  return out;
}

/** NextRequest har cookies; vanlig Request i tester har ikke — fail-closed uten crash. */
export function readAttributionCookieFromRequest(req: {
  cookies?: { get?: (name: string) => { value: string } | undefined };
}): string | null {
  try {
    const v = req.cookies?.get?.(ORDER_ATTRIBUTION_COOKIE_NAME)?.value;
    return v && String(v).trim() ? String(v).trim() : null;
  } catch {
    return null;
  }
}
