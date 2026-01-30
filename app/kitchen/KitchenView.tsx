// app/kitchen/KitchenView.tsx
"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";

type BatchStatus = "queued" | "packed" | "delivered";

type KitchenOrder = {
  id: string;
  full_name: string;
  department: string | null;
  note: string | null;
};

type KitchenGroup = {
  delivery_date: string; // YYYY-MM-DD (intern / API)
  delivery_window: string; // slot
  company: string;
  location: string;
  company_location_id: string;

  batch_status: BatchStatus;
  packed_at: string | null;
  delivered_at: string | null;

  orders: KitchenOrder[];
};

const OSLO_TZ = "Europe/Oslo";

/* =========================
   Helpers
========================= */
function safeJsonParse<T>(txt: string): T | null {
  try {
    return JSON.parse(txt) as T;
  } catch {
    return null;
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isISODate(d: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(d ?? ""));
}

/** ✅ UTC-sikker addDays (unngår off-by-one) */
function addDaysISO(iso: string, deltaDays: number) {
  if (!isISODate(iso)) return iso;
  const [y, m, d] = iso.split("-").map((x) => Number(x));
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + deltaDays);
  return dt.toISOString().slice(0, 10);
}

function isWeekendISO(iso: string) {
  if (!isISODate(iso)) return false;
  const [y, m, d] = iso.split("-").map((x) => Number(x));
  const dt = new Date(Date.UTC(y, m - 1, d));
  const dow = dt.getUTCDay(); // 0 søn ... 6 lør
  return dow === 0 || dow === 6;
}

function nextBusinessDayISO(fromISO: string) {
  let cur = addDaysISO(fromISO, 1);
  while (isWeekendISO(cur)) cur = addDaysISO(cur, 1);
  return cur;
}

function fmtOsloYMDNow() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: OSLO_TZ }).format(new Date());
}

function fmtOsloHMSNow() {
  try {
    return new Intl.DateTimeFormat("nb-NO", {
      timeZone: OSLO_TZ,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }).format(new Date());
  } catch {
    return "";
  }
}

function fmtOsloDateTimeNow() {
  try {
    return new Intl.DateTimeFormat("nb-NO", {
      timeZone: OSLO_TZ,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(new Date());
  } catch {
    return "";
  }
}

function fmtOsloTime(ts?: string | null) {
  if (!ts) return "";
  try {
    return new Intl.DateTimeFormat("nb-NO", {
      timeZone: OSLO_TZ,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(new Date(ts));
  } catch {
    return "";
  }
}

function minsSince(ts: number) {
  const diff = Date.now() - ts;
  return Math.max(0, Math.floor(diff / 60000));
}

function staleLabel(mins: number) {
  if (mins <= 0) return "nå";
  if (mins === 1) return "1 min";
  return `${mins} min`;
}

function formatDateForLocale(iso: string) {
  if (!iso || !isISODate(iso)) return iso;

  const loc = typeof navigator !== "undefined" && navigator.language ? navigator.language.toLowerCase() : "en";
  if (loc.startsWith("nb-no") || loc.startsWith("nn-no")) {
    const [y, m, d] = iso.split("-");
    return `${d}-${m}-${y}`;
  }
  return iso;
}

function makeKitchenPrintId(args: { dateISO: string; windowLabel: string; totalKuverter: number }) {
  const w = (args.windowLabel || "ALL")
    .toUpperCase()
    .replace(/\s+/g, "")
    .replace(/[^A-Z0-9_-]/g, "");
  const d = args.dateISO || fmtOsloYMDNow();
  return `KITCHEN-${d}-${w}-${args.totalKuverter}`;
}

function normalizeBatchStatus(raw: string | null | undefined): BatchStatus {
  const v = String(raw || "").toLowerCase().trim();
  if (v === "delivered" || v === "lever" || v === "levert") return "delivered";
  if (v === "packed" || v === "pakket") return "packed";
  return "queued";
}

function groupVisualState(status: BatchStatus) {
  const isDelivered = status === "delivered";
  return {
    sectionClass: isDelivered ? "opacity-70" : "",
    badge:
      status === "queued"
        ? "bg-slate-900/5 text-slate-900"
        : status === "packed"
          ? "bg-amber-500/10 text-amber-900"
          : "bg-emerald-500/10 text-emerald-900",
    dot:
      status === "queued"
        ? "bg-slate-500"
        : status === "packed"
          ? "bg-amber-500"
          : "bg-emerald-500",
    label: status === "queued" ? "Klar" : status === "packed" ? "Pakket" : "✓ Levert",
  };
}

function buildRid(prefix: string) {
  try {
    // eslint-disable-next-line no-undef
    return `${prefix}_${crypto.randomUUID()}`;
  } catch {
    return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  }
}

function toServerStatus(s: BatchStatus): "QUEUED" | "PACKED" | "DELIVERED" {
  if (s === "packed") return "PACKED";
  if (s === "delivered") return "DELIVERED";
  return "QUEUED";
}

async function setBatchStatus(payload: { date: string; slot: string; location_id: string; status: BatchStatus }) {
  const rid = buildRid("kitchen_batch_set");

  const res = await fetch("/api/kitchen/batch/set", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-rid": rid },
    cache: "no-store",
    body: JSON.stringify({
      date: payload.date,
      slot: payload.slot,
      location_id: payload.location_id,
      status: toServerStatus(payload.status),
    }),
  });

  const txt = await res.text();
  const json = safeJsonParse<any>(txt);

  if (!res.ok) {
    const detail = typeof json?.detail === "string" ? json.detail : json?.detail ? JSON.stringify(json.detail) : null;
    throw new Error(detail || json?.message || json?.error || txt || "Kunne ikke oppdatere status");
  }

  if (json && typeof json === "object" && json.ok === false) {
    throw new Error(json?.message || json?.error || "Kunne ikke oppdatere status");
  }
}

type KitchenDayOk = KitchenGroup[];
type KitchenDayErr = { ok: false; rid?: string; error?: string; detail?: any; message?: string };

/* =========================
   UI primitives (calm)
========================= */
function Pill({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      type="button"
      className={[
        "inline-flex items-center justify-center rounded-full px-3 py-2 text-sm transition",
        "min-h-[44px] select-none",
        active ? "bg-slate-900 text-white shadow-sm" : "bg-white/70 text-slate-700 hover:bg-white hover:text-slate-900",
      ].join(" ")}
    >
      {label}
    </button>
  );
}

function IconBtn({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className={[
        "inline-flex items-center justify-center rounded-full",
        "h-11 w-11 sm:h-10 sm:w-10",
        "bg-white/70 hover:bg-white text-slate-900",
        "shadow-sm ring-1 ring-black/5",
        "disabled:opacity-60",
      ].join(" ")}
      title={label}
    >
      {children}
    </button>
  );
}

function PrimaryBtn({ label, onClick, disabled }: { label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={[
        "inline-flex items-center justify-center rounded-2xl",
        "min-h-[48px] px-4 py-3 text-sm font-semibold",
        "bg-slate-900 text-white shadow-sm",
        "hover:opacity-95 disabled:opacity-60",
      ].join(" ")}
    >
      {label}
    </button>
  );
}

function SecondaryBtn({ label, onClick, disabled }: { label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={[
        "inline-flex items-center justify-center rounded-2xl",
        "min-h-[48px] px-4 py-3 text-sm font-semibold",
        "bg-white/70 text-slate-900 shadow-sm ring-1 ring-black/5",
        "hover:bg-white disabled:opacity-60",
      ].join(" ")}
    >
      {label}
    </button>
  );
}

export default function KitchenView() {
  const [data, setData] = useState<KitchenGroup[] | null>(null);

  const [loading, setLoading] = useState(true);
  const [softWarning, setSoftWarning] = useState<string | null>(null);
  const [hardErr, setHardErr] = useState<string | null>(null);

  const [activeWindow, setActiveWindow] = useState<string>("ALL");
  const [onlyNotDelivered, setOnlyNotDelivered] = useState(false);

  const [busyKey, setBusyKey] = useState<string | null>(null);

  // Drawer / "åpne batch"
  const [openGroupKey, setOpenGroupKey] = useState<string | null>(null);

  // Secondary controls sheet (mobil)
  const [filtersOpen, setFiltersOpen] = useState(false);

  // ✅ Inline feedback under batch
  const [inlineNotice, setInlineNotice] = useState<{
    key: string;
    message: string;
    canUndo: boolean;
    target?: {
      delivery_date: string;
      delivery_window: string;
      company_location_id: string;
      company: string;
    };
  } | null>(null);

  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const [lastSuccessAt, setLastSuccessAt] = useState<number | null>(null);
  const [tick, setTick] = useState(0);

  // ✅ velg dato (Oslo)
  const [dateISO, setDateISO] = useState<string>(fmtOsloYMDNow());

  useEffect(() => {
    const t = setInterval(() => setTick((x) => x + 1), 60_000);
    return () => clearInterval(t);
  }, []);

  // ESC lukker sheets/drawers
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpenGroupKey(null);
        setFiltersOpen(false);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  async function fetchDayOnce(dISO: string): Promise<KitchenGroup[]> {
    if (!isISODate(dISO)) throw new Error("Ugyldig dato");

    const rid = buildRid("kitchen_day");
    const res = await fetch(`/api/kitchen/day?date=${encodeURIComponent(dISO)}`, {
      cache: "no-store",
      headers: { "x-rid": rid },
    });

    const txt = await res.text();
    const json = safeJsonParse<any>(txt);

    if (!res.ok) {
      const detail = typeof json?.detail === "string" ? json.detail : json?.detail ? JSON.stringify(json.detail) : null;
      throw new Error(detail || json?.message || json?.error || txt || "Kunne ikke hente kjøkkenliste");
    }

    if (Array.isArray(json)) {
      return (json as KitchenDayOk).map((g) => ({ ...g, batch_status: normalizeBatchStatus(g.batch_status) }));
    }

    if (json && typeof json === "object" && json.ok === false) {
      const j = json as KitchenDayErr;
      const detail = typeof j.detail === "string" ? j.detail : j.detail ? JSON.stringify(j.detail) : null;
      throw new Error(detail || j.message || j.error || "Kunne ikke hente kjøkkenliste");
    }

    throw new Error("Ugyldig respons fra server");
  }

  async function load() {
    setIsRefreshing(true);
    try {
      setSoftWarning(null);

      try {
        const groups = await fetchDayOnce(dateISO);
        setData(groups);
        setLastUpdated(fmtOsloHMSNow());
        setLastSuccessAt(Date.now());
        setHardErr(null);
        return;
      } catch {
        await sleep(1200);
        const groups = await fetchDayOnce(dateISO);
        setData(groups);
        setLastUpdated(fmtOsloHMSNow());
        setLastSuccessAt(Date.now());
        setHardErr(null);
        return;
      }
    } catch (e: any) {
      const msg = e?.message || "Kunne ikke hente kjøkkenliste";
      if (data && data.length > 0) {
        setSoftWarning(`Kunne ikke oppdatere akkurat nå. Viser siste kjente data. (${msg})`);
      } else {
        setHardErr(msg);
      }
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }

  useEffect(() => {
    void load();
    const t = setInterval(load, 30_000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateISO]);

  useEffect(() => {
    if (!openGroupKey) return;
    const exists = (data ?? []).some((g) => `${g.delivery_date}__${g.delivery_window}__${g.company_location_id}` === openGroupKey);
    if (!exists) setOpenGroupKey(null);
  }, [data, openGroupKey]);

  const windows = useMemo(() => {
    const set = new Set<string>();
    (data ?? []).forEach((g) => set.add(g.delivery_window));
    return ["ALL", ...Array.from(set).sort((a, b) => a.localeCompare(b, "nb"))];
  }, [data]);

  const filteredGroups = useMemo(() => {
    let groups = data ?? [];
    if (activeWindow !== "ALL") groups = groups.filter((g) => g.delivery_window === activeWindow);
    if (onlyNotDelivered) groups = groups.filter((g) => normalizeBatchStatus(g.batch_status) !== "delivered");
    return groups.map((g) => ({ ...g, batch_status: normalizeBatchStatus(g.batch_status) }));
  }, [data, activeWindow, onlyNotDelivered]);

  const totalKuverter = useMemo(() => {
    return filteredGroups.reduce((sum, g) => sum + (g.orders?.length ?? 0), 0);
  }, [filteredGroups]);

  const companyTotals = useMemo(() => {
    const map = new Map<string, number>();
    for (const g of filteredGroups) {
      const company = g.company || "Ukjent firma";
      map.set(company, (map.get(company) ?? 0) + (g.orders?.length ?? 0));
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0], "nb"));
  }, [filteredGroups]);

  const staleMins = useMemo(() => {
    void tick;
    if (!lastSuccessAt) return null;
    return minsSince(lastSuccessAt);
  }, [lastSuccessAt, tick]);

  const printId = useMemo(() => {
    const windowLabel = activeWindow === "ALL" ? "ALL" : activeWindow;
    return makeKitchenPrintId({ dateISO: dateISO || fmtOsloYMDNow(), windowLabel, totalKuverter });
  }, [dateISO, activeWindow, totalKuverter]);

  async function mark(g: KitchenGroup, status: BatchStatus) {
    const busy = `${g.delivery_date}:${g.delivery_window}:${g.company_location_id}`;
    setBusyKey(busy);

    const groupKey = `${g.delivery_date}__${g.delivery_window}__${g.company_location_id}`;
    const target = {
      delivery_date: g.delivery_date,
      delivery_window: g.delivery_window,
      company_location_id: g.company_location_id,
      company: g.company,
    };

    setInlineNotice({
      key: groupKey,
      message: status === "packed" ? "Markert pakket" : status === "delivered" ? "Markert levert" : "Merking fjernet",
      canUndo: status !== "queued",
      target,
    });

    try {
      await setBatchStatus({
        date: g.delivery_date,
        slot: g.delivery_window,
        location_id: g.company_location_id,
        status,
      });
      await load();
    } catch (e: any) {
      setInlineNotice({
        key: groupKey,
        message: e?.message || "Kunne ikke oppdatere status",
        canUndo: false,
        target,
      });
    } finally {
      setBusyKey(null);
    }
  }

  async function markDeliveredWithConfirm(g: KitchenGroup) {
    if (normalizeBatchStatus(g.batch_status) === "delivered") return;
    const ok = window.confirm(
      `Bekreft levering:\n\nFirma: ${g.company}\nVindu: ${g.delivery_window}\nKuverter: ${g.orders.length}\n\nVil du markere som levert?`
    );
    if (!ok) return;
    await mark(g, "delivered");
  }

  async function unmarkInline(target: NonNullable<NonNullable<typeof inlineNotice>["target"]>) {
    const ok = window.confirm(
      `Bekreft fjerning:\n\nDette vil sette status tilbake til "Klar".\nFirma: ${target.company}\nVindu: ${target.delivery_window}\n\nVil du fortsette?`
    );
    if (!ok) return;

    const busy = `${target.delivery_date}:${target.delivery_window}:${target.company_location_id}`;
    setBusyKey(busy);

    try {
      await setBatchStatus({
        date: target.delivery_date,
        slot: target.delivery_window,
        location_id: target.company_location_id,
        status: "queued",
      });

      setInlineNotice((prev) => (prev ? { ...prev, message: "Merking fjernet", canUndo: false } : prev));
      await load();
    } catch (e: any) {
      setInlineNotice((prev) => (prev ? { ...prev, message: e?.message || "Kunne ikke fjerne merking", canUndo: false } : prev));
    } finally {
      setBusyKey(null);
    }
  }

  async function copyToClipboard(text: string) {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        return;
      }
    } catch {}
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.left = "-9999px";
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    } catch {}
  }

  async function findNextDayWithOrders() {
    let cur = dateISO;
    for (let i = 0; i < 14; i++) {
      cur = nextBusinessDayISO(cur);
      const groups = await fetchDayOnce(cur);
      if (groups.length > 0) {
        setDateISO(cur);
        return;
      }
    }
    setInlineNotice({ key: "__GLOBAL__", message: "Fant ingen dager med bestillinger de neste 14 dagene.", canUndo: false });
  }

  async function logout() {
    const ok = window.confirm("Vil du logge ut av Lunchportalen?");
    if (!ok) return;

    try {
      const sb = supabaseBrowser();
      await sb.auth.signOut();
    } catch {
      // no-op
    } finally {
      window.location.replace("/login");
    }
  }

  const dateLabel = formatDateForLocale(dateISO);

  const openGroup = useMemo(() => {
    if (!openGroupKey) return null;
    return (data ?? []).find((g) => `${g.delivery_date}__${g.delivery_window}__${g.company_location_id}` === openGroupKey) || null;
  }, [openGroupKey, data]);

  const liveLabel = isRefreshing ? "Oppdaterer…" : "Live";

  return (
    <div
      className={[
        "relative",
        "min-h-[calc(100svh)]",
        "bg-[radial-gradient(1200px_600px_at_50%_0%,rgba(15,23,42,0.06),transparent_70%)]",
      ].join(" ")}
    >
      {/* Safe-area + print styles */}
      <style>{`
        :root{
          --lp-safe-top: env(safe-area-inset-top);
          --lp-safe-bot: env(safe-area-inset-bottom);
        }
        @media print {
          @page { margin: 12mm; }
          html, body { background: #fff !important; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          table { page-break-inside: avoid; }
          tr, td, th { page-break-inside: avoid; }
          section { break-inside: avoid; page-break-inside: avoid; }
          button, input, select, textarea { display: none !important; }
          a[href]:after { content: "" !important; }
          .lp-print-border { border: 1px solid #e5e7eb !important; }
          .lp-print-tight { padding: 0 !important; margin: 0 !important; }
          .lp-print-mt { margin-top: 10mm !important; }
          .lp-print-h2 { font-size: 14pt !important; line-height: 1.2 !important; }
          .lp-print-meta { font-size: 10pt !important; color: #374151 !important; }
          .lp-print-summary { margin-top: 6mm !important; }
          .lp-sign { margin-top: 6mm !important; }
          .lp-sign-row { display: flex !important; gap: 10mm !important; }
          .lp-sign-box { flex: 1 1 0%; }
          .lp-sign-label { font-size: 10pt !important; color: #374151 !important; margin-bottom: 2mm !important; }
          .lp-sign-line { border-bottom: 1px solid #111827 !important; height: 8mm !important; }
          .lp-sign-meta { font-size: 9pt !important; color: #6b7280 !important; margin-top: 2mm !important; }
          .lp-print-footer {
            position: fixed; bottom: 0; left: 0; right: 0;
            text-align: center; font-size: 9pt; color: #374151;
          }
        }
      `}</style>

      {/* PRINT HEADER */}
      <div className="hidden print:block lp-print-tight">
        <div className="flex items-start justify-between">
          <div>
            <div className="lp-print-h2 font-semibold text-black">Kjøkken – dagens bestillinger</div>
            <div className="lp-print-meta mt-1">
              <span className="font-semibold">Kjøkken-ID:</span> {printId}
            </div>
            <div className="lp-print-meta mt-1">
              Dato: <span className="font-semibold">{dateLabel || "-"}</span>
              <span className="mx-2">•</span>
              Vinduer: <span className="font-semibold">{new Set(filteredGroups.map((g) => g.delivery_window)).size}</span>
            </div>
            <div className="lp-print-meta mt-1">
              Totalt kuverter (visning): <span className="font-semibold">{totalKuverter}</span>
            </div>
          </div>
          <div className="lp-print-meta text-right">
            Utskrift: <span className="font-semibold">{fmtOsloDateTimeNow()}</span>
          </div>
        </div>

        <div className="lp-print-summary lp-print-border mt-3 rounded-xl p-3">
          <div className="text-sm font-semibold text-black mb-2">Sum per firma (visning)</div>
          <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
            {companyTotals.map(([company, count]) => (
              <div key={company} className="flex items-center justify-between border-b border-slate-200 py-1 last:border-0">
                <span className="text-slate-700">{company}</span>
                <span className="font-semibold text-black">{count}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="lp-print-mt" />
      </div>

      {/* Sticky App Topbar */}
      <div
        className={[
          "print:hidden",
          "sticky top-0 z-40",
          "backdrop-blur-xl",
          "bg-white/60",
          "ring-1 ring-black/5",
        ].join(" ")}
        style={{ paddingTop: "var(--lp-safe-top)" }}
      >
        <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
          <div className="flex items-center justify-between py-3">
            <div className="min-w-0">
              <div className="flex items-center gap-3">
                <div className="text-lg sm:text-xl font-semibold text-slate-900">Kjøkken</div>
                <div className="hidden sm:flex items-center gap-2 text-sm text-slate-700">
                  <span aria-hidden className={["h-2 w-2 rounded-full", isRefreshing ? "bg-amber-500" : "bg-emerald-500"].join(" ")} />
                  <span className="font-medium">{liveLabel}</span>
                  <span className="text-slate-400">•</span>
                  <span>
                    Sist oppdatert: <span className="font-semibold text-slate-900">{lastUpdated ?? "—"}</span>
                  </span>
                  <span className="text-slate-400">•</span>
                  <span>
                    Sist OK:{" "}
                    <span className="font-semibold text-slate-900">{staleMins === null ? "—" : staleLabel(staleMins)}</span>
                  </span>
                </div>
              </div>

              <div className="mt-1 flex items-center gap-2 text-sm text-slate-700">
                <label className="inline-flex items-center gap-2 rounded-2xl bg-white/70 px-3 py-2 shadow-sm ring-1 ring-black/5">
                  <span className="text-slate-500" aria-hidden>
                    📅
                  </span>
                  <input
                    type="date"
                    value={dateISO}
                    onChange={(e) => setDateISO(e.target.value)}
                    className="bg-transparent outline-none"
                  />
                </label>

                <div className="hidden sm:flex items-center gap-2">
                  <SecondaryBtn label="Forrige" onClick={() => setDateISO(addDaysISO(dateISO, -1))} />
                  <SecondaryBtn label="I dag" onClick={() => setDateISO(fmtOsloYMDNow())} />
                  <SecondaryBtn label="Neste" onClick={() => setDateISO(addDaysISO(dateISO, 1))} />
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <IconBtn label="Verktøy" onClick={() => setFiltersOpen(true)}>
                <span aria-hidden>⚙️</span>
              </IconBtn>

              <IconBtn label="Oppdater" onClick={() => load()} disabled={isRefreshing}>
                <span aria-hidden>↻</span>
              </IconBtn>

              <IconBtn label="Skriv ut" onClick={() => window.print()}>
                <span aria-hidden>🖨️</span>
              </IconBtn>

              <IconBtn label="Logg ut" onClick={logout}>
                <span aria-hidden>⎋</span>
              </IconBtn>
            </div>
          </div>

          {/* Desktop: windows pills + toggles */}
          <div className="hidden sm:block pb-3">
            <div className="flex flex-wrap items-center gap-2">
              {windows.map((w) => (
                <Pill key={w} active={activeWindow === w} label={w === "ALL" ? "Alle" : w} onClick={() => setActiveWindow(w)} />
              ))}

              <div className="ml-auto flex items-center gap-3 text-sm text-slate-700">
                <label className="inline-flex items-center gap-2">
                  <input type="checkbox" checked={onlyNotDelivered} onChange={(e) => setOnlyNotDelivered(e.target.checked)} />
                  Kun ikke levert
                </label>

                <div className="inline-flex items-center gap-2 rounded-2xl bg-white/70 px-3 py-2 shadow-sm ring-1 ring-black/5">
                  <span className="text-slate-500">Kjøkken-ID</span>
                  <code className="font-mono text-slate-900">{printId}</code>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(printId)}
                    className="rounded-full bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:opacity-95"
                  >
                    Kopier
                  </button>
                </div>
              </div>
            </div>

            {inlineNotice?.key === "__GLOBAL__" && (
              <div className="mt-3 rounded-2xl bg-white/70 px-4 py-3 text-sm text-slate-800 shadow-sm ring-1 ring-black/5">
                {inlineNotice.message}
              </div>
            )}

            {softWarning && (
              <div className="mt-3 rounded-2xl bg-amber-500/10 px-4 py-3 text-sm text-amber-900 shadow-sm ring-1 ring-black/5">
                {softWarning}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
        {/* Mobil statuslinje (kompakt) */}
        <div className="sm:hidden mt-4 rounded-2xl bg-white/70 px-4 py-3 text-sm text-slate-700 shadow-sm ring-1 ring-black/5">
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-2">
              <span aria-hidden className={["h-2 w-2 rounded-full", isRefreshing ? "bg-amber-500" : "bg-emerald-500"].join(" ")} />
              <span className="font-semibold text-slate-900">{liveLabel}</span>
            </span>
            <span className="text-slate-500">
              Sist: <span className="font-semibold text-slate-900">{lastUpdated ?? "—"}</span>
            </span>
          </div>
          <div className="mt-1 text-slate-500">
            Sist OK: <span className="font-semibold text-slate-900">{staleMins === null ? "—" : staleLabel(staleMins)}</span>
          </div>

          {softWarning ? (
            <div className="mt-2 rounded-xl bg-amber-500/10 px-3 py-2 text-amber-900">{softWarning}</div>
          ) : null}
        </div>

        {/* Hard error */}
        {hardErr && (!data || data.length === 0) && (
          <div className="mt-4 rounded-2xl bg-red-500/10 px-4 py-3 text-sm text-red-900 shadow-sm ring-1 ring-black/5">
            {hardErr}
          </div>
        )}

        {/* Empty */}
        {!loading && (!data || data.length === 0) && !hardErr && (
          <div className="mt-6 rounded-3xl bg-white/70 p-6 shadow-sm ring-1 ring-black/5">
            <div className="text-base font-semibold text-slate-900">Ingen aktive bestillinger</div>
            <div className="mt-1 text-sm text-slate-600">Valgt dato har ingen bestillinger i systemet.</div>

            <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <SecondaryBtn label="Neste leveringsdag" onClick={() => setDateISO(nextBusinessDayISO(dateISO))} />
              <PrimaryBtn label="Finn neste dag med bestillinger" onClick={findNextDayWithOrders} />
            </div>
          </div>
        )}

        {/* Summary */}
        {data && data.length > 0 && (
          <div className="mt-6">
            <div className="flex items-end justify-between gap-3">
              <div>
                <div className="text-sm text-slate-600">Totalt (visning)</div>
                <div className="text-3xl font-semibold tracking-tight text-slate-900">{totalKuverter}</div>
              </div>

              <div className="hidden sm:block text-right">
                <div className="text-sm text-slate-600">Vinduer</div>
                <div className="text-xl font-semibold text-slate-900">
                  {new Set(filteredGroups.map((g) => g.delivery_window)).size}
                </div>
              </div>
            </div>

            {companyTotals.length > 0 && (
              <div className="mt-5 rounded-3xl bg-white/70 p-5 shadow-sm ring-1 ring-black/5">
                <div className="text-sm font-semibold text-slate-900">Sum per firma (visning)</div>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {companyTotals.map(([company, count]) => (
                    <div key={company} className="flex items-center justify-between rounded-2xl bg-white/60 px-4 py-3 ring-1 ring-black/5">
                      <div className="min-w-0">
                        <div className="truncate text-sm text-slate-700">{company}</div>
                      </div>
                      <div className="text-sm font-semibold text-slate-900">{count}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {inlineNotice?.key === "__GLOBAL__" && (
          <div className="mt-4 rounded-2xl bg-white/70 px-4 py-3 text-sm text-slate-800 shadow-sm ring-1 ring-black/5">
            {inlineNotice.message}
          </div>
        )}

        {/* Groups */}
        <div className="mt-6 space-y-5 pb-24 sm:pb-8">
          {filteredGroups.map((g, i) => {
            const busy = `${g.delivery_date}:${g.delivery_window}:${g.company_location_id}`;
            const isBusy = busyKey === busy;

            const v = groupVisualState(g.batch_status);
            const groupKey = `${g.delivery_date}__${g.delivery_window}__${g.company_location_id}`;
            const inlineForThis = inlineNotice?.key === groupKey ? inlineNotice : null;

            return (
              <div key={`${g.delivery_date}:${g.delivery_window}:${g.company_location_id}:${i}`} className="space-y-3">
                <section
                  role="button"
                  tabIndex={0}
                  onClick={() => setOpenGroupKey(groupKey)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") setOpenGroupKey(groupKey);
                  }}
                  className={[
                    "rounded-3xl bg-white/70 p-5 shadow-sm ring-1 ring-black/5",
                    "cursor-pointer transition hover:bg-white/80",
                    "print:shadow-none print:rounded-none print:p-0 print:ring-0 print:bg-white",
                    v.sectionClass,
                  ].join(" ")}
                  title="Åpne batch"
                >
                  <header className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-base sm:text-lg font-semibold text-slate-900">
                          {g.delivery_window} <span className="text-slate-400">•</span> {g.company}
                        </h2>
                        <span className={["inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold", v.badge].join(" ")}>
                          <span aria-hidden className={["h-2 w-2 rounded-full", v.dot].join(" ")} />
                          {v.label}
                        </span>
                      </div>

                      <p className="mt-1 text-sm text-slate-600">{g.location}</p>

                      <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-slate-700">
                        <div>
                          Kuverter: <span className="font-semibold text-slate-900">{g.orders.length}</span>
                        </div>

                        {(g.packed_at || g.delivered_at) && (
                          <div className="text-slate-500">
                            {g.packed_at ? `Pakket ${fmtOsloTime(g.packed_at)}` : null}
                            {g.packed_at && g.delivered_at ? <span className="mx-2">•</span> : null}
                            {g.delivered_at ? `Levert ${fmtOsloTime(g.delivered_at)}` : null}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Desktop inline actions */}
                    <div className="hidden sm:flex items-center gap-2">
                      <SecondaryBtn
                        label={isBusy ? "Oppdaterer…" : "Marker pakket"}
                        disabled={isBusy || g.batch_status !== "queued"}
                        onClick={() => void mark(g, "packed")}
                      />
                      <SecondaryBtn
                        label={isBusy ? "Oppdaterer…" : "Marker levert"}
                        disabled={isBusy || g.batch_status === "delivered"}
                        onClick={() => void markDeliveredWithConfirm(g)}
                      />
                    </div>
                  </header>

                  {/* Desktop table */}
                  <div className="mt-5 hidden sm:block">
                    <table className="w-full border-collapse text-sm">
                      <thead>
                        <tr className="text-left text-slate-600">
                          <th className="py-2 font-semibold">Navn</th>
                          <th className="py-2 font-semibold">Avdeling</th>
                          <th className="py-2 font-semibold">Notat</th>
                        </tr>
                      </thead>
                      <tbody>
                        {g.orders.map((o, idx) => (
                          <tr key={`${o.id}:${idx}`} className="align-top">
                            <td className="py-2 text-slate-900">{o.full_name}</td>
                            <td className="py-2 text-slate-600">{o.department || "–"}</td>
                            <td className="py-2 text-slate-900">{o.note || ""}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Mobile list */}
                  <div className="mt-4 sm:hidden space-y-2">
                    {g.orders.map((o) => (
                      <div key={o.id} className="rounded-2xl bg-white/60 px-4 py-3 ring-1 ring-black/5">
                        <div className="text-sm font-semibold text-slate-900">{o.full_name}</div>
                        <div className="mt-1 text-sm text-slate-600">{o.department || "–"}</div>
                        {o.note ? <div className="mt-2 text-sm text-slate-900">{o.note}</div> : null}
                      </div>
                    ))}
                  </div>

                  {/* PRINT signatur */}
                  <div className="hidden print:block lp-sign">
                    <div className="lp-sign-row">
                      <div className="lp-sign-box">
                        <div className="lp-sign-label">
                          Pakket av (navn + signatur)
                          {g.packed_at ? <span className="lp-sign-meta"> • Tid: {fmtOsloTime(g.packed_at)}</span> : null}
                        </div>
                        <div className="lp-sign-line" />
                        <div className="lp-sign-meta">
                          Batch: {g.delivery_window} • {g.company} • {g.location}
                        </div>
                      </div>

                      <div className="lp-sign-box">
                        <div className="lp-sign-label">
                          Levert av (navn + signatur)
                          {g.delivered_at ? <span className="lp-sign-meta"> • Tid: {fmtOsloTime(g.delivered_at)}</span> : null}
                        </div>
                        <div className="lp-sign-line" />
                        <div className="lp-sign-meta">
                          Dato: {formatDateForLocale(g.delivery_date)} • Lokasjon ID: {g.company_location_id}
                        </div>
                      </div>
                    </div>
                  </div>
                </section>

                {/* Inline feedback */}
                {inlineForThis && (
                  <div
                    className={[
                      "rounded-2xl px-4 py-3 text-sm shadow-sm ring-1 ring-black/5",
                      inlineForThis.message.toLowerCase().includes("kunne ikke")
                        ? "bg-red-500/10 text-red-900"
                        : "bg-emerald-500/10 text-emerald-900",
                    ].join(" ")}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <span>{inlineForThis.message}</span>

                      {inlineForThis.canUndo && inlineForThis.target && (
                        <button
                          type="button"
                          onClick={() => void unmarkInline(inlineForThis.target!)}
                          className="rounded-full bg-white/80 px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-white ring-1 ring-black/5 disabled:opacity-60"
                          disabled={!!busyKey}
                          title="Fjern merking og sett tilbake til Klar"
                        >
                          Fjern merking
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {loading && <div className="mt-6 text-sm text-slate-600">Laster kjøkkenliste…</div>}
      </div>

      {/* Mobile Bottom Action Bar */}
      <div className="print:hidden sm:hidden fixed left-0 right-0 bottom-0 z-40" style={{ paddingBottom: "var(--lp-safe-bot)" }}>
        <div className="mx-auto w-full max-w-6xl px-4 pb-3">
          <div className="rounded-3xl bg-white/70 p-3 shadow-lg ring-1 ring-black/5 backdrop-blur-xl">
            <div className="grid grid-cols-3 gap-2">
              <SecondaryBtn label="I dag" onClick={() => setDateISO(fmtOsloYMDNow())} />
              <SecondaryBtn label="Neste" onClick={() => setDateISO(nextBusinessDayISO(dateISO))} />
              <SecondaryBtn label="Oppdater" onClick={() => load()} disabled={isRefreshing} />
            </div>
            <div className="mt-2">
              <PrimaryBtn label="Finn neste med bestillinger" onClick={findNextDayWithOrders} />
            </div>
          </div>
        </div>
      </div>

      {/* Filters Sheet (mobil) */}
      {filtersOpen && (
        <div
          className="print:hidden fixed inset-0 z-50 bg-black/30"
          onClick={() => setFiltersOpen(false)}
          aria-modal="true"
          role="dialog"
        >
          <div
            className="absolute left-0 right-0 bottom-0 mx-auto w-full max-w-6xl"
            onClick={(e) => e.stopPropagation()}
            style={{ paddingBottom: "var(--lp-safe-bot)" }}
          >
            <div className="rounded-t-3xl bg-white/95 p-5 shadow-2xl ring-1 ring-black/10 backdrop-blur-xl">
              <div className="flex items-center justify-between">
                <div className="text-base font-semibold text-slate-900">Verktøy</div>
                <button
                  type="button"
                  onClick={() => setFiltersOpen(false)}
                  className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:opacity-95"
                >
                  Lukk
                </button>
              </div>

              <div className="mt-4">
                <div className="text-sm font-semibold text-slate-900">Leveringsvindu</div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {windows.map((w) => (
                    <Pill key={w} active={activeWindow === w} label={w === "ALL" ? "Alle" : w} onClick={() => setActiveWindow(w)} />
                  ))}
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between rounded-2xl bg-slate-900/5 px-4 py-3">
                <div>
                  <div className="text-sm font-semibold text-slate-900">Kun ikke levert</div>
                  <div className="text-sm text-slate-600">Skjul leverte batcher i listen</div>
                </div>
                <input type="checkbox" checked={onlyNotDelivered} onChange={(e) => setOnlyNotDelivered(e.target.checked)} />
              </div>

              <div className="mt-4 rounded-2xl bg-slate-900/5 px-4 py-3">
                <div className="text-sm text-slate-700">Kjøkken-ID</div>
                <div className="mt-1 flex items-center justify-between gap-3">
                  <code className="truncate font-mono text-sm text-slate-900">{printId}</code>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(printId)}
                    className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:opacity-95"
                  >
                    Kopier
                  </button>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2">
                <SecondaryBtn label="Skriv ut" onClick={() => window.print()} />
                <SecondaryBtn label="Neste leveringsdag" onClick={() => setDateISO(nextBusinessDayISO(dateISO))} />
              </div>

              {/* Logg ut (mobil) */}
              <div className="mt-3">
                <button
                  type="button"
                  onClick={logout}
                  className="w-full rounded-2xl bg-red-600 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:opacity-95"
                >
                  Logg ut
                </button>
              </div>

              {inlineNotice?.key === "__GLOBAL__" && (
                <div className="mt-4 rounded-2xl bg-white px-4 py-3 text-sm text-slate-800 shadow-sm ring-1 ring-black/5">
                  {inlineNotice.message}
                </div>
              )}

              {softWarning && (
                <div className="mt-3 rounded-2xl bg-amber-500/10 px-4 py-3 text-sm text-amber-900 ring-1 ring-black/5">
                  {softWarning}
                </div>
              )}

              <div className="mt-3 text-xs text-slate-500">Tips: Trykk ESC for å lukke.</div>
            </div>
          </div>
        </div>
      )}

      {/* Batch Drawer */}
      {openGroup && (
        <div
          className="fixed inset-0 z-50 bg-black/30 p-4 print:hidden"
          onClick={() => setOpenGroupKey(null)}
          aria-modal="true"
          role="dialog"
        >
          <div
            className="mx-auto mt-10 w-full max-w-4xl rounded-3xl bg-white/95 p-6 shadow-2xl ring-1 ring-black/10 backdrop-blur-xl"
            onClick={(e) => e.stopPropagation()}
          >
            {(() => {
              const v = groupVisualState(openGroup.batch_status);
              const busy = `${openGroup.delivery_date}:${openGroup.delivery_window}:${openGroup.company_location_id}`;
              const isBusy = busyKey === busy;

              return (
                <>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-lg font-semibold text-slate-900">
                          {openGroup.delivery_window} <span className="text-slate-400">•</span> {openGroup.company}
                        </h3>

                        <span className={["inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold", v.badge].join(" ")}>
                          <span aria-hidden className={["h-2 w-2 rounded-full", v.dot].join(" ")} />
                          {v.label}
                        </span>
                      </div>

                      <p className="mt-1 text-sm text-slate-600">{openGroup.location}</p>

                      <div className="mt-3 flex flex-wrap gap-3 text-sm text-slate-700">
                        <div>
                          Kuverter: <span className="font-semibold text-slate-900">{openGroup.orders.length}</span>
                        </div>
                        <div>
                          Dato: <span className="font-semibold text-slate-900">{formatDateForLocale(openGroup.delivery_date)}</span>
                        </div>
                        {openGroup.packed_at ? (
                          <div>
                            Pakket: <span className="font-semibold text-slate-900">{fmtOsloTime(openGroup.packed_at)}</span>
                          </div>
                        ) : null}
                        {openGroup.delivered_at ? (
                          <div>
                            Levert: <span className="font-semibold text-slate-900">{fmtOsloTime(openGroup.delivered_at)}</span>
                          </div>
                        ) : null}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <SecondaryBtn label="Skriv ut" onClick={() => window.print()} />
                      <SecondaryBtn label="Lukk" onClick={() => setOpenGroupKey(null)} />
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:gap-2">
                    <SecondaryBtn
                      label={isBusy ? "Oppdaterer…" : "Marker pakket"}
                      disabled={isBusy || openGroup.batch_status !== "queued"}
                      onClick={() => void mark(openGroup, "packed")}
                    />
                    <SecondaryBtn
                      label={isBusy ? "Oppdaterer…" : "Marker levert"}
                      disabled={isBusy || openGroup.batch_status === "delivered"}
                      onClick={() => void markDeliveredWithConfirm(openGroup)}
                    />
                  </div>

                  <div className="mt-5 space-y-2">
                    {openGroup.orders.map((o) => (
                      <div key={o.id} className="rounded-2xl bg-slate-900/5 px-4 py-3">
                        <div className="text-sm font-semibold text-slate-900">{o.full_name}</div>
                        <div className="mt-1 text-sm text-slate-600">{o.department || "–"}</div>
                        {o.note ? <div className="mt-2 text-sm text-slate-900">{o.note}</div> : null}
                      </div>
                    ))}
                  </div>

                  <div className="mt-3 text-xs text-slate-500">Tips: Trykk ESC for å lukke.</div>
                </>
              );
            })()}
          </div>
        </div>
      )}

      <div className="hidden print:block lp-print-footer" />
    </div>
  );
}
