"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";

import type { PlanKey, WeekdayKey } from "@/lib/onboarding/types";
import type { LocationDraft } from "@/lib/onboarding/types";
import { buildAgreementPayload, sortDays, type WizardDraft } from "@/lib/onboarding/buildPayload";
import { submitAgreement } from "@/lib/onboarding/submitAgreement";
import type { AgreementPayload } from "@/lib/onboarding/types";
import type { FirmaOnboardingCmsBundle } from "@/lib/onboarding/cmsBundleTypes";
import { BASIS_MEAL_OPTIONS, LUXUS_MEAL_OPTIONS } from "@/lib/onboarding/mealOptions";
import { normalizeMealTypeKey } from "@/lib/cms/mealTypeKey";

import PlanStep from "@/components/onboarding/PlanStep";
import DaysStep from "@/components/onboarding/DaysStep";
import MenuStep from "@/components/onboarding/MenuStep";
import LocationStep from "@/components/onboarding/LocationStep";
import SummaryStep from "@/components/onboarding/SummaryStep";

const STEPS = ["Plan", "Leveringsdager", "Meny", "Lokasjon", "Oppsummering"] as const;

function cx(...p: Array<string | false | null | undefined>) {
  return p.filter(Boolean).join(" ");
}

function basisOptionsFromCms(cms: FirmaOnboardingCmsBundle | null) {
  if (cms) {
    return cms.basis.allowedMeals
      .map((k) => normalizeMealTypeKey(k))
      .filter(Boolean)
      .map((key) => ({ key, label: (cms.menuTitles[key] || key).trim() }));
  }
  return BASIS_MEAL_OPTIONS.map((o) => ({ key: o.key, label: o.label }));
}

function luxusOptionsFromCms(cms: FirmaOnboardingCmsBundle | null) {
  if (cms) {
    return cms.luxus.allowedMeals
      .map((k) => normalizeMealTypeKey(k))
      .filter(Boolean)
      .map((key) => ({ key, label: (cms.menuTitles[key] || key).trim() }));
  }
  return LUXUS_MEAL_OPTIONS.map((o) => ({ key: o.key, label: o.label }));
}

type Props = {
  cms?: FirmaOnboardingCmsBundle | null;
};

export default function FirmaOnboardingWizard({ cms = null }: Props) {
  const [step, setStep] = useState(0);
  const [plan, setPlan] = useState<PlanKey | null>(null);
  const [deliveryDays, setDeliveryDays] = useState<WeekdayKey[]>([]);
  const [fixedMeal, setFixedMeal] = useState<string | null>(null);
  const [menuPerDay, setMenuPerDay] = useState<Partial<Record<WeekdayKey, string>>>({});
  const [locations, setLocations] = useState<LocationDraft[]>([{ name: "", address: "", instructions: "" }]);
  const [confirmed, setConfirmed] = useState(false);

  const [stepError, setStepError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [donePayload, setDonePayload] = useState<AgreementPayload | null>(null);
  const [busy, setBusy] = useState(false);

  const basisOptions = useMemo(() => basisOptionsFromCms(cms), [cms]);
  const luxusOptions = useMemo(() => luxusOptionsFromCms(cms), [cms]);
  const cmsPrices = useMemo(
    () => (cms ? { basis: cms.basis.price, luxus: cms.luxus.price } : null),
    [cms]
  );

  const setDaysSafe = useCallback((days: WeekdayKey[]) => {
    const sorted = sortDays(days);
    setDeliveryDays(sorted);
    setMenuPerDay((prev) => {
      const next: Partial<Record<WeekdayKey, string>> = { ...prev };
      for (const k of Object.keys(next) as WeekdayKey[]) {
        if (!sorted.includes(k)) delete next[k];
      }
      return next;
    });
  }, []);

  const draft: WizardDraft = useMemo(
    () => ({
      plan,
      deliveryDays,
      fixedMeal,
      menuPerDay,
      locations,
    }),
    [plan, deliveryDays, fixedMeal, menuPerDay, locations]
  );

  const payloadPreview = useMemo(() => buildAgreementPayload(draft), [draft]);

  const canProceed = useMemo(() => {
    if (step === 0) return plan !== null;
    if (step === 1) return deliveryDays.length >= 1 && deliveryDays.length <= 5;
    if (step === 2) {
      if (!plan) return false;
      if (plan === "basis") return fixedMeal !== null;
      if (!deliveryDays.length) return false;
      return deliveryDays.every((d) => String(menuPerDay[d] ?? "").trim() !== "");
    }
    if (step === 3) {
      return (
        locations.length > 0 &&
        locations.every((l) => String(l.name).trim() !== "" && String(l.address).trim() !== "")
      );
    }
    if (step === 4) return confirmed && payloadPreview !== null;
    return false;
  }, [step, plan, deliveryDays, fixedMeal, menuPerDay, locations, confirmed, payloadPreview]);

  function validateCurrentStep(): boolean {
    setStepError(null);
    if (step === 0 && !plan) {
      setStepError("Velg Basis eller Luxus for å gå videre.");
      return false;
    }
    if (step === 1 && deliveryDays.length === 0) {
      setStepError("Velg minst én leveringsdag.");
      return false;
    }
    if (step === 2) {
      if (plan === "basis" && !fixedMeal) {
        setStepError("Velg én meny for Basis.");
        return false;
      }
      if (plan === "luxus") {
        const missing = deliveryDays.find((d) => !String(menuPerDay[d] ?? "").trim());
        if (missing) {
          setStepError("Alle leveringsdager må ha valgt måltid.");
          return false;
        }
      }
    }
    if (step === 3) {
      const bad = locations.some((l) => !String(l.name).trim() || !String(l.address).trim());
      if (bad) {
        setStepError("Fyll ut navn og adresse for alle lokasjoner.");
        return false;
      }
      const built = buildAgreementPayload(draft);
      if (!built) {
        setStepError("Avtalen er ufullstendig. Gå tilbake og kontroller meny og dager.");
        return false;
      }
    }
    return true;
  }

  function goNext() {
    if (!validateCurrentStep()) return;
    if (step < STEPS.length - 1) setStep((s) => s + 1);
  }

  function goBack() {
    setStepError(null);
    setSubmitError(null);
    if (step > 0) setStep((s) => s - 1);
  }

  async function handleFinish() {
    setSubmitError(null);
    if (!confirmed) {
      setSubmitError("Bekreft avtalen før du fullfører.");
      return;
    }
    const built = buildAgreementPayload(draft);
    if (!built) {
      setSubmitError("Ufullstendige data. Gå tilbake og kontroller hvert steg.");
      return;
    }
    setBusy(true);
    try {
      const allowlists = cms
        ? { basisMeals: cms.basis.allowedMeals, luxusMeals: cms.luxus.allowedMeals }
        : null;
      const res = await submitAgreement(built, allowlists);
      if (res.ok === false) {
        setSubmitError(res.issues.join(" ") || res.message);
        return;
      }
      setDonePayload(res.payload);
    } catch {
      setSubmitError("Noe gikk galt. Prøv igjen.");
    } finally {
      setBusy(false);
    }
  }

  async function copyJson() {
    if (!donePayload) return;
    try {
      await navigator.clipboard.writeText(JSON.stringify(donePayload, null, 2));
    } catch {
      /* ignore */
    }
  }

  if (donePayload) {
    return (
      <div className="mx-auto max-w-2xl space-y-6 text-center">
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-6">
          <h2 className="text-lg font-semibold text-emerald-950">Avtaleutkast er klart</h2>
          <p className="mt-2 text-sm text-emerald-900">
            Utkastet er validert lokalt. Opprettelse i systemet skjer via eksisterende intern prosess (ingen ny API-rute i
            dette laget).
          </p>
          <button
            type="button"
            onClick={() => void copyJson()}
            className="lp-btn lp-btn--primary mx-auto mt-4 min-h-[44px]"
          >
            Kopier JSON til utklippstavle
          </button>
        </div>
        <pre className="max-h-64 overflow-auto rounded-xl border border-[rgb(var(--lp-border))] bg-[rgb(var(--lp-surface))] p-4 text-left text-xs text-[rgb(var(--lp-fg))]">
          {JSON.stringify(donePayload, null, 2)}
        </pre>
        <Link href="/admin" className="inline-flex min-h-[44px] items-center justify-center text-sm font-medium text-[rgb(var(--lp-fg))] underline">
          Tilbake til admin
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      {!cms ? (
        <p className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          CMS-produktplaner er ikke tilgjengelige akkurat nå. Veiviseren bruker standard menyer og priser til validering er
          bekreftet.
        </p>
      ) : null}

      <p className="mb-4 text-center text-xs text-[rgb(var(--lp-muted))]">
        AI kan foreslå tydeligere tekst underveis — du godkjenner alltid endringer i systemet.
      </p>

      <div className="mb-6 flex flex-wrap items-center justify-between gap-2 text-xs text-[rgb(var(--lp-muted))]">
        <span>
          Steg {step + 1} av {STEPS.length}
        </span>
        <span>{STEPS[step]}</span>
      </div>

      <h2 className="lp-h2 mb-4 text-[rgb(var(--lp-fg))]">{STEPS[step]}</h2>

      {step === 0 ? (
        <PlanStep selected={plan} onSelect={setPlan} error={stepError} cmsPrices={cmsPrices} />
      ) : null}
      {step === 1 ? <DaysStep selected={deliveryDays} onChange={setDaysSafe} error={stepError} /> : null}
      {step === 2 && plan ? (
        <MenuStep
          plan={plan}
          deliveryDays={deliveryDays}
          basisOptions={basisOptions}
          luxusOptions={luxusOptions}
          fixedMeal={fixedMeal}
          onFixedMeal={setFixedMeal}
          menuPerDay={menuPerDay}
          onMenuDay={(d, v) => setMenuPerDay((p) => ({ ...p, [d]: v }))}
          error={stepError}
        />
      ) : null}
      {step === 3 ? <LocationStep locations={locations} onChange={setLocations} error={stepError} /> : null}
      {step === 4 ? (
        payloadPreview ? (
          <SummaryStep
            payload={payloadPreview}
            confirmed={confirmed}
            onConfirmedChange={setConfirmed}
            error={submitError ?? stepError}
            menuTitles={cms?.menuTitles ?? null}
            cmsPrices={cmsPrices}
          />
        ) : (
          <p className="text-sm text-[rgb(var(--lp-muted))]">Fullfør forrige steg for å se oppsummering.</p>
        )
      ) : null}

      <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={goBack}
          disabled={step === 0 || busy}
          className={cx(
            "min-h-[44px] rounded-full border border-[rgb(var(--lp-border))] px-5 text-sm font-medium",
            step === 0 ? "pointer-events-none opacity-40" : "bg-white text-[rgb(var(--lp-fg))]"
          )}
        >
          Tilbake
        </button>
        {step < STEPS.length - 1 ? (
          <button
            type="button"
            onClick={goNext}
            disabled={!canProceed || busy}
            className="lp-btn lp-btn--primary min-h-[44px] disabled:pointer-events-none disabled:opacity-40"
          >
            Neste
          </button>
        ) : (
          <button
            type="button"
            onClick={() => void handleFinish()}
            disabled={!canProceed || busy}
            className="lp-btn lp-btn--primary min-h-[44px] disabled:pointer-events-none disabled:opacity-40"
          >
            {busy ? "Behandler…" : "Fullfør"}
          </button>
        )}
      </div>
    </div>
  );
}
