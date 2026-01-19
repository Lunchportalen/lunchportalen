// app/kitchen/KitchenView.tsx
"use client";

import { useEffect, useMemo, useState } from "react";

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

// ====== API response from /api/kitchen/orders ======
type KitchenOrdersApiRow = {
  order_id: string;
  created_at: string;

  delivery_date: string; // YYYY-MM-DD
  delivery_slot: string; // delivery window
  status: string; // kan være queued/packed/delivered (eller annen). Vi normaliserer.

  order_note: string | null;

  company_id: string;
  company_name: string;

  location_id: string;
  location_name: string;

  profile_id: string;
  employee_name: string;
  employee_department: string | null;
  employee_phone?: string | null;

  // Hvis orders-endpoint merge'r batches: disse kan komme med (valgfritt)
  packed_at?: string | null;
  delivered_at?: string | null;
};

type KitchenOrdersApiResponse =
  | { ok: true; date: string; rows: KitchenOrdersApiRow[]; rid?: string }
  | { ok: false; error: string; detail?: any; rid?: string };

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
  return /^\d{4}-\d{2}-\d{2}$/.test(d);
}

/**
 * ✅ UTC-sikker addDays på ISO-dato (unngår off-by-one pga toISOString/timezone)
 */
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
  // ✅ Returnerer YYYY-MM-DD i Oslo-tid direkte
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

/**
 * Visningsformat:
 * - Norge (nb-NO/nn-NO) -> dd-mm-yyyy
 * - Andre land -> YYYY-MM-DD
 *
 * NB: Data/URL/DB forblir alltid ISO.
 */
function formatDateForLocale(iso: string) {
  if (!iso || !isISODate(iso)) return iso;

  const loc =
    typeof navigator !== "undefined" && navigator.language ? navigator.language.toLowerCase() : "en";

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

function maxStatus(a: BatchStatus, b: BatchStatus): BatchStatus {
  const rank: Record<BatchStatus, number> = { queued: 0, packed: 1, delivered: 2 };
  return rank[b] > rank[a] ? b : a;
}

function groupVisualState(status: BatchStatus) {
  const isDelivered = status === "delivered";
  return {
    sectionClass: isDelivered ? "opacity-70 grayscale" : "",
    headerBadge:
      status === "queued"
        ? "border-slate-200 bg-slate-50 text-slate-900"
        : status === "packed"
        ? "border-amber-200 bg-amber-50 text-amber-900"
        : "border-emerald-200 bg-emerald-50 text-emerald-900",
    headerDot:
      status === "queued"
        ? "bg-slate-500"
        : status === "packed"
        ? "bg-amber-500"
        : "bg-emerald-500",
    headerLabel: status === "queued" ? "Klar" : status === "packed" ? "Pakket" : "✓ Levert",
  };
}

function Chip({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={[
        "rounded-full border border-[rgb(var(--lp-border))] bg-white px-3 py-2 text-sm transition",
        active
          ? "font-semibold shadow-sm"
          : "text-[rgb(var(--lp-muted))] hover:text-[rgb(var(--lp-text))] hover:bg-[rgb(var(--lp-bg))]",
      ].join(" ")}
      type="button"
    >
      {label}
    </button>
  );
}

async function setBatchStatus(payload: {
  delivery_date: string;
  delivery_window: string;
  company_location_id: string;
  status: BatchStatus;
}) {
  const res = await fetch("/api/kitchen/batch", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const txt = await res.text();
    const maybe = safeJsonParse<any>(txt);
    const detail =
      typeof maybe?.detail === "string"
        ? maybe.detail
        : maybe?.detail
        ? JSON.stringify(maybe.detail)
        : null;

    throw new Error(detail || maybe?.error || maybe?.message || txt || "Kunne ikke oppdatere status");
  }
}

/**
 * mapper rows (flat) -> KitchenGroup[] (for this UI)
 * ✅ batch_status utledes fra row.status (aggregert til maks-status per gruppe)
 * ✅ packed_at / delivered_at tas med hvis de finnes på row (fra merged endpoint)
 */
function rowsToGroups(dateISO: string, rows: KitchenOrdersApiRow[]): KitchenGroup[] {
  const map = new Map<string, KitchenGroup>();

  for (const r of rows) {
    const delivery_window = r.delivery_slot || "—";
    const company = r.company_name || "Ukjent firma";
    const location = r.location_name || "Ukjent lokasjon";
    const company_location_id = r.location_id;

    const key = `${r.delivery_date || dateISO}__${delivery_window}__${company_location_id}`;

    const rowStatus = normalizeBatchStatus(r.status);

    if (!map.has(key)) {
      map.set(key, {
        delivery_date: r.delivery_date || dateISO,
        delivery_window,
        company,
        location,
        company_location_id,
        batch_status: rowStatus,
        packed_at: r.packed_at ?? null,
        delivered_at: r.delivered_at ?? null,
        orders: [],
      });
    } else {
      // Aggreger batch-status (delivered > packed > queued)
      const g = map.get(key)!;
      g.batch_status = maxStatus(g.batch_status, rowStatus);

      // behold første ikke-null tidsstempel (hvis flere rader har samme)
      if (!g.packed_at && r.packed_at) g.packed_at = r.packed_at;
      if (!g.delivered_at && r.delivered_at) g.delivered_at = r.delivered_at;
    }

    map.get(key)!.orders.push({
      id: r.order_id,
      full_name: r.employee_name || "Ukjent",
      department: r.employee_department ?? null,
      note: r.order_note ?? null,
    });
  }

  return Array.from(map.values()).sort((a, b) => {
    const w = a.delivery_window.localeCompare(b.delivery_window, "nb");
    if (w !== 0) return w;
    const c = a.company.localeCompare(b.company, "nb");
    if (c !== 0) return c;
    return a.location.localeCompare(b.location, "nb");
  });
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

  // ✅ Inline feedback rett under batch-kortet (ikke nederst på siden)
  const [inlineNotice, setInlineNotice] = useState<{
    key: string; // groupKey = date__window__loc
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

  // ✅ velg dato (Oslo) – default i dag (ISO internt)
  const [dateISO, setDateISO] = useState<string>(fmtOsloYMDNow());

  useEffect(() => {
    const t = setInterval(() => setTick((x) => x + 1), 60_000);
    return () => clearInterval(t);
  }, []);

  // ESC lukker drawer (og inline notice hvis du vil)
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpenGroupKey(null);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  async function fetchDayOnce(dISO: string): Promise<KitchenGroup[]> {
    if (!isISODate(dISO)) throw new Error("Ugyldig dato");

    const res = await fetch(`/api/kitchen/orders?date=${encodeURIComponent(dISO)}`, {
      cache: "no-store",
    });

    const txt = await res.text();

    if (!res.ok) {
      const maybe = safeJsonParse<any>(txt);
      const detail =
        typeof maybe?.detail === "string"
          ? maybe.detail
          : maybe?.detail
          ? JSON.stringify(maybe.detail)
          : null;

      throw new Error(detail || maybe?.message || maybe?.error || txt || "Kunne ikke hente bestillinger");
    }

    const json = safeJsonParse<KitchenOrdersApiResponse>(txt);
    if (!json || typeof json !== "object") throw new Error("Ugyldig respons fra server");

    if (!("ok" in json) || json.ok !== true) {
      const detail =
        typeof (json as any)?.detail === "string"
          ? (json as any).detail
          : (json as any)?.detail
          ? JSON.stringify((json as any).detail)
          : null;
      const err = (json as any)?.error || "Kunne ikke hente bestillinger";
      throw new Error(detail || err);
    }

    const rows = (json as any).rows as KitchenOrdersApiRow[];
    return rowsToGroups(dISO, rows ?? []);
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
        // lite retry
        await sleep(1200);
        const groups = await fetchDayOnce(dateISO);
        setData(groups);
        setLastUpdated(fmtOsloHMSNow());
        setLastSuccessAt(Date.now());
        setHardErr(null);
        return;
      }
    } catch (e: any) {
      const msg = e?.message || "Kunne ikke hente bestillinger";
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

  // Reload når dato endres (og auto-refresh hvert 30s)
  useEffect(() => {
    load();
    const t = setInterval(load, 30_000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateISO]);

  // Lukker drawer hvis data endres og batchen ikke finnes i data
  useEffect(() => {
    if (!openGroupKey) return;
    const exists = (data ?? []).some(
      (g) => `${g.delivery_date}__${g.delivery_window}__${g.company_location_id}` === openGroupKey
    );
    if (!exists) setOpenGroupKey(null);
  }, [data, openGroupKey]);

  const windows = useMemo(() => {
    const set = new Set<string>();
    (data ?? []).forEach((g) => set.add(g.delivery_window));
    return ["ALL", ...Array.from(set).sort((a, b) => a.localeCompare(b, "nb"))];
  }, [data]);

  const filteredGroups = useMemo(() => {
    let groups = data ?? [];

    if (activeWindow !== "ALL") {
      groups = groups.filter((g) => g.delivery_window === activeWindow);
    }

    if (onlyNotDelivered) {
      groups = groups.filter((g) => g.batch_status !== "delivered");
    }

    return groups;
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

  const headerMeta = useMemo(() => {
    const d = dateISO;
    const windowsCount = new Set(filteredGroups.map((g) => g.delivery_window)).size;
    return { date: d, windowsCount };
  }, [filteredGroups, dateISO]);

  const staleMins = useMemo(() => {
    void tick;
    if (!lastSuccessAt) return null;
    return minsSince(lastSuccessAt);
  }, [lastSuccessAt, tick]);

  const STALE_WARN_MIN = 3;
  const STALE_CRIT_MIN = 10;

  const staleBanner = useMemo(() => {
    if (staleMins == null) return null;
    if (staleMins < STALE_WARN_MIN) return null;

    const isCrit = staleMins >= STALE_CRIT_MIN;
    return {
      text: isCrit
        ? `Viktig: Data har ikke oppdatert på ${staleLabel(staleMins)}. Sjekk nett / API, eller oppdater siden.`
        : `Merk: Data har ikke oppdatert på ${staleLabel(staleMins)}. Viser siste vellykkede oppdatering.`,
      cls: isCrit
        ? "border-red-200 bg-red-50 text-red-900"
        : "border-amber-200 bg-amber-50 text-amber-900",
      dot: isCrit ? "bg-red-500" : "bg-amber-500",
      meta: `Siste vellykkede oppdatering: ${lastUpdated ?? "—"}`,
    };
  }, [staleMins, lastUpdated]);

  const printId = useMemo(() => {
    const dateForId = headerMeta.date || fmtOsloYMDNow(); // ISO
    const windowLabel = activeWindow === "ALL" ? "ALL" : activeWindow;
    return makeKitchenPrintId({ dateISO: dateForId, windowLabel, totalKuverter });
  }, [headerMeta.date, activeWindow, totalKuverter]);

  async function mark(g: KitchenGroup, status: BatchStatus) {
    const busy = `${g.delivery_date}:${g.delivery_window}:${g.company_location_id}`;
    setBusyKey(busy);

    const groupKey = `${g.delivery_date}__${g.delivery_window}__${g.company_location_id}`;

    // ✅ Oppdater inline notice (ved samme kort)
    const target = {
      delivery_date: g.delivery_date,
      delivery_window: g.delivery_window,
      company_location_id: g.company_location_id,
      company: g.company,
    };

    // ✅ Vis umiddelbar feedback rett under kortet
    setInlineNotice({
      key: groupKey,
      message:
        status === "packed" ? "Markert pakket" : status === "delivered" ? "Markert levert" : "Merking fjernet",
      canUndo: status !== "queued",
      target,
    });

    try {
      await setBatchStatus({
        delivery_date: g.delivery_date,
        delivery_window: g.delivery_window,
        company_location_id: g.company_location_id,
        status,
      });

      // refresh for å få korrekt status fra GET (etter merge)
      await load();
    } catch (e: any) {
      // Vis feilen rett under samme kort
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
    if (g.batch_status === "delivered") return;

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

    const payload = {
      delivery_date: target.delivery_date,
      delivery_window: target.delivery_window,
      company_location_id: target.company_location_id,
      status: "queued" as BatchStatus,
    };

    const busy = `${payload.delivery_date}:${payload.delivery_window}:${payload.company_location_id}`;
    setBusyKey(busy);

    try {
      await setBatchStatus(payload);
      setInlineNotice((prev) =>
        prev
          ? {
              ...prev,
              message: "Merking fjernet",
              canUndo: false,
            }
          : prev
      );
      await load();
    } catch (e: any) {
      setInlineNotice((prev) =>
        prev
          ? {
              ...prev,
              message: e?.message || "Kunne ikke fjerne merking",
              canUndo: false,
            }
          : prev
      );
    } finally {
      setBusyKey(null);
    }
  }

  async function copyToClipboard(text: string) {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        // liten, diskret feedback (øverst ville vært støy) – vi gjenbruker inlineNotice ikke her
        return;
      }
    } catch {
      // fallback
    }

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
    } catch {
      // ignorer
    }
  }

  async function findNextDayWithOrders() {
    // søker fremover i 14 dager, hopper over helg
    let cur = dateISO;
    for (let i = 0; i < 14; i++) {
      cur = nextBusinessDayISO(cur);
      const groups = await fetchDayOnce(cur);
      if (groups.length > 0) {
        setDateISO(cur);
        return;
      }
    }
    // legg beskjed i en nøytral inline notice (ikke knyttet til kort)
    setInlineNotice({
      key: "__GLOBAL__",
      message: "Fant ingen dager med bestillinger de neste 14 dagene.",
      canUndo: false,
    });
  }

  /* =========================
     UI
  ========================= */
  const dateLabel = formatDateForLocale(headerMeta.date || dateISO);

  // Drawer-data: finn valgt group (fra data, ikke filtrert)
  const openGroup = useMemo(() => {
    if (!openGroupKey) return null;
    return (
      (data ?? []).find(
        (g) => `${g.delivery_date}__${g.delivery_window}__${g.company_location_id}` === openGroupKey
      ) || null
    );
  }, [openGroupKey, data]);

  return (
    <div className="space-y-6">
      {/* PRINT */}
      <style>{`
        @media print {
          @page { margin: 12mm; }
          html, body { background: #fff !important; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }

          table { page-break-inside: avoid; }
          tr, td, th { page-break-inside: avoid; }
          section { break-inside: avoid; page-break-inside: avoid; }

          button, input, select, textarea { display: none !important; }

          .lp-print-border { border: 1px solid #e5e7eb !important; }
          .lp-print-tight { padding: 0 !important; margin: 0 !important; }
          .lp-print-mt { margin-top: 10mm !important; }
          .lp-print-h2 { font-size: 14pt !important; line-height: 1.2 !important; }
          .lp-print-meta { font-size: 10pt !important; color: #374151 !important; }
          .lp-print-summary { margin-top: 6mm !important; }
          a[href]:after { content: "" !important; }

          .lp-sign { margin-top: 6mm !important; }
          .lp-sign-row { display: flex !important; gap: 10mm !important; }
          .lp-sign-box { flex: 1 1 0%; }
          .lp-sign-label { font-size: 10pt !important; color: #374151 !important; margin-bottom: 2mm !important; }
          .lp-sign-line { border-bottom: 1px solid #111827 !important; height: 8mm !important; }
          .lp-sign-meta { font-size: 9pt !important; color: #6b7280 !important; margin-top: 2mm !important; }

          .lp-print-footer {
            position: fixed;
            bottom: 0;
            left: 0;
            right: 0;
            text-align: center;
            font-size: 9pt;
            color: #374151;
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
              Vinduer: <span className="font-semibold">{headerMeta.windowsCount}</span>
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
              <div
                key={company}
                className="flex items-center justify-between border-b border-slate-200 py-1 last:border-0"
              >
                <span className="text-slate-700">{company}</span>
                <span className="font-semibold text-black">{count}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="lp-print-mt" />
      </div>

      {/* Stale banner */}
      {(() => {
        const stale = (() => {
          if (staleMins == null) return null;
          if (staleMins < 3) return null;
          const isCrit = staleMins >= 10;
          return {
            text: isCrit
              ? `Viktig: Data har ikke oppdatert på ${staleLabel(staleMins)}. Sjekk nett / API, eller oppdater siden.`
              : `Merk: Data har ikke oppdatert på ${staleLabel(staleMins)}. Viser siste vellykkede oppdatering.`,
            cls: isCrit
              ? "border-red-200 bg-red-50 text-red-900"
              : "border-amber-200 bg-amber-50 text-amber-900",
            dot: isCrit ? "bg-red-500" : "bg-amber-500",
            meta: `Siste vellykkede oppdatering: ${lastUpdated ?? "—"}`,
          };
        })();

        if (!stale) return null;

        return (
          <div className={["print:hidden rounded-2xl border px-4 py-3 text-sm", stale.cls].join(" ")}>
            <div className="flex items-start gap-3">
              <span aria-hidden className={["mt-1 h-2 w-2 rounded-full", stale.dot].join(" ")} />
              <div className="min-w-0">
                <div className="font-semibold">{stale.text}</div>
                <div className="mt-1 text-xs opacity-90">{stale.meta}</div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Soft warning */}
      {softWarning && (
        <div className="print:hidden rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {softWarning}
        </div>
      )}

      {/* Hard error (første load) */}
      {hardErr && (!data || data.length === 0) && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">
          {hardErr}
        </div>
      )}

      {/* Controls */}
      <div className="print:hidden space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            {windows.map((w) => (
              <Chip
                key={w}
                active={activeWindow === w}
                label={w === "ALL" ? "Alle" : w}
                onClick={() => setActiveWindow(w)}
              />
            ))}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => window.print()}
              className="rounded-xl border border-[rgb(var(--lp-border))] bg-white px-4 py-2 text-sm font-semibold text-[rgb(var(--lp-text))] shadow-sm hover:bg-[rgb(var(--lp-bg))]"
              type="button"
            >
              Skriv ut
            </button>

            <button
              onClick={() => load()}
              className="rounded-xl border border-[rgb(var(--lp-border))] bg-white px-4 py-2 text-sm font-semibold text-[rgb(var(--lp-text))] shadow-sm hover:bg-[rgb(var(--lp-bg))]"
              type="button"
            >
              Oppdater
            </button>
          </div>
        </div>

        {/* Date controls */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setDateISO(addDaysISO(dateISO, -1))}
            className="rounded-xl border border-[rgb(var(--lp-border))] bg-white px-3 py-2 text-sm font-semibold hover:bg-[rgb(var(--lp-bg))]"
          >
            ← Forrige
          </button>

          <button
            type="button"
            onClick={() => setDateISO(fmtOsloYMDNow())}
            className="rounded-xl border border-[rgb(var(--lp-border))] bg-white px-3 py-2 text-sm font-semibold hover:bg-[rgb(var(--lp-bg))]"
          >
            I dag
          </button>

          <button
            type="button"
            onClick={() => setDateISO(addDaysISO(dateISO, 1))}
            className="rounded-xl border border-[rgb(var(--lp-border))] bg-white px-3 py-2 text-sm font-semibold hover:bg-[rgb(var(--lp-bg))]"
          >
            Neste →
          </button>

          <label className="ml-2 inline-flex items-center gap-2 rounded-xl border border-[rgb(var(--lp-border))] bg-white px-3 py-2 text-sm">
            <span aria-hidden>📅</span>
            <input
              type="date"
              value={dateISO}
              onChange={(e) => setDateISO(e.target.value)}
              className="bg-transparent outline-none"
            />
          </label>

          <button
            type="button"
            onClick={() => setDateISO(nextBusinessDayISO(dateISO))}
            className="rounded-xl border border-[rgb(var(--lp-border))] bg-white px-3 py-2 text-sm font-semibold hover:bg-[rgb(var(--lp-bg))]"
            title="Hopper til neste ukedag (Man–Fre)"
          >
            Neste leveringsdag
          </button>

          <button
            type="button"
            onClick={findNextDayWithOrders}
            className="rounded-xl bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:opacity-95"
            title="Finn neste dag (fremover) som faktisk har bestillinger"
          >
            Finn neste med bestillinger
          </button>

          <span className="ml-2 text-sm text-[rgb(var(--lp-muted))]">
            <span className="font-semibold text-[rgb(var(--lp-text))]">Dato:</span>{" "}
            {formatDateForLocale(dateISO)}
            <span className="ml-2 text-xs opacity-60">({dateISO})</span>
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <label className="inline-flex items-center gap-2 text-sm text-[rgb(var(--lp-text))]">
            <input
              type="checkbox"
              checked={onlyNotDelivered}
              onChange={(e) => setOnlyNotDelivered(e.target.checked)}
            />
            Kun ikke levert
          </label>

          <div className="flex flex-wrap items-center gap-2 text-sm text-[rgb(var(--lp-muted))]">
            <span>Oppdateres automatisk hvert 30. sekund</span>
            <span className="mx-2">•</span>
            <span>
              Sist oppdatert:{" "}
              <span className="font-semibold text-[rgb(var(--lp-text))]">{lastUpdated ?? "—"}</span>
            </span>
            <span className="mx-2">•</span>
            <span className="inline-flex items-center gap-2">
              <span
                aria-hidden
                className={[
                  "h-2 w-2 rounded-full",
                  isRefreshing ? "bg-amber-500" : "bg-emerald-500",
                ].join(" ")}
              />
              <span className="text-[rgb(var(--lp-muted))]">{isRefreshing ? "Oppdaterer…" : "Live"}</span>
            </span>
          </div>
        </div>

        {/* Screen ID */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-[rgb(var(--lp-muted))]">Kjøkken-ID:</span>

          <code className="rounded-lg border border-[rgb(var(--lp-border))] bg-white px-3 py-1.5 text-sm text-[rgb(var(--lp-text))]">
            {printId}
          </code>

          <button
            type="button"
            onClick={() => copyToClipboard(printId)}
            className="rounded-xl border border-[rgb(var(--lp-border))] bg-white px-3 py-2 text-sm font-semibold text-[rgb(var(--lp-text))] shadow-sm hover:bg-[rgb(var(--lp-bg))]"
          >
            Kopier
          </button>

          <span className="text-xs text-[rgb(var(--lp-muted))]">Brukes for sporbarhet i utskrift/arkiv.</span>
        </div>

        {/* Global inline notice (ikke knyttet til et kort) */}
        {inlineNotice?.key === "__GLOBAL__" && (
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800">
            {inlineNotice.message}
          </div>
        )}
      </div>

      {/* Empty state (viser fortsatt kontroller over) */}
      {!loading && (!data || data.length === 0) && !hardErr && (
        <div className="rounded-2xl border border-[rgb(var(--lp-border))] bg-white p-4 text-sm text-[rgb(var(--lp-muted))]">
          Ingen aktive bestillinger for valgt dato.
          <div className="mt-3 flex flex-wrap gap-2 print:hidden">
            <button
              type="button"
              onClick={() => setDateISO(nextBusinessDayISO(dateISO))}
              className="rounded-xl border border-[rgb(var(--lp-border))] bg-white px-3 py-2 text-sm font-semibold hover:bg-[rgb(var(--lp-bg))]"
            >
              Gå til neste leveringsdag
            </button>
            <button
              type="button"
              onClick={findNextDayWithOrders}
              className="rounded-xl bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:opacity-95"
            >
              Finn neste dag med bestillinger
            </button>
          </div>
        </div>
      )}

      {/* Company totals */}
      {data && data.length > 0 && (
        <div className="rounded-2xl border border-[rgb(var(--lp-border))] bg-white p-4 text-sm print:hidden">
          <div className="mb-2 font-semibold text-[rgb(var(--lp-text))]">Sum per firma (visning)</div>

          {companyTotals.length === 0 ? (
            <p className="text-[rgb(var(--lp-muted))]">Ingen data i valgt visning.</p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              {companyTotals.map(([company, count]) => (
                <div
                  key={company}
                  className="flex items-center justify-between border-b border-[rgb(var(--lp-divider))] py-1 last:border-0"
                >
                  <span className="text-[rgb(var(--lp-muted))]">{company}</span>
                  <span className="font-semibold text-[rgb(var(--lp-text))]">{count}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Groups */}
      {filteredGroups.map((g, i) => {
        const busy = `${g.delivery_date}:${g.delivery_window}:${g.company_location_id}`;
        const isBusy = busyKey === busy;

        const v = groupVisualState(g.batch_status);

        const groupKey = `${g.delivery_date}__${g.delivery_window}__${g.company_location_id}`;

        const inlineForThis = inlineNotice?.key === groupKey ? inlineNotice : null;

        return (
          <div key={`${g.delivery_window}:${g.company_location_id}:${i}`} className="space-y-3">
            <section
              role="button"
              tabIndex={0}
              onClick={() => setOpenGroupKey(groupKey)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") setOpenGroupKey(groupKey);
              }}
              className={[
                "rounded-2xl border border-[rgb(var(--lp-border))] bg-white p-4 shadow-sm",
                "print:shadow-none print:rounded-none print:border-0 print:p-0 print:break-inside-avoid",
                "cursor-pointer transition hover:border-slate-300 hover:shadow-md",
                v.sectionClass,
              ].join(" ")}
              title="Klikk for å åpne batch"
            >
              <header className="mb-3 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-[rgb(var(--lp-text))]">
                    {g.delivery_window} – {g.company}
                  </h2>
                  <p className="text-sm text-[rgb(var(--lp-muted))]">{g.location}</p>

                  <p className="mt-1 text-sm">
                    <span className="text-[rgb(var(--lp-muted))]">Kuverter:</span>{" "}
                    <span className="font-semibold text-[rgb(var(--lp-text))]">{g.orders.length}</span>
                  </p>

                  {(g.packed_at || g.delivered_at) && (
                    <p className="mt-1 text-xs text-[rgb(var(--lp-muted))]">
                      {g.packed_at ? `Pakket: ${fmtOsloTime(g.packed_at)}` : null}
                      {g.packed_at && g.delivered_at ? <span className="mx-2">•</span> : null}
                      {g.delivered_at ? `Levert: ${fmtOsloTime(g.delivered_at)}` : null}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  <span
                    className={[
                      "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold",
                      v.headerBadge,
                    ].join(" ")}
                  >
                    <span aria-hidden className={["h-2 w-2 rounded-full", v.headerDot].join(" ")} />
                    {v.headerLabel}
                  </span>

                  <div className="flex gap-2 print:hidden">
                    <button
                      className="rounded-xl border border-[rgb(var(--lp-border))] bg-white px-3 py-2 text-sm font-semibold text-[rgb(var(--lp-text))] hover:bg-[rgb(var(--lp-bg))] disabled:opacity-60"
                      type="button"
                      disabled={isBusy || g.batch_status !== "queued"}
                      onClick={(e) => {
                        e.stopPropagation();
                        mark(g, "packed");
                      }}
                    >
                      {isBusy ? "Oppdaterer…" : "Marker pakket"}
                    </button>

                    <button
                      className="rounded-xl border border-[rgb(var(--lp-border))] bg-white px-3 py-2 text-sm font-semibold text-[rgb(var(--lp-text))] hover:bg-[rgb(var(--lp-bg))] disabled:opacity-60"
                      type="button"
                      disabled={isBusy || g.batch_status === "delivered"}
                      onClick={(e) => {
                        e.stopPropagation();
                        markDeliveredWithConfirm(g);
                      }}
                    >
                      {isBusy ? "Oppdaterer…" : "Marker levert"}
                    </button>
                  </div>
                </div>
              </header>

              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-[rgb(var(--lp-divider))]">
                    <th className="py-2 text-left font-semibold text-[rgb(var(--lp-text))]">Navn</th>
                    <th className="py-2 text-left font-semibold text-[rgb(var(--lp-text))]">Avdeling</th>
                    <th className="py-2 text-left font-semibold text-[rgb(var(--lp-text))]">Notat</th>
                  </tr>
                </thead>
                <tbody>
                  {g.orders.map((o, idx) => (
                    <tr
                      key={`${o.id}:${idx}`}
                      className="border-b border-[rgb(var(--lp-divider))] last:border-0"
                    >
                      <td className="py-2 text-[rgb(var(--lp-text))]">{o.full_name}</td>
                      <td className="py-2 text-[rgb(var(--lp-muted))]">{o.department || "–"}</td>
                      <td className="py-2 text-[rgb(var(--lp-text))]">{o.note || ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* PRINT signatur */}
              <div className="hidden print:block lp-sign">
                <div className="lp-sign-row">
                  <div className="lp-sign-box">
                    <div className="lp-sign-label">
                      Pakket av (navn + signatur)
                      {g.packed_at ? (
                        <span className="lp-sign-meta"> • Tid: {fmtOsloTime(g.packed_at)}</span>
                      ) : null}
                    </div>
                    <div className="lp-sign-line" />
                    <div className="lp-sign-meta">
                      Batch: {g.delivery_window} • {g.company} • {g.location}
                    </div>
                  </div>

                  <div className="lp-sign-box">
                    <div className="lp-sign-label">
                      Levert av (navn + signatur)
                      {g.delivered_at ? (
                        <span className="lp-sign-meta"> • Tid: {fmtOsloTime(g.delivered_at)}</span>
                      ) : null}
                    </div>
                    <div className="lp-sign-line" />
                    <div className="lp-sign-meta">
                      Dato: {formatDateForLocale(g.delivery_date)} • Lokasjon ID: {g.company_location_id}
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* ✅ Inline feedback rett under akkurat denne batchen */}
            {inlineForThis && (
              <div
                className={[
                  "rounded-2xl border bg-white px-4 py-3 text-sm",
                  inlineForThis.message.toLowerCase().includes("kunne ikke")
                    ? "border-red-200 bg-red-50 text-red-900"
                    : "border-pink-200 bg-pink-50 text-pink-900",
                ].join(" ")}
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <span>{inlineForThis.message}</span>

                  {inlineForThis.canUndo && inlineForThis.target && (
                    <button
                      type="button"
                      onClick={() => unmarkInline(inlineForThis.target!)}
                      className="rounded-xl border border-pink-200 bg-white px-3 py-2 text-sm font-semibold text-pink-700 hover:bg-pink-50 disabled:opacity-60"
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

      {/* Footer totals */}
      {data && data.length > 0 && (
        <div className="pt-2 text-sm print:hidden">
          <span className="text-[rgb(var(--lp-muted))]">Totalt (visning):</span>{" "}
          <span className="font-semibold text-[rgb(var(--lp-text))]">{totalKuverter}</span>
        </div>
      )}

      <div className="hidden print:block lp-print-footer" />
      {loading && <p className="text-sm text-[rgb(var(--lp-muted))]">Laster kjøkkenliste…</p>}

      {/* =========================
          Drawer / åpne batch
         ========================= */}
      {openGroup && (
        <div
          className="fixed inset-0 z-50 bg-black/30 p-4 print:hidden"
          onClick={() => setOpenGroupKey(null)}
          aria-modal="true"
          role="dialog"
        >
          <div
            className="mx-auto mt-10 w-full max-w-4xl rounded-2xl border border-slate-200 bg-white p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            {(() => {
              const v = groupVisualState(openGroup.batch_status);

              return (
                <>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-lg font-semibold text-slate-900">
                          {openGroup.delivery_window} – {openGroup.company}
                        </h3>

                        <span
                          className={[
                            "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold",
                            v.headerBadge,
                          ].join(" ")}
                        >
                          <span aria-hidden className={["h-2 w-2 rounded-full", v.headerDot].join(" ")} />
                          {v.headerLabel}
                        </span>
                      </div>

                      <p className="mt-1 text-sm text-slate-600">{openGroup.location}</p>

                      <div className="mt-2 flex flex-wrap gap-3 text-sm">
                        <div className="text-slate-700">
                          Kuverter:{" "}
                          <span className="font-semibold text-slate-900">{openGroup.orders.length}</span>
                        </div>
                        <div className="text-slate-700">
                          Dato:{" "}
                          <span className="font-semibold text-slate-900">
                            {formatDateForLocale(openGroup.delivery_date)}
                          </span>
                        </div>
                        {openGroup.packed_at ? (
                          <div className="text-slate-700">
                            Pakket:{" "}
                            <span className="font-semibold text-slate-900">
                              {fmtOsloTime(openGroup.packed_at)}
                            </span>
                          </div>
                        ) : null}
                        {openGroup.delivered_at ? (
                          <div className="text-slate-700">
                            Levert:{" "}
                            <span className="font-semibold text-slate-900">
                              {fmtOsloTime(openGroup.delivered_at)}
                            </span>
                          </div>
                        ) : null}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold hover:bg-slate-50"
                        onClick={() => window.print()}
                      >
                        Skriv ut
                      </button>

                      <button
                        type="button"
                        className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold hover:bg-slate-50"
                        onClick={() => setOpenGroupKey(null)}
                      >
                        Lukk
                      </button>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold hover:bg-slate-50 disabled:opacity-60"
                      disabled={openGroup.batch_status !== "queued"}
                      onClick={async () => {
                        await mark(openGroup, "packed");
                      }}
                    >
                      Marker pakket
                    </button>

                    <button
                      type="button"
                      className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold hover:bg-slate-50 disabled:opacity-60"
                      disabled={openGroup.batch_status === "delivered"}
                      onClick={async () => {
                        await markDeliveredWithConfirm(openGroup);
                      }}
                    >
                      Marker levert
                    </button>
                  </div>

                  <div className="mt-4 rounded-xl border border-slate-200">
                    <div className="grid grid-cols-12 gap-2 border-b border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700">
                      <div className="col-span-4">Navn</div>
                      <div className="col-span-3">Avdeling</div>
                      <div className="col-span-5">Notat</div>
                    </div>

                    <div className="divide-y">
                      {openGroup.orders.map((o) => (
                        <div key={o.id} className="grid grid-cols-12 gap-2 px-3 py-2 text-sm">
                          <div className="col-span-4 text-slate-900">{o.full_name}</div>
                          <div className="col-span-3 text-slate-600">{o.department || "–"}</div>
                          <div className="col-span-5 text-slate-900">{o.note || ""}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="mt-3 text-xs text-slate-500">Tips: Trykk ESC for å lukke.</div>
                </>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}
