// app/(app)/dashboard/page.tsx
import Link from "next/link";
import { getOverlayBySlug } from "@/lib/cms/public/getOverlayByKey";
import { APP_OVERLAYS } from "@/lib/cms/overlays/registry";
import { renderOverlaySlot } from "@/lib/public/blocks/renderOverlaySlot";

type Status = "ACTIVE" | "PAUSED" | "CLOSED" | "PENDING";

function StatusChip({ status }: { status: Status }) {
  const map: Record<Status, { label: string; color: string }> = {
    ACTIVE: { label: "ACTIVE", color: "var(--ok)" },
    PAUSED: { label: "PAUSED", color: "var(--warn)" },
    CLOSED: { label: "CLOSED", color: "var(--bad)" },
    PENDING: { label: "PENDING", color: "var(--neutral)" },
  };

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 10,
        padding: "10px 12px",
        borderRadius: 999,
        background: "rgba(255,255,255,0.05)",
        border: "1px solid var(--border)",
        color: "var(--text)",
        fontSize: 12,
        letterSpacing: 0.6,
      }}
    >
      <span
        aria-hidden
        style={{
          width: 8,
          height: 8,
          borderRadius: 999,
          background: map[status].color,
          boxShadow: `0 0 0 3px rgba(0,0,0,0.25)`,
        }}
      />
      {map[status].label}
    </span>
  );
}

function Panel({
  title,
  children,
  right,
}: {
  title: string;
  children: React.ReactNode;
  right?: React.ReactNode;
}) {
  return (
    <section
      style={{
        borderRadius: "var(--r-lg)",
        background: "var(--panel)",
        border: "1px solid var(--border)",
        boxShadow: "var(--shadow-soft)",
        overflow: "hidden",
      }}
    >
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "18px 18px",
          borderBottom: "1px solid var(--border)",
          background: "rgba(255,255,255,0.03)",
        }}
      >
        <div style={{ fontSize: 14, color: "var(--text)", fontWeight: 600 }}>
          {title}
        </div>
        {right}
      </header>
      <div style={{ padding: 18 }}>{children}</div>
    </section>
  );
}

function PrimaryCTA({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        height: 44,
        padding: "0 16px",
        borderRadius: 12,
        background: "var(--hotpink)",
        color: "#0b0d12",
        fontWeight: 700,
        textDecoration: "none",
        boxShadow: "0 16px 40px rgba(255,0,127,0.18)",
      }}
    >
      {label}
    </Link>
  );
}

function GhostCTA({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        height: 44,
        padding: "0 14px",
        borderRadius: 12,
        background: "rgba(255,255,255,0.04)",
        border: "1px solid var(--border)",
        color: "var(--text)",
        textDecoration: "none",
        fontWeight: 600,
      }}
    >
      {label}
    </Link>
  );
}

function KPI({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div
      style={{
        borderRadius: "var(--r-md)",
        background: "rgba(255,255,255,0.04)",
        border: "1px solid var(--border)",
        padding: 16,
      }}
    >
      <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 8 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: -0.4 }}>{value}</div>
      <div style={{ fontSize: 12, color: "var(--faint)", marginTop: 8 }}>{hint}</div>
    </div>
  );
}

export default async function DashboardPage() {
  const overlay = await getOverlayBySlug(APP_OVERLAYS.dashboard.slug, { locale: "nb", environment: "prod" });
  const topBanner = overlay.ok ? renderOverlaySlot(overlay.blocks, "topBanner", "prod", "nb") : null;
  const headerSlot = overlay.ok ? renderOverlaySlot(overlay.blocks, "header", "prod", "nb") : null;
  const helpSlot = overlay.ok ? renderOverlaySlot(overlay.blocks, "help", "prod", "nb") : null;
  const footerCtaSlot = overlay.ok ? renderOverlaySlot(overlay.blocks, "footerCta", "prod", "nb") : null;

  // Demo-data — kobles mot deres ekte API/SSR senere
  const companyName = "Acme AS";
  const status: Status = "ACTIVE";
  const nextDelivery = "Mandag 16.02 • 10:30–11:15";

  return (
    <main style={{ maxWidth: 1200, margin: "0 auto", padding: "var(--s-4) var(--s-2)" }}>
      {topBanner ? <div style={{ marginBottom: 12 }}>{topBanner}</div> : null}
      {headerSlot ? <div style={{ marginBottom: 12 }}>{headerSlot}</div> : null}
      {/* Topbar */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "var(--s-3)",
        }}
      >
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <div style={{ fontWeight: 800, letterSpacing: 0.2 }}>Lunchportalen</div>
          <StatusChip status={status} />
        </div>

        <div style={{ color: "var(--muted)", fontSize: 13 }}>
          System: OK • Oslo
        </div>
      </div>

      {/* Command Header */}
      <section
        style={{
          borderRadius: "var(--r-lg)",
          background: "var(--panel-strong)",
          border: "1px solid var(--border)",
          boxShadow: "var(--shadow)",
          padding: "22px 22px",
          marginBottom: "var(--s-3)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 8 }}>Firma</div>
            <div style={{ fontSize: 26, fontWeight: 900, letterSpacing: -0.6 }}>{companyName}</div>
            <div style={{ marginTop: 10, color: "var(--muted)", fontSize: 13 }}>
              Neste levering: <span style={{ color: "var(--text)", fontWeight: 650 }}>{nextDelivery}</span>
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <GhostCTA href="/week" label="Se ukesplan" />
            <PrimaryCTA href="/admin/users" label="Oppdater ansatte" />
          </div>
        </div>
      </section>

      {/* KPI-strip */}
      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
          gap: 12,
          marginBottom: "var(--s-3)",
        }}
      >
        <KPI label="Bestillinger i dag" value="84" hint="Registrert og verifisert" />
        <KPI label="Avbestilt før 08:00" value="11" hint="Matsvinn redusert" />
        <KPI label="Aktive lokasjoner" value="3" hint="Innenfor avtale" />
        <KPI label="Driftsstatus" value="OK" hint="Ingen avvik" />
      </section>

      {/* Operativ modul + sekundært */}
      <section
        style={{
          display: "grid",
          gridTemplateColumns: "2fr 1fr",
          gap: 12,
        }}
      >
        <Panel
          title="Dagens leveringer"
          right={<GhostCTA href="/kitchen" label="Åpne kjøkkenvisning" />}
        >
          <div style={{ color: "var(--muted)", fontSize: 13, lineHeight: 1.6 }}>
            Her legger vi den operative listen: leveringsvindu → firma → lokasjon → ansatte.
            <br />
            Fokus: utskrift/eksport, status (QUEUED/PACKED/DELIVERED), og avvik.
          </div>
        </Panel>

        <div style={{ display: "grid", gap: 12 }}>
          <Panel title="Avtale">
            <div style={{ color: "var(--muted)", fontSize: 13, lineHeight: 1.7 }}>
              Plan: <span style={{ color: "var(--text)", fontWeight: 650 }}>Luxus</span>
              <br />
              Levering: Man–Fre
              <br />
              Binding: 12 mnd
            </div>
            <div style={{ marginTop: 14, display: "flex", gap: 10 }}>
              <GhostCTA href="/admin/agreement" label="Vis avtale" />
            </div>
          </Panel>

          <Panel title="Faktura & historikk">
            <div style={{ color: "var(--muted)", fontSize: 13, lineHeight: 1.7 }}>
              Neste faktura: 01.03
              <br />
              Status: <span style={{ color: "var(--text)", fontWeight: 650 }}>OK</span>
            </div>
            <div style={{ marginTop: 14, display: "flex", gap: 10 }}>
              <GhostCTA href="/admin/billing" label="Åpne" />
            </div>
          </Panel>
        </div>
      </section>
      {helpSlot ? <div style={{ marginTop: 24 }}>{helpSlot}</div> : null}
      {footerCtaSlot ? <div style={{ marginTop: 24 }}>{footerCtaSlot}</div> : null}
    </main>
  );
}
