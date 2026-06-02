"use client";

import { useCallback, useEffect, useId, useMemo, useState } from "react";

import UserAllergenProfileForm from "@/components/employee/UserAllergenProfileForm";
import {
  formatLpAllergenDisclosureSummaryItems,
  normalizeLpAllergenCodes,
  normalizeLpAllergenFreeText,
  resolveEmployeeAllergenProfileStatusFromClientProfile,
  type KitchenEmployeeAllergenProfileStatus,
  type LpUserAllergenProfile,
} from "@/lib/allergens/lpUserAllergens";

type ApiEnvelope = {
  ok?: boolean;
  data?: { profile?: LpUserAllergenProfile };
  message?: string;
};

function readProfile(json: ApiEnvelope): LpUserAllergenProfile | null {
  if (!json.ok || !json.data?.profile) return null;
  return json.data.profile;
}

export default function WeekAllergenProfileCard() {
  const panelId = useId();
  const [open, setOpen] = useState(false);
  const [hasOpenedPanel, setHasOpenedPanel] = useState(false);
  const [profile, setProfile] = useState<LpUserAllergenProfile | null>(null);
  const [declareState, setDeclareState] = useState<"idle" | "loading" | "error">("idle");
  const [declareError, setDeclareError] = useState<string | null>(null);

  const loadProfile = useCallback(async () => {
    try {
      const res = await fetch("/api/me/user-allergens", { credentials: "include" });
      const json = (await res.json()) as ApiEnvelope;
      const next = readProfile(json);
      if (!res.ok || !next) return;
      setProfile(next);
    } catch {
      /* summary stays on last known profile */
    }
  }, []);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  const status: KitchenEmployeeAllergenProfileStatus = useMemo(
    () => resolveEmployeeAllergenProfileStatusFromClientProfile(profile),
    [profile],
  );

  const summaryItems = useMemo(
    () => formatLpAllergenDisclosureSummaryItems(normalizeLpAllergenCodes(profile?.codes ?? [])),
    [profile],
  );

  const toggleOpen = () => {
    setOpen((prev) => {
      const next = !prev;
      if (next) setHasOpenedPanel(true);
      return next;
    });
  };

  const handleDeclareEmpty = async () => {
    setDeclareState("loading");
    setDeclareError(null);
    try {
      const res = await fetch("/api/me/user-allergens", {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ codes: [], free_text: "" }),
      });
      const json = (await res.json()) as ApiEnvelope;
      const next = readProfile(json);
      if (!res.ok || !next) {
        setDeclareState("error");
        setDeclareError(json.message ?? "Kunne ikke lagre.");
        return;
      }
      setProfile(next);
      setDeclareState("idle");
      setOpen(false);
    } catch {
      setDeclareState("error");
      setDeclareError("Kunne ikke lagre. Prøv igjen.");
    }
  };

  return (
    <section
      className="mb-6 rounded-lg bg-white/90 px-4 py-5 text-center shadow-card ring-1 ring-black/5"
      aria-labelledby="week-allergen-heading"
    >
      <h2 id="week-allergen-heading" className="text-base font-semibold tracking-tight text-neutral-950 md:text-lg">
        Dine allergener
      </h2>
      <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-neutral-700">
        Fortell oss hva du ikke tåler — så tar kjøkkenet hensyn til det når vi lager maten din.
      </p>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-neutral-600">
        Vi vil at alle skal kunne senke skuldrene og nyte lunsjen. Det du krysser av her følger rett til kjøkkenet vårt.
      </p>

      <div className="ds-allergen-disclosure">
        <button
          type="button"
          className="ds-allergen-disclosure__summary"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={toggleOpen}
        >
          <span className="ds-allergen-disclosure__summary-main">
            {status === "unknown" ? (
              <>
                <span className="ds-allergen-disclosure__summary-label">Allergener</span>
                <span className="ds-allergen-disclosure__summary-hint">Legg til hvis du har noen</span>
              </>
            ) : null}
            {status === "declared_empty" ? (
              <span className="ds-allergen-disclosure__summary-label">Allergener: ingen oppgitt ✓</span>
            ) : null}
            {status === "has_data" ? (
              <span className="ds-allergen-disclosure__summary-chips" role="list" aria-label="Valgte allergener">
                {summaryItems.map((item) => (
                  <span key={item} className="ds-allergen-chip ds-allergen-chip--readonly" role="listitem">
                    {item}
                  </span>
                ))}
              </span>
            ) : null}
          </span>
          <span className="ds-allergen-disclosure__chevron" aria-hidden="true" />
        </button>

        <div
          id={panelId}
          className={`ds-allergen-disclosure__panel${open ? " is-open" : ""}`}
          hidden={!open}
        >
          <div className="ds-allergen-disclosure__panel-inner">
            {status === "unknown" ? (
              <button
                type="button"
                className="ds-allergen-disclosure__declare-empty"
                onClick={() => void handleDeclareEmpty()}
                disabled={declareState === "loading"}
                aria-busy={declareState === "loading"}
              >
                {declareState === "loading" ? "Lagrer…" : "Jeg har ingen allergener"}
              </button>
            ) : null}
            {declareError ? (
              <p className="mb-3 text-center text-sm text-red-800" role="alert">
                {declareError}
              </p>
            ) : null}
            {hasOpenedPanel ? <UserAllergenProfileForm onProfileChange={setProfile} /> : null}
          </div>
        </div>
      </div>
    </section>
  );
}
