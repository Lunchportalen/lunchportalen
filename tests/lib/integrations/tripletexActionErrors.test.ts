import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { loadMessagesForLocale } from "@/lib/i18n/messages";
import {
  PROVIDER_TRIPLETEX_ACTION_ERROR_KEYS,
  mapDisconnectRpcErrorKey,
  mapFinalizeRpcErrorKey,
  resolveTripletexActionError,
  tripletexActionFailure,
} from "@/lib/integrations/tripletex/tripletexActionErrors";

const STATUS_ACTIONS = join(process.cwd(), "app/leverandor/innstillinger/tripletex/status/actions.ts");
const CONNECT_ACTIONS = join(process.cwd(), "app/leverandor/innstillinger/tripletex/koble-til/actions.ts");

describe("tripletexActionErrors", () => {
  it("tripletexActionFailure returns stable errorKey with optional code", () => {
    expect(tripletexActionFailure("notAuthenticated", "UNAUTHENTICATED")).toEqual({
      ok: false,
      errorKey: "notAuthenticated",
      code: "UNAUTHENTICATED",
    });
    expect(tripletexActionFailure("unknown")).toEqual({
      ok: false,
      errorKey: "unknown",
    });
  });

  it("mapDisconnectRpcErrorKey maps RPC codes without raw message", () => {
    expect(mapDisconnectRpcErrorKey("INVALID_STATE_FOR_DISCONNECT")).toBe("invalidState");
    expect(mapDisconnectRpcErrorKey("RPC_FAILURE")).toBe("disconnectFailed");
  });

  it("mapFinalizeRpcErrorKey maps RPC codes without raw message", () => {
    expect(mapFinalizeRpcErrorKey("PROVISIONING_NOT_COMPLETE")).toBe("provisioningNotComplete");
    expect(mapFinalizeRpcErrorKey("WEBHOOK_SECRET_REQUIRED")).toBe("webhookSecretRequired");
    expect(mapFinalizeRpcErrorKey("OTHER")).toBe("finalizeFailed");
  });

  it("resolveTripletexActionError translates known key and safe fallback", async () => {
    const messages = (await loadMessagesForLocale("nb")) as {
      provider: { tripletex: { errors: Record<string, string> } };
    };
    const t = (key: string) => messages.provider.tripletex.errors[key] ?? key;
    expect(
      resolveTripletexActionError(t, { ok: false, errorKey: "forbidden" }, "unknown"),
    ).toBe("Ingen tilgang til denne leverandøren.");
    expect(resolveTripletexActionError(t, { ok: false }, "healthLoadFailed")).toBe(
      "Kunne ikke hente tilkoblingsstatus.",
    );
    expect(
      resolveTripletexActionError(t, { ok: false, errorKey: "RAW_SERVER" }, "unknown"),
    ).toBe("Noe gikk galt. Prøv igjen.");
  });

  it("nb/en define all tripletex action error keys", async () => {
    for (const locale of ["nb", "en"] as const) {
      const messages = (await loadMessagesForLocale(locale)) as {
        provider: { tripletex: { errors: Record<string, string> } };
      };
      for (const key of PROVIDER_TRIPLETEX_ACTION_ERROR_KEYS) {
        expect(messages.provider.tripletex.errors[key]).toBeTruthy();
      }
    }
  });
});

describe("PR 7b wiring and payload locks", () => {
  it("tripletex actions return errorKey-only failures", () => {
    const statusSrc = readFileSync(STATUS_ACTIONS, "utf8");
    const connectSrc = readFileSync(CONNECT_ACTIONS, "utf8");
    expect(statusSrc).toContain("tripletexActionFailure");
    expect(statusSrc).not.toContain('error: "Ikke innlogget."');
    expect(connectSrc).toContain("tripletexActionFailure");
    expect(connectSrc).not.toContain('error: "Company ID må være 6–12 siffer."');
    expect(statusSrc).toContain("verifyTripletexEmployeeToken");
    expect(connectSrc).toContain("syncWebhookSubscriptions");
    expect(statusSrc).toContain("lp_provider_disconnect_tripletex");
  });

  it("tripletex clients resolve errorKey via i18n", () => {
    const dashboard = readFileSync(
      join(process.cwd(), "components/provider/tripletex-status/StatusDashboardClient.tsx"),
      "utf8",
    );
    expect(dashboard).toContain("resolveTripletexActionError");
    expect(dashboard).toContain('useTranslations("provider.tripletex.errors")');
    expect(dashboard).not.toContain("res.error");

    const step1 = readFileSync(
      join(process.cwd(), "components/provider/tripletex-wizard/Step1TokenEntry.tsx"),
      "utf8",
    );
    expect(step1).toContain("resolveTripletexActionError");
    expect(step1).not.toContain("setFormError(res.error");
  });
});
