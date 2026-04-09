"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { collectDescendantIds, findNode } from "./treeMock";
import type { ContentTreeNode } from "./treeTypes";
import { isContentPageUuid } from "./treeIds";

export type ContentTreeMoveDialogProps = {
  open: boolean;
  pageId: string;
  pageName: string;
  roots: ContentTreeNode[];
  onClose: () => void;
  onCompleted: () => void | Promise<void>;
};

function buildMoveTargets(roots: ContentTreeNode[], movingId: string): { value: string; label: string }[] {
  const desc = collectDescendantIds(roots, movingId);
  const out: { value: string; label: string }[] = [];
  function walk(nodes: ContentTreeNode[], depth: number) {
    for (const n of nodes) {
      if (n.id === movingId) continue;
      if (desc.has(n.id)) continue;
      if (n.id === "home") continue;
      if (n.id === "overlays" || n.id === "global" || n.id === "design") {
        out.push({ value: `root:${n.id}`, label: `${"  ".repeat(depth)}${n.name}` });
      } else if (isContentPageUuid(n.id)) {
        out.push({ value: `page:${n.id}`, label: `${"  ".repeat(depth)}${n.name}` });
      }
      if (n.children?.length) walk(n.children, depth + 1);
    }
  }
  walk(roots, 0);
  return out;
}

export function computeAppendSortOrder(roots: ContentTreeNode[], targetValue: string): number {
  if (targetValue.startsWith("root:")) {
    const rid = targetValue.slice(5);
    const children = findNode(roots, rid)?.children ?? [];
    const max = children.reduce((m, c) => Math.max(m, c.treeSortOrder ?? 0), -1);
    return max + 1;
  }
  if (targetValue.startsWith("page:")) {
    const pid = targetValue.slice(5);
    const children = findNode(roots, pid)?.children ?? [];
    const max = children.reduce((m, c) => Math.max(m, c.treeSortOrder ?? 0), -1);
    return max + 1;
  }
  return 0;
}

export default function ContentTreeMoveDialog({
  open,
  pageId,
  pageName,
  roots,
  onClose,
  onCompleted,
}: ContentTreeMoveDialogProps) {
  const baseId = useId();
  const options = useMemo(() => buildMoveTargets(roots, pageId), [roots, pageId]);
  const [selected, setSelected] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setSelected(options[0]?.value ?? "");
  }, [open, options]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  async function submit() {
    if (!selected) {
      setError("Velg et mål.");
      return;
    }
    let parent_page_id: string | null = null;
    let root_key: string | null = null;
    if (selected.startsWith("root:")) {
      root_key = selected.slice(5);
      parent_page_id = null;
    } else if (selected.startsWith("page:")) {
      parent_page_id = selected.slice(5);
      root_key = null;
    } else {
      setError("Ugyldig mål.");
      return;
    }
    const sort_order = computeAppendSortOrder(roots, selected);
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/backoffice/content/tree/move", {
        method: "POST",
        credentials: "include",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          page_id: pageId,
          parent_page_id,
          root_key,
          sort_order,
        }),
      });
      const json = (await res.json().catch(() => null)) as { ok?: boolean; message?: string; error?: string } | null;
      if (!res.ok || json?.ok === false) {
        setError(json?.message ?? json?.error ?? `Kunne ikke flytte (HTTP ${res.status}).`);
        return;
      }
      await onCompleted();
      onClose();
    } catch {
      setError("Nettverksfeil ved flytting.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4" role="presentation">
      <button
        type="button"
        className="absolute inset-0 bg-black/40"
        aria-label="Lukk"
        onClick={() => !submitting && onClose()}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${baseId}-title`}
        className="relative z-10 w-full max-w-md rounded-lg border border-slate-200 bg-white p-4 shadow-xl"
      >
        <h2 id={`${baseId}-title`} className="text-lg font-semibold text-slate-900">
          Flytt side
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          «{pageName}» flyttes til valgt mål. Slug og publisert URL endres ikke i denne operasjonen.
        </p>
        <label htmlFor={`${baseId}-target`} className="mt-4 block text-sm font-medium text-slate-700">
          Mål
        </label>
        <select
          id={`${baseId}-target`}
          className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
          disabled={submitting || options.length === 0}
        >
          {options.length === 0 ? (
            <option value="">Ingen gyldige mål</option>
          ) : (
            options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))
          )}
        </select>
        {error ? (
          <p className="mt-2 text-sm text-red-600" role="alert">
            {error}
          </p>
        ) : null}
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-800 hover:bg-slate-50"
            onClick={() => !submitting && onClose()}
          >
            Avbryt
          </button>
          <button
            type="button"
            className="rounded-md bg-slate-900 px-3 py-1.5 text-sm text-white hover:bg-slate-800 disabled:opacity-50"
            disabled={submitting || options.length === 0}
            onClick={() => void submit()}
          >
            {submitting ? "Flytter…" : "Flytt"}
          </button>
        </div>
      </div>
    </div>
  );
}
