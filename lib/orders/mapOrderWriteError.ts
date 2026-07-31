/** Maps lp_order_set / Postgres RPC errors to structured order-write HTTP responses. */

export type PostgresRpcError = {
  message?: string;
  code?: string;
  details?: string;
  hint?: string;
};

export type MappedOrderWriteError = {
  status: number;
  code: string;
  message: string;
  bodyExtra?: Record<string, unknown>;
  errorType: "rpc" | "pg_constraint";
  logLevel: "warn" | "error";
};

function safeStr(v: unknown): string {
  return String(v ?? "").trim();
}

function extractLocationIdFromMsdError(message: string): string | null {
  const m = message.match(/location_id=([0-9a-f-]{36})/i);
  return m?.[1] ?? null;
}

export function mapOrderWriteError(err: PostgresRpcError): MappedOrderWriteError {
  const errCode = safeStr(err.code);
  const m = safeStr(err.message);
  const mUpper = m.toUpperCase();

  if (errCode === "23502") {
    return {
      status: 422,
      code: "NOT_NULL_VIOLATION",
      message: "Internal data missing",
      bodyExtra: {
        error: "data_integrity",
        code: "NOT_NULL_VIOLATION",
        hint: "Internal data missing",
      },
      errorType: "pg_constraint",
      logLevel: "warn",
    };
  }

  if (errCode === "23503") {
    return {
      status: 422,
      code: "FK_VIOLATION",
      message: "Data constraint violation",
      bodyExtra: {
        error: "constraint_violation",
        code: "23503",
        hint: "Foreign key constraint failed",
      },
      errorType: "pg_constraint",
      logLevel: "warn",
    };
  }

  if (errCode === "23505") {
    return {
      status: 422,
      code: "UNIQUE_VIOLATION",
      message: "Data constraint violation",
      bodyExtra: {
        error: "constraint_violation",
        code: "23505",
        hint: "Unique constraint failed",
      },
      errorType: "pg_constraint",
      logLevel: "warn",
    };
  }

  if (mUpper.includes("MENU_NOT_PUBLISHED")) {
    return {
      status: 409,
      code: "menu_not_published",
      message: "Menyen for valgt dag er ikke publisert ennå",
      bodyExtra: {
        error: "menu_not_published",
        hint: "Menyen for valgt dag er ikke publisert ennå",
      },
      errorType: "rpc",
      logLevel: "warn",
    };
  }

  if (mUpper.includes("MENU_SERVICE_DAY_ITEMS_MISSING")) {
    return {
      status: 409,
      code: "menu_items_missing",
      message: "Menyen er ikke ferdig klargjort — prøv igjen om noen minutter",
      bodyExtra: {
        error: "menu_items_missing",
        hint: "Menyen er ikke ferdig klargjort — prøv igjen om noen minutter",
      },
      errorType: "rpc",
      logLevel: "warn",
    };
  }

  if (mUpper.includes("MSD_PROVIDER_UNRESOLVABLE")) {
    const locationId = extractLocationIdFromMsdError(m);
    return {
      status: 422,
      code: "provider_unresolvable",
      message: "Konfigurasjonsfeil — kontakt support",
      bodyExtra: {
        error: "provider_unresolvable",
        hint: "Konfigurasjonsfeil — kontakt support",
        ...(locationId ? { location_id: locationId } : {}),
      },
      errorType: "rpc",
      logLevel: "warn",
    };
  }

  if (mUpper.includes("DATE_REQUIRED") || mUpper.includes("ACTION_INVALID")) {
    return {
      status: 400,
      code: "BAD_INPUT",
      message: "Bestillingen mangler gyldige felter.",
      errorType: "rpc",
      logLevel: "warn",
    };
  }
  if (mUpper.includes("NO_ACTIVE_AGREEMENT")) {
    return {
      status: 409,
      code: "NO_ACTIVE_AGREEMENT",
      message: "Du kan ikke bestille fordi firmaet ikke har en aktiv avtale.",
      errorType: "rpc",
      logLevel: "warn",
    };
  }
  if (mUpper.includes("OUTSIDE_DELIVERY_DAYS")) {
    return {
      status: 409,
      code: "OUTSIDE_DELIVERY_DAYS",
      message: "Denne dagen er ikke en leveringsdag.",
      errorType: "rpc",
      logLevel: "warn",
    };
  }
  if (mUpper.includes("CUTOFF_PASSED")) {
    return {
      status: 409,
      code: "CUTOFF_PASSED",
      message: "Fristen for i dag er passert (kl. 08:00).",
      errorType: "rpc",
      logLevel: "warn",
    };
  }
  if (mUpper.includes("CHOICE_KEY_REQUIRED")) {
    return {
      status: 422,
      code: "CHOICE_KEY_REQUIRED",
      message: "Menyvalg er påkrevd.",
      errorType: "rpc",
      logLevel: "warn",
    };
  }
  if (mUpper.includes("MENU_SERVICE_DAY_ITEM_NOT_FOUND")) {
    return {
      status: 409,
      code: "MENU_SERVICE_DAY_ITEM_NOT_FOUND",
      message: "Fant ikke menylinje for valget.",
      errorType: "rpc",
      logLevel: "warn",
    };
  }
  if (mUpper.includes("CAPACITY_EXCEEDED")) {
    return {
      status: 409,
      code: "CAPACITY_EXCEEDED",
      message: "Kapasiteten for denne retten er fullbooket for valgt dag.",
      errorType: "rpc",
      logLevel: "warn",
    };
  }
  if (mUpper.includes("CAPACITY_CLOSED")) {
    return {
      status: 409,
      code: "CAPACITY_CLOSED",
      message: "Bestilling er stengt for valgt dag.",
      errorType: "rpc",
      logLevel: "warn",
    };
  }
  if (mUpper.includes("CAPACITY_POLICY_MISSING")) {
    return {
      status: 409,
      code: "CAPACITY_POLICY_MISSING",
      message: "Kapasitet er ikke konfigurert for leverandøren. Bestilling er midlertidig stengt.",
      errorType: "rpc",
      logLevel: "warn",
    };
  }
  if (mUpper.includes("CAPACITY_QTY_INVALID")) {
    return {
      status: 400,
      code: "CAPACITY_QTY_INVALID",
      message: "Ugyldig antall for kapasitetsreservasjon.",
      errorType: "rpc",
      logLevel: "warn",
    };
  }
  if (mUpper.includes("CAPACITY_BELOW_RESERVED")) {
    return {
      status: 409,
      code: "CAPACITY_BELOW_RESERVED",
      message: "Kan ikke sette kapasitet under allerede reserverte bestillinger.",
      errorType: "rpc",
      logLevel: "warn",
    };
  }
  if (mUpper.includes("PROFILE_MISSING") || mUpper.includes("SCOPE_FORBIDDEN")) {
    return {
      status: 403,
      code: "SCOPE_FORBIDDEN",
      message: "Du har ikke tilgang til å bestille for denne brukeren.",
      errorType: "rpc",
      logLevel: "warn",
    };
  }
  if (mUpper.includes("UNAUTHENTICATED")) {
    return {
      status: 401,
      code: "UNAUTHENTICATED",
      message: "Du må logge inn for å bestille.",
      errorType: "rpc",
      logLevel: "warn",
    };
  }
  if (mUpper.includes("SLOT") || mUpper.includes("INVALID_SLOT")) {
    return {
      status: 400,
      code: "INVALID_SLOT",
      message: "Ugyldig leveringsslot.",
      errorType: "rpc",
      logLevel: "warn",
    };
  }

  return {
    status: 500,
    code: "ORDER_SET_FAILED",
    message: "Vi kunne ikke lagre bestillingen nå.",
    errorType: "rpc",
    logLevel: "error",
  };
}
