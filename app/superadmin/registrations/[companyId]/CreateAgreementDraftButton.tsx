"use client";

export default function CreateAgreementDraftButton(_props: { companyId: string }) {
  return (
    <div className="mt-4 rounded-2xl border border-[rgb(var(--lp-border))] bg-white/80 p-4">
      <div className="text-sm font-semibold">Avtaleutkast</div>
      <p className="mt-1 text-xs text-[rgb(var(--lp-muted))]">
        Manuell opprettelse av avtaleutkast er deaktivert. Bruk approve/reject direkte på registreringen.
      </p>
      <button
        type="button"
        disabled
        aria-disabled="true"
        title="Manuell opprettelse av avtale-utkast er deaktivert. Bruk approve/reject direkte på registreringen."
        className="mt-3 inline-flex min-h-[44px] items-center rounded-2xl border bg-white px-4 py-2 text-sm font-semibold hover:bg-neutral-50 disabled:opacity-50"
      >
        Opprett avtaleutkast (deaktivert)
      </button>
    </div>
  );
}
