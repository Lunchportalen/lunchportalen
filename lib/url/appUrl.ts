import "server-only";

import {
  resolveAppBaseUrl,
  resolvePasswordResetRedirectUrl,
  type ResolveAppBaseUrlInput,
} from "@/lib/url/resolveAppBaseUrl";

export {
  CANONICAL_PRODUCTION_APP_URL,
  LOCAL_DEV_APP_URL,
  pickExplicitAppUrl,
  resolveAppBaseUrl,
  resolvePasswordResetRedirectUrl,
  type ResolveAppBaseUrlInput,
} from "@/lib/url/resolveAppBaseUrl";

export function getAppBaseUrl(): string {
  return resolveAppBaseUrl();
}

export function getPasswordResetRedirectUrl(input?: Pick<ResolveAppBaseUrlInput, "requestHost">): string {
  return resolvePasswordResetRedirectUrl(input ?? {});
}
