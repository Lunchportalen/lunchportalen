// components/superadmin/FirmsTable.tsx
"use client";

import Link from "next/link";
import { createPortal } from "react-dom";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import React, { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import type { CompanyStatus, FirmsQueryResult, FirmsSortKey, SortDir } from "@/lib/superadmin/types";

function cx(...a: Array<string | false | null | undefined>) {
  return a.filter(Boolean).join(" ");
}
function buildUrl(pathname: string, params: URLSearchParams) {
  const qs = params.toString();
  return qs.length ? `${pathname}?${qs}` : pathname;
}
function setParam(params: URLSearchParams, key: string, value: string, removeIfEmpty = true) {
  const v = value.trim();
  if (removeIfEmpty && !v) params.delete(key);
  else params.set(key, v);
}

const STATUS_OPTIONS: Array<{ label: string; value: CompanyStatus | "ALL" }> = [
  { label: "Alle", value: "ALL" },
  { label: "Active", value: "ACTIVE" },
  { label: "Paused", value: "PAUSED" },
  { label: "Closed", value: "CLOSED" },
];
const PAGE_SIZES = [25, 50, 100] as const;

/** ✅ Viktig: UI skal tåle status i både lower/upper-case */
function normalizeUiStatus(v: any): CompanyStatus {
  const up = String(v ?? "").trim().toUpperCase();
  if (up === "ACTIVE" || up === "PAUSED" || up === "CLOSED") return up as CompanyStatus;
  return "CLOSED";
}

function StatusPill({ status }: { status: CompanyStatus }) {
  const base = "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium";
  if (status === "ACTIVE") return <span className={cx(base, "bg-green-50 text-green-700")}>Active</span>;
  if (status === "PAUSED") return <span className={cx(base, "bg-yellow-50 text-yellow-700")}>Paused</span>;
  return <span className={cx(base, "bg-red-50 text-red-700")}>Closed</span>;
}

function PlanPill({ plan }: { plan: string }) {
  const p = String(plan ?? "").toUpperCase();
  const base = "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium";
  if (p === "BASIS") return <span className={cx(base, "bg-blue-50 text-blue-700")}>BASIS</span>;
  if (p === "LUXUS") return <span className={cx(base, "bg-purple-50 text-purple-700")}>LUXUS</span>;
  return <span className={cx(base, "bg-gray-50 text-gray-700")}>{p || "—"}</span>;
}

function fmtBinding(v: unknown) {
  if (typeof v !== "number" || !Number.isFinite(v)) return "—";
  return `${v} mnd`;
}

function Th(props: { label: string; active: boolean; dir: SortDir; onClick: () => void }) {
  return (
    <th className="p-3">
      <button
        type="button"
        onClick={props.onClick}
        className={cx(
          "inline-flex items-center gap-2 rounded-lg px-2 py-1 hover:bg-bg/70",
          props.active && "font-semibold text-foreground"
        )}
      >
        {props.label}
        {props.active ? <span className="text-xs text-muted-foreground">{props.dir === "asc" ? "▲" : "▼"}</span> : null}
      </button>
    </th>
  );
}

function useOutsideClick(ref: React.RefObject<HTMLElement>, onClose: () => void, enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    function onDown(e: MouseEvent) {
      const el = ref.current;
      if (!el) return;
      if (el.contains(e.target as Node)) return;
      onClose();
    }
    window.addEventListener("mousedown", onDown, true);
    return () => window.removeEventListener("mousedown", onDown, true);
  }, [ref, onClose, enabled]);
}

function StatusMenuPortal(props: {
  open: boolean;
  anchorRect: DOMRect | null;
  current: CompanyStatus;
  busy?: boolean;
  onPick: (s: CompanyStatus) => void;
  onClose: () => void;
}) {
  const { open, anchorRect, current, busy, onPick, onClose } = props;
  const menuRef = useRef<HTMLDivElement>(null);

  useOutsideClick(menuRef, onClose, open);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || !anchorRect) return null;
  if (typeof document === "undefined") return null;

  const width = 260;
  const top = Math.round(anchorRect.bottom + 8);
  const left = Math.round(anchorRect.right - width);

  const item = (label: string, value: CompanyStatus, danger = false) => (
    <button
      type="button"
      disabled={busy || value === current}
      onClick={() => onPick(value)}
      className={cx(
        "flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm",
        "hover:bg-bg",
        (busy || value === current) && "opacity-50",
        danger && "text-red-600"
      )}
    >
      <span>{label}</span>
      {value === current ? <span className="text-xs text-muted-foreground">nå</span> : null}
    </button>
  );

  return createPortal(
    <div className="fixed inset-0 z-[99999]" aria-hidden={!open}>
      <button type="button" onClick={onClose} className="absolute inset-0 cursor-default" aria-label="Lukk" />
      <div
        ref={menuRef}
        className="absolute w-[260px] rounded-2xl border bg-surface p-2 shadow-xl"
        style={{ top, left }}
      >
        <div className="px-3 pb-2 pt-1 text-xs font-semibold text-muted-foreground">Sett status</div>
        {item("Sett Active", "ACTIVE")}
        {item("Sett Paused", "PAUSED")}
        {item("Sett Closed", "CLOSED", true)}
      </div>
    </div>,
    document.body
  );
}

async function readJsonSafe(res: Response) {
  const t = await res.text();
  if (!t) return null;
  try {
    return JSON.parse(t);
  } catch {
    return null;
  }
}

export default function FirmsTable({ initial }: { initial: FirmsQueryResult }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const [q, setQ] = useState(initial.q);
  const [status, setStatus] = useState<CompanyStatus | "ALL">(initial.status);
  const [sortKey, setSortKey] = useState<FirmsSortKey>(initial.sortKey);
  const [sortDir, setSortDir] = useState<SortDir>(initial.sortDir);
  const [pageSize, setPageSize] = useState<number>(initial.pageSize);

  const debounceRef = useRef<number | null>(null);

  // status update UI
  const [updateError, setUpdateError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  // menu state (single portal)
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);
  const [menuCurrentStatus, setMenuCurrentStatus] = useState<CompanyStatus>("ACTIVE");

  const rows = initial.rows;
  const page = initial.page;
  const totalPages = initial.totalPages;

  const closeMenu = useCallback(() => {
    setMenuFor(null);
    setAnchorRect(null);
  }, []);

  // keep local controls synced with URL
  useEffect(() => {
    const urlQ = sp.get("q") ?? "";
    const urlStatusRaw = (sp.get("status") ?? "ALL").toUpperCase();
    const urlStatus =
      urlStatusRaw === "ACTIVE" || urlStatusRaw === "PAUSED" || urlStatusRaw === "CLOSED"
        ? (urlStatusRaw as CompanyStatus)
        : "ALL";

    const urlSortKey = (sp.get("sortKey") ?? initial.sortKey) as FirmsSortKey;
    const safeSortKey =
      urlSortKey === "name" || urlSortKey === "status" || urlSortKey === "created_at" ? urlSortKey : initial.sortKey;

    const urlSortDir = (sp.get("sortDir") ?? initial.sortDir) as SortDir;
    const safeSortDir: SortDir = urlSortDir === "asc" ? "asc" : "desc";

    const urlPageSize = Number(sp.get("pageSize") ?? initial.pageSize);
    const safePageSize = PAGE_SIZES.includes(urlPageSize as any) ? urlPageSize : initial.pageSize;

    setQ(urlQ);
    setStatus(urlStatus);
    setSortKey(safeSortKey);
    setSortDir(safeSortDir);
    setPageSize(safePageSize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sp]);

  // clear debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  }, []);

  const summary = useMemo(() => {
    if (!initial.total) return "0 treff";
    const from = (page - 1) * initial.pageSize + 1;
    const to = Math.min(page * initial.pageSize, initial.total);
    return `${from}–${to} av ${initial.total}`;
  }, [initial.total, initial.pageSize, page]);

  function pushParams(
    next: Partial<{
      q: string;
      status: CompanyStatus | "ALL";
      page: number;
      pageSize: number;
      sortKey: FirmsSortKey;
      sortDir: SortDir;
    }>
  ) {
    const params = new URLSearchParams(sp.toString());

    if (next.q !== undefined) setParam(params, "q", next.q);
    if (next.status !== undefined) setParam(params, "status", next.status === "ALL" ? "" : next.status);
    if (next.page !== undefined) setParam(params, "page", String(next.page));
    if (next.pageSize !== undefined) setParam(params, "pageSize", String(next.pageSize));
    if (next.sortKey !== undefined) setParam(params, "sortKey", next.sortKey);
    if (next.sortDir !== undefined) setParam(params, "sortDir", next.sortDir);

    if (!params.get("page")) params.set("page", "1");

    startTransition(() => router.replace(buildUrl(pathname, params)));
  }

  function onChangeQ(value: string) {
    setQ(value);
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => pushParams({ q: value, page: 1 }), 250);
  }

  function onChangeStatus(value: CompanyStatus | "ALL") {
    setStatus(value);
    pushParams({ status: value, page: 1 });
  }

  function onChangePageSize(value: number) {
    setPageSize(value);
    pushParams({ pageSize: value, page: 1 });
  }

  function toggleSort(nextKey: FirmsSortKey) {
    if (sortKey === nextKey) {
      const nextDir: SortDir = sortDir === "asc" ? "desc" : "asc";
      setSortDir(nextDir);
      pushParams({ sortDir: nextDir, page: 1 });
      return;
    }
    const nextDir: SortDir = nextKey === "name" ? "asc" : "desc";
    setSortKey(nextKey);
    setSortDir(nextDir);
    pushParams({ sortKey: nextKey, sortDir: nextDir, page: 1 });
  }

  function goPage(nextPage: number) {
    const p = Math.max(1, Math.min(totalPages, nextPage));
    pushParams({ page: p });
  }

  function openMenu(companyId: string, current: CompanyStatus, el: HTMLElement) {
    setUpdateError(null);
    setMenuCurrentStatus(current);
    setMenuFor(companyId);
    setAnchorRect(el.getBoundingClientRect());
  }

  async function changeStatus(companyId: string, next: CompanyStatus) {
    setUpdateError(null);
    setBusyId(companyId);

    try {
      const res = await fetch(`/api/superadmin/firms/${encodeURIComponent(companyId)}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({ status: next }),
      });

      const json: any = await readJsonSafe(res);

      if (!res.ok || !json?.ok) {
        const msg = String(json?.message ?? json?.error ?? "UPDATE_FAILED");
        const detail = json?.detail
          ? `: ${typeof json.detail === "string" ? json.detail : JSON.stringify(json.detail)}`
          : "";
        throw new Error(`${msg}${detail}`);
      }

      closeMenu();
      startTransition(() => router.refresh());
    } catch (e: any) {
      setUpdateError(String(e?.message || "UPDATE_FAILED"));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="rounded-2xl border bg-surface">
      <div className="flex flex-col gap-3 border-b bg-bg p-4 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-col gap-2 md:flex-row md:items-center">
          <div className="relative">
            <input
              value={q}
              onChange={(e) => onChangeQ(e.target.value)}
              placeholder="Søk firma…"
              className="w-full rounded-xl border bg-surface px-3 py-2 text-sm outline-none md:w-80"
            />
            {q.length > 0 && (
              <button
                type="button"
                onClick={() => onChangeQ("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg px-2 py-1 text-xs text-muted-foreground hover:bg-bg"
              >
                Tøm
              </button>
            )}
          </div>

          <select
            value={status}
            onChange={(e) => onChangeStatus(e.target.value as any)}
            className="rounded-xl border bg-surface px-3 py-2 text-sm"
          >
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>

          <select
            value={pageSize}
            onChange={(e) => onChangePageSize(Number(e.target.value))}
            className="rounded-xl border bg-surface px-3 py-2 text-sm"
          >
            {PAGE_SIZES.map((s) => (
              <option key={s} value={s}>
                {s} / side
              </option>
            ))}
          </select>

          <div className="text-sm text-muted-foreground">{isPending ? "Oppdaterer…" : summary}</div>
        </div>

        <div className="text-xs text-muted-foreground">
          Dato: <span className="font-medium text-foreground">{initial.todayISO ?? "—"}</span>
        </div>
      </div>

      {updateError ? <div className="border-b bg-red-50 px-4 py-3 text-sm text-red-700">{updateError}</div> : null}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[980px] text-sm">
          <thead className="border-b bg-bg">
            <tr className="text-left text-xs font-semibold text-muted-foreground">
              <Th label="Firma" active={sortKey === "name"} dir={sortDir} onClick={() => toggleSort("name")} />
              <Th label="Status" active={sortKey === "status"} dir={sortDir} onClick={() => toggleSort("status")} />
              <th className="p-3">Ansatte</th>
              <th className="p-3">Plan</th>
              <th className="p-3">Binding igjen</th>
              <Th label="Opprettet" active={sortKey === "created_at"} dir={sortDir} onClick={() => toggleSort("created_at")} />
              <th className="p-3 text-right">Handling</th>
            </tr>
          </thead>

          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-10 text-center text-muted-foreground">
                  Ingen treff. Prøv annet søk eller endre filter.
                </td>
              </tr>
            ) : (
              rows.map((f: any) => {
                const created = f.created_at ? new Date(f.created_at).toLocaleString("nb-NO") : "—";
                const employees = f.employees_count ?? f.employee_count ?? "—";
                const plan = String(f.plan ?? "");
                const bindingLeft = fmtBinding(f.bindingMonthsLeft);

                const uiStatus = normalizeUiStatus(f.status);

                return (
                  <tr key={f.id} className="border-b last:border-b-0 hover:bg-bg/60">
                    <td className="p-3">
                      <div className="flex flex-col">
                        <Link className="font-medium underline-offset-4 hover:underline" href={`/superadmin/firms/${encodeURIComponent(f.id)}`}>
                          {f.name}
                        </Link>
                        <span className="mt-0.5 text-xs text-muted-foreground">{f.id}</span>
                      </div>
                    </td>

                    <td className="p-3">
                      <StatusPill status={uiStatus} />
                    </td>

                    <td className="p-3 tabular-nums">{employees}</td>

                    <td className="p-3">
                      <PlanPill plan={plan} />
                    </td>

                    <td className="p-3 tabular-nums">{bindingLeft}</td>

                    <td className="p-3 tabular-nums">{created}</td>

                    <td className="p-3 text-right">
                      <div className="inline-flex items-center gap-2">
                        <Link
                          className="inline-flex items-center rounded-xl border px-3 py-2 text-xs font-medium hover:bg-bg"
                          href={`/superadmin/firms/${encodeURIComponent(f.id)}`}
                        >
                          Åpne
                        </Link>

                        <button
                          type="button"
                          disabled={busyId === f.id}
                          onClick={(e) => openMenu(f.id, uiStatus, e.currentTarget)}
                          className={cx(
                            "inline-flex items-center rounded-xl border px-3 py-2 text-xs font-medium hover:bg-bg",
                            busyId === f.id && "opacity-50"
                          )}
                        >
                          Endre status
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between gap-3 border-t bg-bg p-4">
        <div className="text-sm text-muted-foreground">
          Side <span className="font-medium text-foreground">{page}</span> av{" "}
          <span className="font-medium text-foreground">{totalPages}</span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => goPage(1)}
            disabled={page <= 1 || isPending}
            className={cx("rounded-xl border px-3 py-2 text-sm hover:bg-surface", (page <= 1 || isPending) && "opacity-50")}
          >
            Første
          </button>
          <button
            type="button"
            onClick={() => goPage(page - 1)}
            disabled={page <= 1 || isPending}
            className={cx("rounded-xl border px-3 py-2 text-sm hover:bg-surface", (page <= 1 || isPending) && "opacity-50")}
          >
            Forrige
          </button>
          <button
            type="button"
            onClick={() => goPage(page + 1)}
            disabled={page >= totalPages || isPending}
            className={cx("rounded-xl border px-3 py-2 text-sm hover:bg-surface", (page >= totalPages || isPending) && "opacity-50")}
          >
            Neste
          </button>
          <button
            type="button"
            onClick={() => goPage(totalPages)}
            disabled={page >= totalPages || isPending}
            className={cx("rounded-xl border px-3 py-2 text-sm hover:bg-surface", (page >= totalPages || isPending) && "opacity-50")}
          >
            Siste
          </button>
        </div>
      </div>

      <StatusMenuPortal
        open={!!menuFor}
        anchorRect={anchorRect}
        current={menuCurrentStatus}
        busy={!!menuFor && busyId === menuFor}
        onClose={closeMenu}
        onPick={(s) => {
          if (!menuFor) return;
          changeStatus(menuFor, s);
        }}
      />
    </div>
  );
}
