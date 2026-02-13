// app/admin/employees/employees-client.tsx
"use client";

import { useEffect, useMemo, useState } from "react";

type Employee = {
  id: string | null;
  email: string | null;
  name?: string | null;
  role: string | null;
  department?: string | null;
  phone?: string | null;
  disabled_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type ApiData = {
  companyId: string;
  count?: number;
  items: Employee[];
};

type ApiOk = {
  ok: true;
  rid: string;
  data: ApiData | null;
};

type ApiErr = {
  ok: false;
  rid: string;
  message: string;
  status: number;
  error: string;
  detail?: any;
};

type State =
  | { type: "loading" }
  | { type: "ready"; items: Employee[]; companyId: string; count: number; rid: string }
  | { type: "error"; message: string; rid?: string };

function safeStr(v: unknown) {
  return String(v ?? "").trim();
}

function formatDate(v?: string | null) {
  if (!v) return "—";
  const s = String(v);
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return s;
  return `${m[3]}-${m[2]}-${m[1]}`;
}

function parseJsonSafe(text: string) {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export default function EmployeesClient() {
  const [state, setState] = useState<State>({ type: "loading" });
  const [search, setSearch] = useState("");

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        const res = await fetch("/api/admin/employees", { cache: "no-store" });
        const text = await res.text();
        const json: any =
          parseJsonSafe(text) ?? { ok: false, message: "Ugyldig JSON fra server." };

        if (json?.ok === true) {
          const ok = json as ApiOk;
          const data = ok.data ?? null;

          const companyId = safeStr(data?.companyId) || "—";
          const items = Array.isArray(data?.items) ? (data!.items as Employee[]) : [];
          const count = typeof data?.count === "number" ? (data!.count as number) : items.length;

          if (!alive) return;
          setState({
            type: "ready",
            items,
            companyId,
            count,
            rid: safeStr(ok.rid) || "—",
          });
          return;
        }

        const err = json as Partial<ApiErr>;
        const msg =
          safeStr(err?.message) ||
          (!res.ok ? `Kunne ikke hente ansatte (HTTP ${res.status}).` : "Kunne ikke hente ansatte.");

        if (!alive) return;
        setState({ type: "error", message: msg, rid: safeStr(err?.rid) || undefined });
      } catch (e: any) {
        if (!alive) return;
        setState({
          type: "error",
          message: safeStr(e?.message) || "Uventet feil ved henting av ansatte.",
        });
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  // ✅ ESLint clean: stable dependency for useMemo
  const items = useMemo(() => {
    return state.type === "ready" ? state.items : [];
  }, [state]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;

    return items.filter((e) => {
      const hay = [e.email, e.name, e.department, e.phone, e.role]
        .map((v) => String(v ?? "").toLowerCase())
        .join(" ");
      return hay.includes(q);
    });
  }, [items, search]);

  return (
    <div style={{ padding: 24 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          gap: 16,
          flexWrap: "wrap",
        }}
      >
        <div>
          <h1 style={{ margin: 0, fontSize: 28 }}>Ansatte</h1>

          {state.type === "ready" && (
            <div style={{ opacity: 0.7, marginTop: 4 }}>
              Firma: <strong>{state.companyId}</strong> · Antall:{" "}
              <strong>{state.count}</strong> · Viser: <strong>{filtered.length}</strong>
            </div>
          )}
        </div>

        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Søk (navn, e-post, avdeling...)"
          style={{
            width: 320,
            maxWidth: "60vw",
            padding: "10px 12px",
            borderRadius: 10,
            border: "1px solid rgba(0,0,0,0.15)",
          }}
        />
      </div>

      <div style={{ height: 16 }} />

      {state.type === "loading" && <div>Laster ansatte...</div>}

      {state.type === "error" && (
        <div
          style={{
            padding: 12,
            borderRadius: 10,
            border: "1px solid rgba(255,0,0,0.3)",
            background: "rgba(255,0,0,0.05)",
          }}
        >
          <strong>Kunne ikke laste ansatte</strong>
          <div style={{ marginTop: 6 }}>{state.message}</div>
          {state.rid && (
            <div style={{ marginTop: 6, fontSize: 12, opacity: 0.6 }}>
              RID: {state.rid}
            </div>
          )}
        </div>
      )}

      {state.type === "ready" && (
        <div
          style={{
            border: "1px solid rgba(0,0,0,0.1)",
            borderRadius: 12,
            overflow: "hidden",
            marginTop: 8,
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "2fr 1.2fr 1fr 1fr 1fr",
              padding: "12px 14px",
              fontWeight: 600,
              background: "rgba(0,0,0,0.03)",
            }}
          >
            <div>Navn / e-post</div>
            <div>Avdeling</div>
            <div>Rolle</div>
            <div>Status</div>
            <div>Opprettet</div>
          </div>

          {filtered.length === 0 ? (
            <div style={{ padding: 14, opacity: 0.7 }}>Ingen ansatte registrert.</div>
          ) : (
            filtered.map((e, i) => {
              const isActive = !e.disabled_at;
              return (
                <div
                  key={`${e.id ?? "null"}-${i}`}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "2fr 1.2fr 1fr 1fr 1fr",
                    padding: "12px 14px",
                    borderTop: i === 0 ? "none" : "1px solid rgba(0,0,0,0.08)",
                    background: isActive ? "transparent" : "rgba(255,0,0,0.04)",
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600 }}>{e.name ?? "—"}</div>
                    <div style={{ opacity: 0.8 }}>{e.email ?? "—"}</div>
                  </div>
                  <div style={{ opacity: 0.9 }}>{e.department ?? "—"}</div>
                  <div style={{ opacity: 0.9 }}>{e.role ?? "—"}</div>
                  <div style={{ opacity: 0.9 }}>{isActive ? "Aktiv" : "Deaktivert"}</div>
                  <div style={{ opacity: 0.9 }}>{formatDate(e.created_at)}</div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
