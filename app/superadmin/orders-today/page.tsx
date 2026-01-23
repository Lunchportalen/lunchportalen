// app/superadmin/orders-today/page.tsx
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default function OrdersTodayPage() {
  return (
    <main className="lp-container">
      <h1 className="lp-h1">Dagens ordre</h1>
      <p className="lp-muted mt-2">
        Oversikt over dagens aktive bestillinger. (Kommer: filter, eksport/print, og grupper per
        leveringsvindu → firma → lokasjon.)
      </p>

      <div className="lp-card lp-card-pad mt-6">
        <div className="lp-row">
          <div>
            <div className="lp-sectionTitle">Status</div>
            <div className="lp-listMeta mt-1">Siden er opprettet og ruten er aktiv.</div>
          </div>
          <span className="lp-chip lp-chip-ok">OK</span>
        </div>

        <div className="lp-divider my-5" />

        <div className="lp-listMeta">
          Neste steg: koble til din eksisterende OperationsToday-komponent / queries og rendrer
          faktiske data.
        </div>
      </div>
    </main>
  );
}
