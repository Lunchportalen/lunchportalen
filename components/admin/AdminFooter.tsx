// components/admin/AdminFooter.tsx
export default function AdminFooter({ status = "ok", rid }: { status?: "ok" | "error"; rid?: string | null }) {
  const year = new Date().getFullYear();
  const statusLabel = status === "error" ? "Feil" : "OK";

  return (
    <footer className="mt-10 border-t border-[rgb(var(--lp-border))] bg-[rgb(var(--lp-bg))]">
      <div className="lp-container py-6 text-xs text-[rgb(var(--lp-muted))]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="font-semibold text-[rgb(var(--lp-text))]">Lunchportalen — Admin</div>
          <div className="flex flex-wrap items-center gap-4">
            <span>Systemstatus: {statusLabel}</span>
            {rid ? <span>RID: {rid}</span> : null}
            <span>© {year} Lunchportalen</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
