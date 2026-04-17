"use client";

import type { EditorBlockFieldSchema } from "../../app/(backoffice)/backoffice/content/_components/blockFieldSchemas";
import { REQUIRED_FIELD_MESSAGE } from "../../app/(backoffice)/backoffice/content/_components/blockFieldSchemas";

export type FieldRendererProps = {
  field: EditorBlockFieldSchema;
  value: string;
  error?: string | null;
  id: string;
  onChange: (key: string, value: string | number) => void;
  onBlur: (key: string) => void;
  /** Merged required flag (schema + layout.requiredKeys). */
  effectiveRequired?: boolean;
  /** For dual link: current internal/external hint from block. */
  linkKindValue?: string;
  /** Apply multiple keys in one update (href + kind). */
  onPatch?: (patch: Record<string, string | number>) => void;
  /** Opens embedded media picker for `kind === "media"`. */
  onOpenMediaPicker?: (fieldKey: string) => void;
  /** Clear media ref + optional archive id (parent merges into block). */
  onClearMediaField?: (fieldKey: string) => void;
  /** Opens internal page picker (dual link, internal mode). */
  onOpenInternalLinkPicker?: (fieldKey: string) => void;
};

function errorStyles(isRequiredError: boolean, hasError: boolean): string {
  if (!hasError) return "border-[rgb(var(--lp-border))]";
  return isRequiredError ? "border-red-400 bg-red-50/40" : "border-amber-400 bg-amber-50/50";
}

function ErrorText({ message, required }: { message: string; required: boolean }) {
  const isReq = required && message === REQUIRED_FIELD_MESSAGE;
  return (
    <p
      className={`mt-1 text-xs ${isReq ? "text-red-500" : "text-amber-700"}`}
      role="alert"
    >
      {message}
    </p>
  );
}

function MediaPreviewThumb({ url }: { url: string }) {
  const t = url.trim();
  const showImg =
    t &&
    (t.startsWith("http://") || t.startsWith("https://") || t.startsWith("/") || t.startsWith("data:"));
  if (!showImg) {
    return (
      <div
        className="flex h-16 w-24 shrink-0 items-center justify-center rounded-lg border border-dashed border-[rgb(var(--lp-border))] bg-[rgb(var(--lp-card))] text-[10px] text-[rgb(var(--lp-muted))]"
        aria-hidden
      >
        Ingen forhåndsvisning
      </div>
    );
  }
  return (
    /* eslint-disable-next-line @next/next/no-img-element */
    <img
      src={t}
      alt=""
      className="h-16 w-24 shrink-0 rounded-lg border border-[rgb(var(--lp-border))] object-cover"
      onError={(e) => {
        (e.target as HTMLImageElement).style.display = "none";
      }}
    />
  );
}

/**
 * Renders one schema-driven CMS field (text, textarea, media, link, select, number, url).
 */
export function FieldRenderer({
  field,
  value,
  error,
  id,
  onChange,
  onBlur,
  effectiveRequired = false,
  linkKindValue = "",
  onPatch,
  onOpenMediaPicker,
  onClearMediaField,
  onOpenInternalLinkPicker,
}: FieldRendererProps) {
  const req = effectiveRequired || Boolean(field.required);
  const hasErr = Boolean(error);
  const isReqErr = error === REQUIRED_FIELD_MESSAGE;

  if (field.kind === "link" && field.linkVariant === "dual" && onPatch && field.linkKindKey) {
    const kindRaw = linkKindValue.toLowerCase();
    const href = value.trim();
    const mode: "internal" | "external" =
      kindRaw === "internal" || kindRaw === "external"
        ? kindRaw
        : href.startsWith("http://") || href.startsWith("https://")
          ? "external"
          : "internal";

    const setMode = (next: "internal" | "external") => {
      onPatch({
        [field.key]: value,
        [field.linkKindKey!]: next,
      });
    };

    return (
      <div className="grid gap-1 text-sm">
        <span className="text-[rgb(var(--lp-muted))]">{field.label}</span>
        <div
          className={`rounded-lg border p-3 ${errorStyles(error === REQUIRED_FIELD_MESSAGE, Boolean(error))}`}
        >
          <div className="mb-2 flex gap-1 rounded-lg bg-[rgb(var(--lp-card))] p-0.5">
            <button
              type="button"
              onClick={() => setMode("internal")}
              className={`flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition-colors ${
                mode === "internal"
                  ? "bg-white text-[rgb(var(--lp-text))] shadow-sm"
                  : "text-[rgb(var(--lp-muted))] hover:text-[rgb(var(--lp-text))]"
              }`}
            >
              Intern side
            </button>
            <button
              type="button"
              onClick={() => setMode("external")}
              className={`flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition-colors ${
                mode === "external"
                  ? "bg-white text-[rgb(var(--lp-text))] shadow-sm"
                  : "text-[rgb(var(--lp-muted))] hover:text-[rgb(var(--lp-text))]"
              }`}
            >
              Ekstern lenke
            </button>
          </div>
          {mode === "internal" ? (
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="min-w-0 flex-1 break-all font-mono text-[11px] text-[rgb(var(--lp-text))]">
                  {href && !href.startsWith("http") ? href : "— Velg side —"}
                </span>
                <button
                  type="button"
                  onClick={() => onOpenInternalLinkPicker?.(field.key)}
                  className="shrink-0 rounded-lg border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800"
                >
                  Velg side
                </button>
              </div>
              <p className="text-[10px] text-[rgb(var(--lp-muted))]">
                Lagres som sti (f.eks. /om-oss). Offentlig visning bruker samme href.
              </p>
            </div>
          ) : (
            <input
              id={id}
              type="url"
              value={value}
              onChange={(e) =>
                onPatch({
                  [field.key]: e.target.value,
                  [field.linkKindKey!]: "external",
                })
              }
              onBlur={() => onBlur(field.key)}
              placeholder={field.placeholder ?? "https://…"}
              className="h-10 w-full rounded-lg border border-[rgb(var(--lp-border))] px-3 text-sm"
            />
          )}
        </div>
        {error ? <ErrorText message={error} required={req} /> : null}
      </div>
    );
  }

  if (field.kind === "textarea") {
    return (
      <label htmlFor={id} className="grid gap-1 text-sm">
        <span className="text-[rgb(var(--lp-muted))]">
          {field.label}
          {req ? " *" : ""}
        </span>
        <textarea
          id={id}
          value={value}
          onChange={(e) => onChange(field.key, e.target.value)}
          onBlur={() => onBlur(field.key)}
          placeholder={field.placeholder}
          maxLength={field.maxLength ?? undefined}
          className={`min-h-24 rounded-lg border px-3 py-2 text-sm ${errorStyles(isReqErr, hasErr)}`}
        />
        {error ? <ErrorText message={error} required={req} /> : null}
      </label>
    );
  }

  if (field.kind === "select") {
    const options = field.options ?? {};
    return (
      <label htmlFor={id} className="grid gap-1 text-sm">
        <span className="text-[rgb(var(--lp-muted))]">{field.label}</span>
        <select
          id={id}
          value={value || (Object.keys(options)[0] ?? "")}
          onChange={(e) => onChange(field.key, e.target.value)}
          onBlur={() => onBlur(field.key)}
          className={`h-10 rounded-lg border px-3 text-sm ${errorStyles(isReqErr, hasErr)}`}
        >
          {Object.entries(options).map(([optValue, label]) => (
            <option key={optValue} value={optValue}>
              {label}
            </option>
          ))}
        </select>
        {error ? <ErrorText message={error} required={req} /> : null}
      </label>
    );
  }

  if (field.kind === "number") {
    const num = value === "" ? "" : Number(value);
    return (
      <label htmlFor={id} className="grid gap-1 text-sm">
        <span className="text-[rgb(var(--lp-muted))]">{field.label}</span>
        <input
          id={id}
          type="number"
          value={num}
          onChange={(e) => {
            const v = e.target.value;
            onChange(field.key, v === "" ? "" : Number(v));
          }}
          onBlur={() => onBlur(field.key)}
          placeholder={field.placeholder}
          className={`h-10 rounded-lg border px-3 text-sm ${errorStyles(isReqErr, hasErr)}`}
        />
        {error ? <ErrorText message={error} required={req} /> : null}
      </label>
    );
  }

  if (field.kind === "media") {
    return (
      <div className="grid gap-1 text-sm">
        <span className="text-[rgb(var(--lp-muted))]">
          {field.label}
          {req ? " *" : ""}
        </span>
        <div className={`flex flex-wrap items-center gap-3 rounded-lg border p-3 ${errorStyles(isReqErr, hasErr)}`}>
          <MediaPreviewThumb url={value} />
          <div className="min-w-0 flex-1">
            <p className="break-all font-mono text-[11px] text-[rgb(var(--lp-text))]">
              {value.trim() ? value : "— Ikke valgt —"}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => onOpenMediaPicker?.(field.key)}
                className="rounded-lg border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800"
              >
                Velg fra mediearkiv
              </button>
              {value.trim() && onClearMediaField ? (
                <button
                  type="button"
                  onClick={() => onClearMediaField(field.key)}
                  className="rounded-lg border border-[rgb(var(--lp-border))] bg-white px-3 py-1.5 text-xs font-medium text-[rgb(var(--lp-text))] hover:bg-[rgb(var(--lp-card))]"
                >
                  Fjern
                </button>
              ) : null}
            </div>
          </div>
        </div>
        {error ? <ErrorText message={error} required={req} /> : null}
      </div>
    );
  }

  const inputType = field.kind === "url" ? "url" : "text";
  return (
    <label htmlFor={id} className="grid gap-1 text-sm">
      <span className="text-[rgb(var(--lp-muted))]">
        {field.label}
        {req ? " *" : ""}
      </span>
      <input
        id={id}
        type={inputType}
        value={value}
        onChange={(e) => onChange(field.key, e.target.value)}
        onBlur={() => onBlur(field.key)}
        placeholder={field.placeholder}
        maxLength={field.maxLength ?? undefined}
        className={`h-10 rounded-lg border px-3 text-sm ${errorStyles(isReqErr, hasErr)}`}
      />
      {field.maxLength != null && !error ? (
        <span className="text-[10px] text-[rgb(var(--lp-muted))]">
          {value.length}/{field.maxLength}
        </span>
      ) : null}
      {error ? <ErrorText message={error} required={req} /> : null}
    </label>
  );
}
