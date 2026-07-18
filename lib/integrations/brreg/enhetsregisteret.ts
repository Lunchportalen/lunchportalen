/**
 * Official Brønnøysundregistrene (Enhetsregisteret) verification for
 * Merverdiavgiftsregisteret status. Fail-closed: never treat missing/error as registered.
 */
import "server-only";

export const LUNCHPORTALEN_AS_ORGNR = "937155239";
export const BRREG_ENHET_SOURCE = "brreg.enhetsregisteret.enhet.v1" as const;

export type BrregMvaCheckResult = {
  ok: boolean;
  orgnr: string;
  legalName: string | null;
  registeredInMvaRegister: boolean | null;
  officialSource: typeof BRREG_ENHET_SOURCE;
  checkedAt: string;
  httpStatus: number | null;
  evidenceReference: string | null;
  errorCode: string | null;
  rawChecksum: string | null;
};

function digitsOnly(orgnr: string): string {
  return String(orgnr || "").replace(/\D/g, "");
}

/** Simple durable fingerprint — never logs secrets. */
export function checksumBrregPayload(raw: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < raw.length; i++) {
    h ^= raw.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

export async function fetchBrregMvaRegistrationStatus(input?: {
  orgnr?: string;
  fetchImpl?: typeof fetch;
}): Promise<BrregMvaCheckResult> {
  const orgnr = digitsOnly(input?.orgnr || LUNCHPORTALEN_AS_ORGNR);
  const checkedAt = new Date().toISOString();
  const fetchImpl = input?.fetchImpl ?? fetch;

  if (orgnr.length !== 9) {
    return {
      ok: false,
      orgnr,
      legalName: null,
      registeredInMvaRegister: null,
      officialSource: BRREG_ENHET_SOURCE,
      checkedAt,
      httpStatus: null,
      evidenceReference: null,
      errorCode: "INVALID_ORGNR",
      rawChecksum: null,
    };
  }

  const url = `https://data.brreg.no/enhetsregisteret/api/enheter/${orgnr}`;
  try {
    const res = await fetchImpl(url, {
      method: "GET",
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    const httpStatus = res.status;
    const raw = await res.text();
    const rawChecksum = checksumBrregPayload(raw);

    if (!res.ok) {
      return {
        ok: false,
        orgnr,
        legalName: null,
        registeredInMvaRegister: null,
        officialSource: BRREG_ENHET_SOURCE,
        checkedAt,
        httpStatus,
        evidenceReference: url,
        errorCode: `BRREG_HTTP_${httpStatus}`,
        rawChecksum,
      };
    }

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      return {
        ok: false,
        orgnr,
        legalName: null,
        registeredInMvaRegister: null,
        officialSource: BRREG_ENHET_SOURCE,
        checkedAt,
        httpStatus,
        evidenceReference: url,
        errorCode: "BRREG_JSON_PARSE_FAILED",
        rawChecksum,
      };
    }

    const legalName =
      typeof parsed.navn === "string" && parsed.navn.trim() ? parsed.navn.trim() : null;
    if (typeof parsed.registrertIMvaregisteret !== "boolean") {
      return {
        ok: false,
        orgnr,
        legalName,
        registeredInMvaRegister: null,
        officialSource: BRREG_ENHET_SOURCE,
        checkedAt,
        httpStatus,
        evidenceReference: url,
        errorCode: "BRREG_MVA_FIELD_MISSING",
        rawChecksum,
      };
    }

    return {
      ok: true,
      orgnr,
      legalName,
      registeredInMvaRegister: parsed.registrertIMvaregisteret,
      officialSource: BRREG_ENHET_SOURCE,
      checkedAt,
      httpStatus,
      evidenceReference: url,
      errorCode: null,
      rawChecksum,
    };
  } catch {
    return {
      ok: false,
      orgnr,
      legalName: null,
      registeredInMvaRegister: null,
      officialSource: BRREG_ENHET_SOURCE,
      checkedAt,
      httpStatus: null,
      evidenceReference: url,
      errorCode: "BRREG_FETCH_FAILED",
      rawChecksum: null,
    };
  }
}
