"use client";

import {
  formatLpAllergenCodesForKitchen,
  normalizeLpAllergenCodes,
  type LpAllergenCode,
} from "@/lib/allergens/lpUserAllergens";

export type KitchenEmployeeAllergenExtraProps = {
  codes?: LpAllergenCode[] | string[] | null;
  free_text?: string | null;
};

export function hasKitchenEmployeeAllergenExtra(props: KitchenEmployeeAllergenExtraProps): boolean {
  const codes = normalizeLpAllergenCodes(props.codes ?? []);
  const text = String(props.free_text ?? "").trim();
  return codes.length > 0 || text.length > 0;
}

export default function KitchenEmployeeAllergenExtra({ codes, free_text }: KitchenEmployeeAllergenExtraProps) {
  const normalized = normalizeLpAllergenCodes(codes ?? []);
  const text = String(free_text ?? "").trim();
  if (!hasKitchenEmployeeAllergenExtra({ codes: normalized, free_text: text })) {
    return null;
  }

  return (
    <div
      className="mt-2 rounded-xl border border-sky-200 bg-sky-50/90 p-3 text-sm text-sky-950"
      role="region"
      aria-label="Ansatt har oppgitt ekstra allergeninfo"
    >
      <p className="text-xs font-bold uppercase tracking-wide text-sky-900">Ansatt har oppgitt (ekstra info)</p>
      <p className="mt-1 text-xs text-sky-900/90">
        Ikke garanti og ikke koblet til rett-allergener i menyen — kun det ansatt selv har valgt å dele.
      </p>
      {normalized.length > 0 ? (
        <ul className="mt-2 list-none space-y-1 text-sm">
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
      {text ? (
        <p className="mt-2 text-sm">
          <span className="font-medium">Fritekst: </span>
          {text}
        </p>
      ) : null}
    </div>
  );
}
