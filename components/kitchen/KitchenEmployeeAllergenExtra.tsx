"use client";

import {
  formatLpAllergenCodesForKitchen,
  normalizeLpAllergenCodes,
  resolveEmployeeAllergenProfileStatus,
  type KitchenEmployeeAllergenProfileStatus,
  type LpAllergenCode,
} from "@/lib/allergens/lpUserAllergens";

export type KitchenEmployeeAllergenExtraProps = {
  status?: KitchenEmployeeAllergenProfileStatus;
  codes?: LpAllergenCode[] | string[] | null;
  free_text?: string | null;
  /** Compact styling for /kitchen/print production sheets. */
  variant?: "panel" | "print";
};

function resolveStatus(props: KitchenEmployeeAllergenExtraProps): KitchenEmployeeAllergenProfileStatus {
  if (props.status) return props.status;
  const codes = normalizeLpAllergenCodes(props.codes ?? []);
  const text = String(props.free_text ?? "").trim();
  if (codes.length > 0 || text.length > 0) return "has_data";
  return "unknown";
}

const STATE_COPY: Record<
  KitchenEmployeeAllergenProfileStatus,
  { title: string; body: string; icon: string; aria: string }
> = {
  has_data: {
    title: "Ansatt har oppgitt (ekstra info)",
    body: "Ikke garanti og ikke koblet til rett-allergener i menyen — kun det ansatt selv har valgt å dele.",
    icon: "✓",
    aria: "Ansatt har oppgitt ekstra allergeninfo",
  },
  declared_empty: {
    title: "Ingen allergener oppgitt",
    body: "Ansatt har lagret profilen uten valgte allergener og uten fritekst — ekstra info til kjøkkenet.",
    icon: "○",
    aria: "Ansatt har bekreftet ingen allergener oppgitt",
  },
  unknown: {
    title: "Ikke utfylt / ukjent",
    body: "Ansatt har ikke lagret allergenprofil. Behandle som ukjent — ikke anta fravær av allergener.",
    icon: "?",
    aria: "Allergenprofil ikke utfylt eller ukjent",
  },
};

const PANEL_STYLES: Record<KitchenEmployeeAllergenProfileStatus, string> = {
  has_data: "border-sky-200 bg-sky-50/90 text-sky-950",
  declared_empty: "border-emerald-300 bg-emerald-50/95 text-emerald-950",
  unknown: "border-amber-300 bg-amber-50/95 text-amber-950",
};

/** Print: monochrome-safe — distinction via icon + label only (survives B&W / grayscale). */
const PRINT_BOX_CLASS =
  "border border-slate-500 bg-white text-slate-900 print:border-black print:bg-white print:text-black";
const PRINT_TITLE_CLASS = "text-slate-900 print:text-black";

export default function KitchenEmployeeAllergenExtra({
  status: statusProp,
  codes,
  free_text,
  variant = "panel",
}: KitchenEmployeeAllergenExtraProps) {
  const status = resolveStatus({ status: statusProp, codes, free_text });
  const normalized = normalizeLpAllergenCodes(codes ?? []);
  const text = String(free_text ?? "").trim();
  const copy = STATE_COPY[status];
  const compact = variant === "print";
  const boxClass = compact ? PRINT_BOX_CLASS : PANEL_STYLES[status];
  const titleClass = compact
    ? PRINT_TITLE_CLASS
    : status === "has_data"
      ? "text-sky-900"
      : status === "declared_empty"
        ? "text-emerald-900"
        : "text-amber-900";
  const bodyClass = compact
    ? "text-slate-800 print:text-black"
    : status === "has_data"
      ? "text-sky-900/90"
      : status === "declared_empty"
        ? "text-emerald-900/90"
        : "text-amber-900/90";

  return (
    <div
      className={`${compact ? "mt-1 rounded-lg border px-2 py-1.5 text-xs" : "mt-2 rounded-xl border p-3 text-sm"} ${boxClass}`}
      role="region"
      aria-label={copy.aria}
      data-allergen-profile-status={status}
      data-allergen-variant={variant}
    >
      <p
        className={`font-bold uppercase tracking-wide ${compact ? "text-[10px]" : "text-xs"} ${titleClass}`}
      >
        <span aria-hidden="true" className="mr-1.5 font-bold">
          {copy.icon}
        </span>
        {copy.title}
      </p>
      {!compact ? (
        <p className={`mt-1 text-xs ${bodyClass}`}>{copy.body}</p>
      ) : null}
      {status === "has_data" && normalized.length > 0 ? (
        <ul className={`list-none space-y-0.5 ${compact ? "mt-1" : "mt-2"} ${compact ? "text-xs" : "text-sm"}`}>
          {normalized.map((code) => (
            <li key={code} className="flex items-start gap-2">
              <span className="font-semibold" aria-hidden="true">
                ✓
              </span>
              <span>{formatLpAllergenCodesForKitchen([code])}</span>
            </li>
          ))}
        </ul>
      ) : null}
      {status === "has_data" && text ? (
        <p className={`${compact ? "mt-1 text-xs" : "mt-2 text-sm"}`}>
          <span className="font-medium">Fritekst: </span>
          {text}
        </p>
      ) : null}
    </div>
  );
}

/** @deprecated Use resolveEmployeeAllergenProfileStatus + status prop. */
export function hasKitchenEmployeeAllergenExtra(props: KitchenEmployeeAllergenExtraProps): boolean {
  return resolveEmployeeAllergenProfileStatus(
    props.status === "declared_empty"
      ? { codes: [], free_text: "" }
      : props.status === "unknown"
        ? null
        : { codes: props.codes, free_text: props.free_text },
  ) === "has_data";
}
