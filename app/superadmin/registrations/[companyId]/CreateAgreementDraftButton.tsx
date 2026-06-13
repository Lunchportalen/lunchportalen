import { AGREEMENT_DRAFT_FLOW_DISABLED_UI_COPY } from "@/lib/server/superadmin/agreementDraftFlowDisabled";

/** Informativ boks — ingen handling. Superadmin skal ikke opprette avtaleutkast manuelt. */
export default function CreateAgreementDraftButton(_props: { companyId: string }) {
  return (
    <div
      className="mt-4 rounded-2xl border border-amber-200/80 bg-amber-50/60 p-4"
      role="status"
      aria-live="polite"
    >
      <div className="text-sm font-semibold text-amber-950">Avtale ved godkjenning</div>
      <p className="mt-1 text-sm leading-relaxed text-amber-900/90">{AGREEMENT_DRAFT_FLOW_DISABLED_UI_COPY}</p>
    </div>
  );
}
