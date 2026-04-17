"use client";

import type { Dispatch, ReactNode, SetStateAction } from "react";
import { getPropertyVariation } from "@/lib/cms/contentNodeEnvelope";
import type { PropertyTypeDefinition } from "@/lib/cms/schema/documentTypeDefinitions";
import type { ContentPage } from "./ContentWorkspaceState";
import { parseBodyEnvelope } from "./_stubs";

type EnvelopeFields = Record<string, unknown>;
/** `builderTop`: kompakte layout-/sidevalg over komponentlisten (ikke full dokumentskjema). */
type Tone = "detail" | "default" | "builderTop";

type Props = {
  tone?: Tone;
  sectionHeading?: string;
  showTopRule?: boolean;
  propsList: PropertyTypeDefinition[];
  invariantEnvelopeFields: EnvelopeFields;
  cultureEnvelopeFields: EnvelopeFields;
  setInvariantEnvelopeFields: Dispatch<SetStateAction<EnvelopeFields>>;
  setCultureEnvelopeFields: Dispatch<SetStateAction<EnvelopeFields>>;
};

function getFieldValue(
  prop: PropertyTypeDefinition,
  invariantEnvelopeFields: EnvelopeFields,
  cultureEnvelopeFields: EnvelopeFields,
) {
  const source = getPropertyVariation(prop) === "invariant" ? invariantEnvelopeFields : cultureEnvelopeFields;
  return source?.[prop.alias];
}

function setFieldValue(
  prop: PropertyTypeDefinition,
  nextValue: unknown,
  setInvariantEnvelopeFields: Dispatch<SetStateAction<EnvelopeFields>>,
  setCultureEnvelopeFields: Dispatch<SetStateAction<EnvelopeFields>>,
) {
  if (getPropertyVariation(prop) === "invariant") {
    setInvariantEnvelopeFields((prev) => ({
      ...prev,
      [prop.alias]: nextValue,
    }));
    return;
  }

  setCultureEnvelopeFields((prev) => ({
    ...prev,
    [prop.alias]: nextValue,
  }));
}

function coerceString(value: unknown): string {
  if (typeof value === "string") return value;
  if (value == null) return "";
  return String(value);
}

function coerceBoolean(value: unknown): boolean {
  return value === true;
}

function coerceNumberString(value: unknown): string {
  if (typeof value === "number") return String(value);
  if (typeof value === "string") return value;
  return "";
}

function guessEditorKind(prop: PropertyTypeDefinition): string {
  if (prop.dataTypeAlias === "cms_text_area") return "textarea";
  if (prop.dataTypeAlias === "cms_text_line") return "text";

  const editor = String(
    (prop as { editorAlias?: string }).editorAlias ||
      (prop as { editor?: string }).editor ||
      prop.dataTypeAlias ||
      "",
  )
    .toLowerCase()
    .trim();

  const alias = String(prop.alias || "").toLowerCase();

  if (
    editor.includes("textarea") ||
    editor.includes("richtext") ||
    editor.includes("rte") ||
    editor.includes("markdown") ||
    alias.includes("body") ||
    alias.includes("description") ||
    alias.includes("intro") ||
    alias.includes("excerpt")
  ) {
    return "textarea";
  }

  if (
    editor.includes("boolean") ||
    editor.includes("toggle") ||
    editor.includes("checkbox") ||
    alias.startsWith("is") ||
    alias.startsWith("has")
  ) {
    return "boolean";
  }

  if (
    editor.includes("number") ||
    editor.includes("numeric") ||
    editor.includes("integer") ||
    editor.includes("decimal")
  ) {
    return "number";
  }

  if (editor.includes("date") || alias.includes("date")) {
    return "date";
  }

  if (editor.includes("url") || alias.includes("url") || alias.includes("link")) {
    return "url";
  }

  return "text";
}

function FieldShell(props: {
  prop: PropertyTypeDefinition;
  tone: Tone;
  children: ReactNode;
}) {
  const { prop, tone, children } = props;
  const displayName = prop.title || prop.alias;
  const detail = tone === "detail";
  const builderTop = tone === "builderTop";

  if (builderTop) {
    return (
      <div
        className="min-w-0 space-y-1 rounded-md border border-slate-200/80 bg-white px-2 py-1.5 shadow-sm"
        data-lp-property-editor-field="true"
        data-lp-property-editor-alias={prop.alias}
        data-lp-scalar-field-layout="builder-compact"
      >
        <label
          className="block text-[10px] font-semibold uppercase tracking-wide text-slate-500"
          htmlFor={`lp-prop-${prop.alias}`}
        >
          {displayName}
        </label>
        {children}
      </div>
    );
  }

  return (
    <div
      className={detail ? "space-y-1 py-0.5" : "space-y-1.5 py-1"}
      data-lp-property-editor-field="true"
      data-lp-property-editor-alias={prop.alias}
    >
      <div className={detail ? "space-y-0.5" : "space-y-1"}>
        <label
          className={`block font-medium ${detail ? "text-[11px] text-slate-500" : "text-xs text-slate-700"}`}
          htmlFor={`lp-prop-${prop.alias}`}
        >
          {displayName}
        </label>
        {prop.description ? (
          <p
            className={`leading-snug ${detail ? "text-[11px] text-slate-400" : "text-xs leading-relaxed text-slate-500"}`}
          >
            {prop.description}
          </p>
        ) : null}
      </div>
      {children}
    </div>
  );
}

function TextEditor(props: {
  id: string;
  value: string;
  placeholder?: string;
  onChange: (next: string) => void;
  detailFlat?: boolean;
}) {
  const { id, value, placeholder, onChange, detailFlat } = props;
  return (
    <input
      id={id}
      type="text"
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className={
        detailFlat
          ? "w-full rounded border border-slate-200/90 bg-white px-2.5 py-1.5 text-[13px] text-slate-900 shadow-none transition-colors placeholder:text-slate-400 focus:border-slate-400 focus:outline-none focus:ring-0"
          : "w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm transition-colors placeholder:text-slate-400 focus:border-slate-400 focus:outline-none focus:ring-0"
      }
      autoComplete="off"
    />
  );
}

function UrlEditor(props: {
  id: string;
  value: string;
  placeholder?: string;
  onChange: (next: string) => void;
  detailFlat?: boolean;
}) {
  const { id, value, placeholder, onChange, detailFlat } = props;
  return (
    <input
      id={id}
      type="url"
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className={
        detailFlat
          ? "w-full rounded border border-slate-200/90 bg-white px-2.5 py-1.5 text-[13px] text-slate-900 shadow-none transition-colors placeholder:text-slate-400 focus:border-slate-400 focus:outline-none focus:ring-0"
          : "w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm transition-colors placeholder:text-slate-400 focus:border-slate-400 focus:outline-none focus:ring-0"
      }
      autoComplete="off"
    />
  );
}

function NumberEditor(props: {
  id: string;
  value: string;
  placeholder?: string;
  onChange: (next: string) => void;
  detailFlat?: boolean;
}) {
  const { id, value, placeholder, onChange, detailFlat } = props;
  return (
    <input
      id={id}
      type="number"
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className={
        detailFlat
          ? "w-full rounded border border-slate-200/90 bg-white px-2.5 py-1.5 text-[13px] text-slate-900 shadow-none transition-colors placeholder:text-slate-400 focus:border-slate-400 focus:outline-none focus:ring-0"
          : "w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm transition-colors placeholder:text-slate-400 focus:border-slate-400 focus:outline-none focus:ring-0"
      }
      autoComplete="off"
    />
  );
}

function DateEditor(props: {
  id: string;
  value: string;
  onChange: (next: string) => void;
  detailFlat?: boolean;
}) {
  const { id, value, onChange, detailFlat } = props;
  return (
    <input
      id={id}
      type="date"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={
        detailFlat
          ? "w-full rounded border border-slate-200/90 bg-white px-2.5 py-1.5 text-[13px] text-slate-900 shadow-none transition-colors focus:border-slate-400 focus:outline-none focus:ring-0"
          : "w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm transition-colors focus:border-slate-400 focus:outline-none focus:ring-0"
      }
    />
  );
}

function TextareaEditor(props: {
  id: string;
  value: string;
  placeholder?: string;
  rows?: number;
  onChange: (next: string) => void;
  detailFlat?: boolean;
}) {
  const { id, value, placeholder, rows = 5, onChange, detailFlat } = props;
  return (
    <textarea
      id={id}
      value={value}
      placeholder={placeholder}
      rows={detailFlat ? Math.min(rows, 4) : rows}
      onChange={(e) => onChange(e.target.value)}
      className={
        detailFlat
          ? "min-h-[96px] w-full rounded border border-slate-200/90 bg-white px-2.5 py-1.5 text-[13px] leading-relaxed text-slate-900 shadow-none transition-colors placeholder:text-slate-400 focus:border-slate-400 focus:outline-none focus:ring-0"
          : "min-h-[120px] w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm leading-relaxed text-slate-900 shadow-sm transition-colors placeholder:text-slate-400 focus:border-slate-400 focus:outline-none focus:ring-0"
      }
    />
  );
}

function BooleanEditor(props: {
  id: string;
  value: boolean;
  onChange: (next: boolean) => void;
}) {
  const { id, value, onChange } = props;

  return (
    <label htmlFor={id} className="flex items-center gap-3 py-1 text-sm text-slate-800">
      <input
        id={id}
        type="checkbox"
        checked={value}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-0"
      />
      <span>Aktiver</span>
    </label>
  );
}

function UnsupportedEditor(props: {
  rawValue: unknown;
  detailFlat?: boolean;
}) {
  const { rawValue, detailFlat } = props;
  return (
    <div
      className={
        detailFlat
          ? "rounded border border-slate-200/80 bg-slate-50/80 px-2.5 py-1.5 text-[13px] text-slate-600"
          : "rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600"
      }
    >
      {rawValue == null ? "Ingen verdi" : String(rawValue)}
    </div>
  );
}

function renderEditor(props: {
  prop: PropertyTypeDefinition;
  tone: Tone;
  invariantEnvelopeFields: EnvelopeFields;
  cultureEnvelopeFields: EnvelopeFields;
  setInvariantEnvelopeFields: Dispatch<SetStateAction<EnvelopeFields>>;
  setCultureEnvelopeFields: Dispatch<SetStateAction<EnvelopeFields>>;
}) {
  const {
    prop,
    tone,
    invariantEnvelopeFields,
    cultureEnvelopeFields,
    setInvariantEnvelopeFields,
    setCultureEnvelopeFields,
  } = props;

  const detailFlat = tone === "detail" || tone === "builderTop";
  const rawValue = getFieldValue(prop, invariantEnvelopeFields, cultureEnvelopeFields);
  const editorKind = guessEditorKind(prop);
  const fieldId = `lp-prop-${prop.alias}`;
  const commit = (nextValue: unknown) =>
    setFieldValue(prop, nextValue, setInvariantEnvelopeFields, setCultureEnvelopeFields);
  const displayName = prop.title || prop.alias;

  switch (editorKind) {
    case "text":
      return (
        <TextEditor
          id={fieldId}
          value={coerceString(rawValue)}
          placeholder={displayName}
          onChange={commit}
          detailFlat={detailFlat}
        />
      );
    case "url":
      return (
        <UrlEditor
          id={fieldId}
          value={coerceString(rawValue)}
          placeholder="https://"
          onChange={commit}
          detailFlat={detailFlat}
        />
      );
    case "number":
      return (
        <NumberEditor
          id={fieldId}
          value={coerceNumberString(rawValue)}
          placeholder="0"
          onChange={(next) => commit(next)}
          detailFlat={detailFlat}
        />
      );
    case "date":
      return (
        <DateEditor id={fieldId} value={coerceString(rawValue)} onChange={commit} detailFlat={detailFlat} />
      );
    case "textarea":
      return (
        <TextareaEditor
          id={fieldId}
          value={coerceString(rawValue)}
          placeholder={displayName}
          rows={tone === "builderTop" ? 3 : 5}
          onChange={commit}
          detailFlat={detailFlat}
        />
      );
    case "boolean":
      return <BooleanEditor id={fieldId} value={coerceBoolean(rawValue)} onChange={commit} />;
    default:
      return <UnsupportedEditor rawValue={rawValue} detailFlat={detailFlat} />;
  }
}

export function DocumentScalarPropertyEditors(props: Props) {
  const {
    tone = "default",
    sectionHeading,
    showTopRule = false,
    propsList,
    invariantEnvelopeFields,
    cultureEnvelopeFields,
    setInvariantEnvelopeFields,
    setCultureEnvelopeFields,
  } = props;

  if (!propsList.length) return null;

  const gap = tone === "detail" ? "space-y-2.5" : tone === "builderTop" ? "" : "space-y-5";
  const gridBuilder =
    tone === "builderTop"
      ? "grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3"
      : null;

  return (
    <div
      className={`${gap} ${showTopRule ? "border-t border-slate-100 pt-5" : ""}`}
      data-lp-document-scalar-property-editors="true"
      data-lp-document-scalar-tone={tone}
    >
      {sectionHeading ? <h3 className="text-sm font-medium text-slate-900">{sectionHeading}</h3> : null}
      <div className={gridBuilder ?? gap}>
        {propsList.map((prop) => (
          <FieldShell key={prop.alias} prop={prop} tone={tone}>
            {renderEditor({
              prop,
              tone,
              invariantEnvelopeFields,
              cultureEnvelopeFields,
              setInvariantEnvelopeFields,
              setCultureEnvelopeFields,
            })}
          </FieldShell>
        ))}
      </div>
    </div>
  );
}

/** Bevares for høyrekolonne (sekundær); ikke del av skalar-editorene over. */
export function DocumentDetailLocaleSection(props: {
  editorLocale: string;
  setEditorLocale: Dispatch<SetStateAction<string>>;
  page: ContentPage | null;
}) {
  const { editorLocale, setEditorLocale, page } = props;
  return (
    <section
      className="space-y-4 border-0 bg-transparent p-0"
      data-lp-cms-variant-context
      data-lp-current-culture={editorLocale}
      data-lp-publish-state={page?.status ?? ""}
    >
      <div className="flex flex-wrap gap-2" data-lp-cms-locale-switch>
        {(["nb", "en"] as const).map((loc) => (
          <button
            key={loc}
            type="button"
            onClick={() => setEditorLocale(loc)}
            className={`min-h-10 rounded-full border px-3 text-xs font-semibold transition-colors ${
              editorLocale === loc
                ? "border-slate-400 bg-slate-50 text-slate-900"
                : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
            }`}
            data-lp-cms-locale={loc}
          >
            {loc === "nb" ? "nb · Norsk" : "en · English"}
          </button>
        ))}
      </div>
      {page?.body ? (
        <div className="rounded-md border border-slate-200/80 bg-slate-50/50 px-3 py-2 text-[11px] text-slate-600">
          <span className="font-semibold text-[rgb(var(--lp-text))]">Publiseringslag (variant-rad):</span>{" "}
          <span data-lp-cms-variant-publish>
            {parseBodyEnvelope(page.body).cmsVariantPublish?.state === "published" ? "Publisert (echo)" : "Utkast (echo)"}
          </span>
          <span className="mx-1">·</span>
          <span className="font-semibold">Side:</span> {page.status}
        </div>
      ) : null}
    </section>
  );
}
