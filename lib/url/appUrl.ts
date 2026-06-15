import "server-only";

import { resolveAppBaseUrl, resolvePasswordResetRedirectUrl } from "@/lib/url/resolveAppBaseUrl";

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

export function getPasswordResetRedirectUrl(): string {
  return resolvePasswordResetRedirectUrl();
}
