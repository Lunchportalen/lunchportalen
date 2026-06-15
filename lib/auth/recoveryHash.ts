export type ParsedRecoveryHash = {
  accessToken: string | null;
  refreshToken: string | null;
  type: string | null;
  error: string | null;
  errorCode: string | null;
  errorDescription: string | null;
};

/** Parse Supabase implicit recovery redirect hash (#access_token=...&type=recovery). */
export function parseRecoveryHash(rawHash: string): ParsedRecoveryHash {
  const hash = String(rawHash ?? "").replace(/^#/, "").trim();
  if (!hash) {
    return emptyParsedRecoveryHash();
  }

  const params = new URLSearchParams(hash);
  return {
    accessToken: params.get("access_token"),
    refreshToken: params.get("refresh_token"),
    type: params.get("type"),
    error: params.get("error"),
    errorCode: params.get("error_code"),
    errorDescription: params.get("error_description"),
  };
}

function emptyParsedRecoveryHash(): ParsedRecoveryHash {
  return {
    accessToken: null,
    refreshToken: null,
    type: null,
    error: null,
    errorCode: null,
    errorDescription: null,
  };
}

export function isRecoveryHashExpired(parsed: ParsedRecoveryHash): boolean {
  if (parsed.error === "access_denied") return true;
  if (parsed.errorCode === "otp_expired") return true;
  const desc = String(parsed.errorDescription ?? "").toLowerCase();
  if (desc.includes("expired") || desc.includes("invalid")) return true;
  return false;
}

export function isRecoveryHashValid(parsed: ParsedRecoveryHash): boolean {
  return Boolean(
    parsed.accessToken &&
      parsed.refreshToken &&
      parsed.type === "recovery" &&
      !isRecoveryHashExpired(parsed),
  );
}

/** Remove tokenized hash from the address bar after session is established. */
export function clearRecoveryHashFromUrl(): void {
  if (typeof window === "undefined") return;
  const { pathname, search } = window.location;
  window.history.replaceState({}, window.document.title, `${pathname}${search}`);
}

export const RECOVERY_EXPIRED_MESSAGE =
  "Lenken er utløpt eller allerede brukt. Be om ny lenke.";

export const RECOVERY_CHECKING_MESSAGE = "Kontrollerer lenken …";
