import Link from "next/link";

function osloNowParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Oslo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return {
    year: Number(get("year")),
    month: Number(get("month")),
    day: Number(get("day")),
  };
}

function isoWeekNumber(year: number, month: number, day: number) {
  const d = new Date(Date.UTC(year, month - 1, day));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

export function formatAdminTopbarDate(date = new Date()) {
  const parts = osloNowParts(date);
  const weekday = new Intl.DateTimeFormat("nb-NO", {
    timeZone: "Europe/Oslo",
    weekday: "long",
  }).format(date);
  const capitalizedWeekday = weekday ? weekday[0].toUpperCase() + weekday.slice(1) : "I dag";
  const dd = String(parts.day).padStart(2, "0");
  const mm = String(parts.month).padStart(2, "0");
  const yyyy = String(parts.year);
  return `${capitalizedWeekday} ${dd}.${mm}.${yyyy} · uke ${isoWeekNumber(parts.year, parts.month, parts.day)}`;
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="11" cy="11" r="6" />
      <path d="m16 16 4 4" />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 3v12M8 11l4 4 4-4M5 21h14" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

export default function AdminTopbar({ pageTitle = "Oversikt" }: { pageTitle?: string }) {
  return (
    <header className="ds-admin-topbar">
      <div className="ds-admin-topbar__title">
        <div className="ds-admin-topbar__eyebrow">{formatAdminTopbarDate()}</div>
        <h1 className="ds-admin-topbar__h1">{pageTitle}</h1>
      </div>

      <div className="ds-admin-topbar__actions">
        <button type="button" className="ds-admin-search" aria-label="Søk">
          <SearchIcon />
          <span>Søk ansatte, ordrer ...</span>
        </button>
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a href="/api/admin/invoices/csv" className="ds-btn ds-btn--ghost ds-btn--sm">
          <DownloadIcon />
          <span>Faktura</span>
        </a>
        <Link href="/admin/invite" className="ds-btn ds-btn--primary ds-btn--sm">
          <PlusIcon />
          <span>Inviter ansatte</span>
        </Link>
      </div>
    </header>
  );
}
