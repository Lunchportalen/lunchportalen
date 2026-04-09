"use client";

import type { EditorBlockFieldSchema } from "./blockFieldSchemas";

function kindLabel(kind: EditorBlockFieldSchema["kind"]): string {
  switch (kind) {
    case "text":
      return "Tekst";
    case "textarea":
      return "Tekstområde";
    case "url":
      return "URL / media-referanse";
    case "link":
      return "Lenke";
    case "number":
      return "Tall";
    case "select":
      return "Valgliste";
    case "media":
      return "Media (picker)";
    default:
      return String(kind);
  }
}

/**
 * U22 — Read-only tre-lags forklaring: schema (kontrakt) → felt → editor-UI brukes i `SchemaDrivenBlockForm`.
 */
export function PropertyDatasetExplainer({
  blockType,
  schema,
}: {
  blockType: string;
  schema: readonly EditorBlockFieldSchema[];
}) {
  if (!schema.length) return null;

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50/80 px-3 py-2 text-[11px] text-slate-800">
      <p className="font-semibold text-slate-900">Property dataset · {blockType}</p>
      <p className="mt-1 leading-relaxed text-slate-600">
        <strong className="font-medium text-slate-800">Skjema</strong> definerer datakontrakt og validering.{" "}
        <strong className="font-medium text-slate-800">UI</strong> rendres via felttyper (FieldRenderer) — samme kilde som
        public render, men med editor-hints der det er satt.
      </p>
      <div className="mt-2 overflow-x-auto">
        <table className="w-full min-w-[420px] border-collapse text-left text-[10px]">
          <thead>
            <tr className="border-b border-slate-200 text-slate-500">
              <th className="py-1 pr-2 font-medium">Felt (key)</th>
              <th className="py-1 pr-2 font-medium">Editor-type</th>
              <th className="py-1 font-medium">Kontrakt</th>
            </tr>
          </thead>
          <tbody className="text-slate-800">
            {schema.map((f) => (
              <tr key={f.key} className="border-b border-slate-100">
                <td className="py-1 pr-2 font-mono text-[10px]">{f.key}</td>
                <td className="py-1 pr-2">{kindLabel(f.kind)}</td>
                <td className="py-1">
                  {f.required ? "Påkrevd" : "Valgfri"}
                  {typeof f.maxLength === "number" ? ` · maks ${f.maxLength} tegn` : ""}
                  {f.options ? " · alternativer i schema" : ""}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
