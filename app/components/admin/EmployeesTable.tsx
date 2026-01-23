"use client";

import { useEffect, useMemo, useState, useTransition } from "react";

type Employee = {
  user_id: string;
  email: string | null;
  full_name: string | null;
  department: string | null;
  location_id: string | null;
  role: "employee";
  created_at: string | null;
  updated_at: string | null;
  disabled_at?: string | null;
};

type ApiList = {
  ok: boolean;
  employees: Employee[];
  count: number;
  page: number;
  page_size: number;
  message?: string;
  error?: string;
  detail?: any;
};

type ActivityRow = {
  user_id: string;
  invited_at: string | null;
  last_sign_in_at: string | null;
};

type LocationRow = {
  id: string;
  company_id?: string;
  name?: string | null;
  label?: string | null;
  address?: string | null;
  address_line1?: string | null;
  postal_code?: string | null;
  city?: string | null;
};

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function isEmail(v: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

async function fetchEmployees(q: string, page: number, pageSize: number) {
  const u = new URL("/api/admin/employees", window.location.origin);
  if (q) u.searchParams.set("q", q);
  u.searchParams.set("page", String(page));
  u.searchParams.set("page_size", String(pageSize));
  const r = await fetch(u.pathname + u.search, { cache: "no-store" });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j?.ok) throw new Error(j?.message || j?.error || "Kunne ikke hente ansatte");
  return j as ApiList;
}

async function setEmployeeDisabled(userId: string, disabled: boolean) {
  const r = await fetch(`/api/admin/employees/${userId}/disable`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ disabled }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j?.ok) throw new Error(j?.message || j?.error || "Kunne ikke oppdatere ansatt");
  return j.employee as Employee;
}

async function inviteEmployee(payload: {
  email: string;
  full_name?: string | null;
  department?: string | null;
  location_id?: string | null;
}) {
  const r = await fetch("/api/admin/employees/invite", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j?.ok) throw new Error(j?.message || j?.error || "Kunne ikke invitere ansatt");
  return j;
}

async function resendInvite(userId: string) {
  const r = await fetch("/api/admin/employees/resend-invite", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ user_id: userId }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j?.ok) throw new Error(j?.message || j?.error || "Kunne ikke sende invitasjon på nytt");
  return j;
}

function downloadEmployeesCsv(q: string) {
  const u = new URL("/api/admin/employees/export", window.location.origin);
  if (q) u.searchParams.set("q", q);
  window.location.href = u.pathname + u.search;
}

async function fetchActivity(userIds: string[]): Promise<ActivityRow[]> {
  const r = await fetch("/api/admin/employees/activity", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ user_ids: userIds }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j?.ok) throw new Error(j?.message || j?.error || "Kunne ikke hente invitasjonsstatus");
  return (j.activity ?? []) as ActivityRow[];
}

async function fetchLocations(): Promise<LocationRow[]> {
  const r = await fetch("/api/admin/locations", { cache: "no-store" });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j?.ok) throw new Error(j?.detail || j?.message || j?.error || "Kunne ikke hente lokasjoner");
  return (j.locations ?? []) as LocationRow[];
}

function niceLocLabel(l: LocationRow) {
  const label = (l.label || l.name || "Lokasjon").trim();
  const city = (l.city || "").trim();
  return city ? `${label} · ${city}` : label;
}

export default function EmployeesTable() {
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 25;

  const [data, setData] = useState<ApiList | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // modal state
  const [inviteOpen, setInviteOpen] = useState(false);
  const [invEmail, setInvEmail] = useState("");
  const [invName, setInvName] = useState("");
  const [invDept, setInvDept] = useState("");
  const [invLocId, setInvLocId] = useState<string>(""); // "" = ingen lokasjon
  const [inviteErr, setInviteErr] = useState<string | null>(null);

  // auth activity map (invited/last_sign_in)
  const [activityMap, setActivityMap] = useState<Record<string, ActivityRow>>({});

  // locations for dropdown + label map
  const [locations, setLocations] = useState<LocationRow[]>([]);
  const [locMap, setLocMap] = useState<Record<string, string>>({});
  const [locsLoading, setLocsLoading] = useState(false);

  const totalPages = useMemo(
    () => (data ? Math.max(1, Math.ceil(data.count / data.page_size)) : 1),
    [data]
  );

  const stats = useMemo(() => {
    const list = data?.employees ?? [];
    const active = list.filter((e) => !e.disabled_at).length;
    const disabled = list.filter((e) => !!e.disabled_at).length;
    return { shown: list.length, active, disabled, total: data?.count ?? 0 };
  }, [data]);

  function statusLabel(emp: Employee): { label: string; cls: string } {
    if (emp.disabled_at) return { label: "Deaktivert", cls: "bg-gray-200" };
    const act = activityMap[emp.user_id];
    if (act?.last_sign_in_at) return { label: "Aktiv", cls: "bg-green-100 text-green-800" };
    return { label: "Invitert", cls: "bg-blue-100 text-blue-800" };
  }

  function isInvitedOnly(emp: Employee) {
    if (emp.disabled_at) return false;
    const act = activityMap[emp.user_id];
    return !act?.last_sign_in_at;
  }

  async function ensureLocationsLoaded() {
    if (locations.length > 0) return;
    setLocsLoading(true);
    try {
      const locs = await fetchLocations();
      setLocations(locs);

      const map: Record<string, string> = {};
      for (const l of locs) map[String(l.id)] = niceLocLabel(l);
      setLocMap(map);
    } catch {
      // silent fail: modal works with "Ingen lokasjon"
      setLocations([]);
      setLocMap({});
    } finally {
      setLocsLoading(false);
    }
  }

  function load() {
    startTransition(async () => {
      try {
        setErr(null);

        const res = await fetchEmployees(q, page, pageSize);
        setData(res);

        // activity for shown users
        const ids = (res.employees ?? []).map((e) => e.user_id).filter(Boolean);
        if (ids.length) {
          const act = await fetchActivity(ids);
          const map: Record<string, ActivityRow> = {};
          for (const a of act) map[a.user_id] = a;
          setActivityMap(map);
        } else {
          setActivityMap({});
        }

        // keep location label map warm (best-effort)
        if (Object.keys(locMap).length === 0) {
          // do not block render; fetch in background
          ensureLocationsLoaded();
        }
      } catch (e: any) {
        setErr(e?.message || "Feil ved henting");
        setData(null);
        setActivityMap({});
      }
    });
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, page]);

  async function toggle(emp: Employee) {
    startTransition(async () => {
      try {
        setErr(null);
        await setEmployeeDisabled(emp.user_id, !emp.disabled_at);
        await load();
      } catch (e: any) {
        setErr(e?.message || "Kunne ikke oppdatere");
      }
    });
  }

  async function openInvite() {
    setInviteErr(null);
    setInviteOpen(true);
    await ensureLocationsLoaded();
  }

  async function doInvite() {
    startTransition(async () => {
      try {
        setInviteErr(null);

        const email = invEmail.trim().toLowerCase();
        if (!email || !isEmail(email)) {
          setInviteErr("Skriv inn en gyldig e-postadresse.");
          return;
        }

        await inviteEmployee({
          email,
          full_name: invName.trim() || null,
          department: invDept.trim() || null,
          location_id: invLocId ? invLocId : null,
        });

        // reset
        setInvEmail("");
        setInvName("");
        setInvDept("");
        setInvLocId("");
        setInviteOpen(false);

        setPage(1);
        await load();
      } catch (e: any) {
        setInviteErr(e?.message || "Kunne ikke invitere");
      }
    });
  }

  const employees = data?.employees ?? [];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-lg font-semibold">Ansatte</h2>
          <p className="text-sm text-muted-foreground">
            Administrer ansatte i bedriften. Deaktivering sletter ikke historikk.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <input
            value={q}
            onChange={(e) => {
              setPage(1);
              setQ(e.target.value);
            }}
            placeholder="Søk navn, e-post, avdeling"
            className="h-9 w-64 rounded-md border px-3 text-sm"
          />

          <button
            onClick={openInvite}
            disabled={isPending}
            className="h-9 rounded-md border px-3 text-sm hover:bg-muted disabled:opacity-50"
          >
            Inviter ansatt
          </button>

          <button
            onClick={() => downloadEmployeesCsv(q)}
            disabled={isPending}
            className="h-9 rounded-md border px-3 text-sm hover:bg-muted disabled:opacity-50"
            title="Last ned CSV (filtrert på søk)"
          >
            Last ned CSV
          </button>
        </div>
      </div>

      {/* Mini stats */}
      <div className="grid gap-3 md:grid-cols-4">
        <div className="rounded-2xl border bg-white p-4">
          <div className="text-xs text-muted-foreground">Viser</div>
          <div className="mt-1 text-2xl font-semibold">{stats.shown}</div>
        </div>
        <div className="rounded-2xl border bg-white p-4">
          <div className="text-xs text-muted-foreground">Aktive (i listen)</div>
          <div className="mt-1 text-2xl font-semibold">{stats.active}</div>
        </div>
        <div className="rounded-2xl border bg-white p-4">
          <div className="text-xs text-muted-foreground">Deaktivert (i listen)</div>
          <div className="mt-1 text-2xl font-semibold">{stats.disabled}</div>
        </div>
        <div className="rounded-2xl border bg-white p-4">
          <div className="text-xs text-muted-foreground">Totalt (alle)</div>
          <div className="mt-1 text-2xl font-semibold">{stats.total}</div>
        </div>
      </div>

      {err && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{err}</div>
      )}

      {/* Table */}
      <div className="overflow-x-auto rounded-md border">
        <table className="min-w-full text-sm">
          <thead className="bg-muted">
            <tr className="text-left">
              <th className="px-3 py-2">Navn</th>
              <th className="px-3 py-2">E-post</th>
              <th className="px-3 py-2">Avdeling</th>
              <th className="px-3 py-2">Lokasjon</th>
              <th className="px-3 py-2">Invitasjon</th>
              <th className="px-3 py-2 text-right">Handling</th>
            </tr>
          </thead>
          <tbody>
            {!data && !err && (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">
                  Laster …
                </td>
              </tr>
            )}

            {employees.map((e) => {
              const st = statusLabel(e);
              const invitedOnly = isInvitedOnly(e);
              const locLabel = e.location_id ? locMap[e.location_id] || "—" : "—";

              return (
                <tr key={e.user_id} className="border-t">
                  <td className="px-3 py-2 font-medium">{e.full_name || "—"}</td>
                  <td className="px-3 py-2">{e.email || "—"}</td>
                  <td className="px-3 py-2">{e.department || "—"}</td>
                  <td className="px-3 py-2">{locLabel}</td>
                  <td className="px-3 py-2">
                    <span className={`rounded px-2 py-0.5 text-xs ${st.cls}`}>{st.label}</span>
                  </td>

                  <td className="px-3 py-2 text-right">
                    <div className="flex justify-end gap-2">
                      {invitedOnly && (
                        <button
                          disabled={isPending}
                          onClick={() =>
                            startTransition(async () => {
                              try {
                                setErr(null);
                                await resendInvite(e.user_id);
                                await load();
                              } catch (err: any) {
                                setErr(err?.message || "Kunne ikke sende på nytt");
                              }
                            })
                          }
                          className="rounded-md border px-3 py-1 text-xs hover:bg-muted disabled:opacity-50"
                          title="Send invitasjon på nytt"
                        >
                          Send på nytt
                        </button>
                      )}

                      <button
                        disabled={isPending}
                        onClick={() => toggle(e)}
                        className="rounded-md border px-3 py-1 text-xs hover:bg-muted disabled:opacity-50"
                      >
                        {e.disabled_at ? "Aktiver" : "Deaktiver"}
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}

            {data && employees.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">
                  Ingen ansatte funnet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <div className="text-xs text-muted-foreground">
          Side {page} av {totalPages} · {data?.count ?? 0} totalt
        </div>
        <div className="flex gap-2">
          <button
            className="rounded-md border px-3 py-1 text-xs disabled:opacity-50"
            disabled={page <= 1 || isPending}
            onClick={() => setPage((p) => clamp(p - 1, 1, totalPages))}
          >
            Forrige
          </button>
          <button
            className="rounded-md border px-3 py-1 text-xs disabled:opacity-50"
            disabled={page >= totalPages || isPending}
            onClick={() => setPage((p) => clamp(p + 1, 1, totalPages))}
          >
            Neste
          </button>
        </div>
      </div>

      {/* Invite Modal */}
      {inviteOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => {
              if (!isPending) setInviteOpen(false);
            }}
          />

          <div className="relative z-10 w-full max-w-lg rounded-2xl border bg-white p-5 shadow-xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-base font-semibold">Inviter ansatt</div>
                <div className="mt-1 text-sm text-muted-foreground">
                  Alle invitasjoner blir registrert som <span className="font-medium">employee</span>.
                </div>
              </div>
              <button
                className="rounded-md border px-2 py-1 text-xs hover:bg-muted disabled:opacity-50"
                disabled={isPending}
                onClick={() => setInviteOpen(false)}
              >
                Lukk
              </button>
            </div>

            {inviteErr && (
              <div className="mt-3 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {inviteErr}
              </div>
            )}

            <div className="mt-4 grid gap-3">
              <div className="grid gap-1">
                <label className="text-xs text-muted-foreground">E-post *</label>
                <input
                  value={invEmail}
                  onChange={(e) => setInvEmail(e.target.value)}
                  className="h-9 rounded-md border px-3 text-sm"
                  placeholder="navn@firma.no"
                />
              </div>

              <div className="grid gap-1">
                <label className="text-xs text-muted-foreground">Navn</label>
                <input
                  value={invName}
                  onChange={(e) => setInvName(e.target.value)}
                  className="h-9 rounded-md border px-3 text-sm"
                  placeholder="Fornavn Etternavn"
                />
              </div>

              <div className="grid gap-1">
                <label className="text-xs text-muted-foreground">Avdeling</label>
                <input
                  value={invDept}
                  onChange={(e) => setInvDept(e.target.value)}
                  className="h-9 rounded-md border px-3 text-sm"
                  placeholder="Salg / Drift / IT …"
                />
              </div>

              <div className="grid gap-1">
                <label className="text-xs text-muted-foreground">Lokasjon</label>
                <select
                  value={invLocId}
                  onChange={(e) => setInvLocId(e.target.value)}
                  className="h-9 rounded-md border px-3 text-sm"
                  disabled={locsLoading}
                >
                  <option value="">{locsLoading ? "Laster lokasjoner…" : "Ingen lokasjon"}</option>
                  {locations.map((l) => (
                    <option key={String(l.id)} value={String(l.id)}>
                      {niceLocLabel(l)}
                    </option>
                  ))}
                </select>
                <div className="text-[11px] text-muted-foreground">
                  Lokasjon er valgfritt. Velg “Ingen lokasjon” hvis dere ikke bruker det.
                </div>
              </div>
            </div>

            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                className="h-9 rounded-md border px-3 text-sm hover:bg-muted disabled:opacity-50"
                disabled={isPending}
                onClick={() => setInviteOpen(false)}
              >
                Avbryt
              </button>
              <button
                className="h-9 rounded-md border px-3 text-sm hover:bg-muted disabled:opacity-50"
                disabled={isPending}
                onClick={doInvite}
              >
                Send invitasjon
              </button>
            </div>

            <div className="mt-3 text-xs text-muted-foreground">
              Merk: Systemkontoer kan ikke inviteres (superadmin/kjøkken/driver).
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
