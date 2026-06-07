"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import CoverageWishForm from "@/components/start/CoverageWishForm";
import {
  buildContinuationPath,
  isValidCity,
  isValidPostalCode,
  normalizeCity,
  normalizePostalCode,
  resolveSource,
  resolveStartIntent,
} from "@/lib/public/geographyParams";

type Step = "location" | "uncovered";

type LocationForm = {
  postalCode: string;
  city: string;
};

export default function GeographyGateForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const intent = useMemo(() => resolveStartIntent(searchParams.get("intent")), [searchParams]);
  const source = useMemo(() => resolveSource(searchParams.get("source")), [searchParams]);

  const [step, setStep] = useState<Step>("location");
  const [location, setLocation] = useState<LocationForm>({ postalCode: "", city: "" });
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [fieldError, setFieldError] = useState<string | null>(null);

  const updateLocation = useCallback((key: keyof LocationForm, value: string) => {
    setLocation((prev) => ({
      ...prev,
      [key]: key === "postalCode" ? normalizePostalCode(value) : value,
    }));
    setFieldError(null);
  }, []);

  const onCheckCoverage = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      setStatus("loading");
      setErrorMsg("");
      setFieldError(null);

      const postal_code = normalizePostalCode(location.postalCode);
      const city = normalizeCity(location.city);

      if (!isValidPostalCode(postal_code)) {
        setStatus("error");
        setErrorMsg("Postnummer må være 4 siffer.");
        setFieldError("postalCode");
        return;
      }

      if (!isValidCity(city)) {
        setStatus("error");
        setErrorMsg("Poststed må fylles ut.");
        setFieldError("city");
        return;
      }

      try {
        const res = await fetch("/api/public/coverage/check", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ postal_code, city }),
        });
        const json = (await res.json()) as {
          ok?: boolean;
          message?: string;
          data?: { covered?: boolean; mvpForward?: boolean };
          detail?: { field?: string };
        };

        if (!res.ok || json.ok === false) {
          setStatus("error");
          setErrorMsg(json.message ?? "Kunne ikke sjekke dekning. Prøv igjen.");
          const field = json.detail?.field;
          if (field === "postal_code") setFieldError("postalCode");
          if (field === "city") setFieldError("city");
          return;
        }

        const covered = json.data?.covered === true || json.data?.mvpForward === true;

        if (covered) {
          const path = buildContinuationPath(intent, { postalCode: postal_code, city, source });
          router.push(path);
          return;
        }

        setLocation({ postalCode: postal_code, city });
        setStep("uncovered");
        setStatus("idle");
      } catch {
        setStatus("error");
        setErrorMsg("Kunne ikke sjekke dekning. Sjekk nettverket og prøv igjen.");
      }
    },
    [intent, location.city, location.postalCode, router, source],
  );

  if (step === "uncovered") {
    return (
      <CoverageWishForm
        postalCode={location.postalCode}
        city={location.city}
        source={source}
        onBack={() => {
          setStep("location");
          setStatus("idle");
          setErrorMsg("");
        }}
      />
    );
  }

  const heading = intent === "register" ? "Registrer firma" : "Book demo";
  const intro =
    intent === "register"
      ? "Først trenger vi lokasjonen deres — så viser vi riktig vei videre."
      : "Først trenger vi lokasjonen deres — så finner vi riktig vei til demo.";

  return (
    <form className="lp-start-form lp-demo-form" onSubmit={onCheckCoverage} noValidate>
      <p className="lp-start-form__intro">{intro}</p>

      <label>
        Postnummer *
        <input
          type="text"
          name="postal_code"
          inputMode="numeric"
          autoComplete="postal-code"
          required
          value={location.postalCode}
          onChange={(e) => updateLocation("postalCode", e.target.value)}
          className={fieldError === "postalCode" ? "is-invalid" : undefined}
          maxLength={4}
          aria-describedby="lp-start-postal-hint"
        />
      </label>
      <p id="lp-start-postal-hint" className="lp-start-form__hint">
        4 siffer, f.eks. 0150
      </p>

      <label>
        Poststed *
        <input
          type="text"
          name="city"
          autoComplete="address-level2"
          required
          value={location.city}
          onChange={(e) => updateLocation("city", e.target.value)}
          className={fieldError === "city" ? "is-invalid" : undefined}
          maxLength={128}
        />
      </label>

      <p
        className={`lp-demo-form__status${status === "error" ? " is-error" : ""}`}
        role={status === "error" ? "alert" : undefined}
      >
        {errorMsg}
      </p>

      <button type="submit" className={status === "loading" ? "is-loading" : undefined} disabled={status === "loading"}>
        {status === "loading" ? (
          <>
            <span className="lp-demo-form__btn-spinner" aria-hidden="true" />
            Sjekker dekning …
          </>
        ) : (
          `Fortsett til ${heading.toLowerCase()}`
        )}
      </button>
    </form>
  );
}
