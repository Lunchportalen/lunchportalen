// STATUS: KEEP

// components/superadmin/AlertsTable.tsx
"use client";

export default function AlertsTable() {
  return (
    <div className="lp-card">
      <div className="lp-card-head">
        <h2 className="lp-h2">Varsler</h2>
        <p className="lp-muted">Oversikt over avvik/varsler (MVP-plassholder).</p>
      </div>

      <div className="lp-card-body">
        <div className="lp-empty">
          Ingen varsler å vise enda.
        </div>
      </div>
    </div>
  );
}
