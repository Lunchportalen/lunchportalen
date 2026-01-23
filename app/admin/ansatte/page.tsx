// app/admin/ansatte/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";

/* =========================================================
   Typer
========================================================= */
type Employee = {
  user_id: string;
  name: string | null;
  email: string | null;
  created_at: string;
  disabled_at: string | null;
  disabled_reason: string | null;
};

type ListRes =
  | { ok: true; employees: Employee[] }
  | { ok: false; error: string; message?: string };

type InviteRes =
  | { ok: true; invite: { url: string; code: string } }
  | { ok: false; error: string; message?: string };

type ToggleRes =
  | { ok: true; user_id: string; disabled: boolean }
  | { ok: false; error: string; message?: string };

/* =========================================================
   Helpers
========================================================= */
function fmtDate(s: string) {
  try {
    return new Date(s).toLocaleString("nb-NO", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return s;
  }
}

/* =========================================================
   Page
========================================================= */
export default function AdminAnsattePage() {
  const [loading, setLoading] = useState(true);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [err, setErr] = useState<string | null>(null);

  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);

  const activeCount = useMemo(
    () => employees.filter((e) => !e.disabled_at).length,
    [employees]
  );

  /* ---------------------------
     Load employees
  --------------------------- */
  async function loadEmployees() {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch("/api/admin/employees/list", {
        cache: "no-store",
      });
      const json = (await res.json().catch(() => null)) as ListRes | null;

      if (!res.ok || !json || (json as any).ok === false) {
        throw new Error((json as any)?.message || "Kunne ikke hente ansatte.");
      }

      setEmployees((json as any).employees ?? []);
    } catch (e: any) {
      setErr(String(e?.message ?? "Uventet feil ved lasting."));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadEmployees();
  }, []);

  /* ---------------------------
     Invite
  --------------------------- */
  async function createInvite() {
    setInviteLoading(true);
    setInviteUrl(null);
    setErr(null);
    try {
      const res = await fetch("/api/admin/invites/create", {
        method: "POST",
        cache: "no-store",
      });
      const json = (await res.json().catch(() => null)) as InviteRes | null;

      if (!res.ok || !json || (json as any).ok === false) {
        throw new Error((json as any)?.message || "Kunne ikke opprette lenke.");
      }

      setInviteUrl((json as any).invite.url);
    } catch (e: any) {
      setErr(String(e?.message ?? "Uventet feil ved opprettelse av lenke."));
    } finally {
      setInviteLoading(false);
    }
  }

  async function copyInvite() {
    if (!inviteUrl) return;
    await navigator.clipboard.writeText(inviteUrl);
    alert("Invitasjonslenke kopiert.");
  }

  /* ---------------------------
     Toggle disabled
  --------------------------- */
  async function toggleDisabled(user_id: string, nextDisabled: boolean) {
    const reason = nextDisabled
      ? prompt("Valgfritt: begrunnelse (kun for admin).", "Deaktivert")
      : null;

    try {
      const res = await fetch("/api/admin/employees/set-disabled", {
        method: "POST",
        headers: { "content-type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({
          user_id,
          disabled: nextDisabled,
          reason,
        }),
      });

      const json = (await res.json().catch(() => null)) as ToggleRes | null;

      if (!res.ok || !json || (json as any).ok === false) {
        throw new Error((json as any)?.message || "Kunne ikke oppdatere ansatt.");
      }

      await loadEmployees();
    } catch (e: any) {
      setErr(String(e?.message ?? "Uventet feil ved oppdatering."));
    }
  }

  /* =========================================================
     Render
  ========================================================= */
  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <div className="rounded-3xl bg-white/70 p-8 ring-1 ring-[rgb(var(--lp-border))]">
        {/* Header */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Ansatte</h1>
            <p className="mt-1 text-sm text-[rgb(var(--lp-muted))]">
              Inviter ansatte med én felles lenke. Deaktiver ved behov – uten
              unntak og uten manuell håndtering.
            </p>
          </div>

          <div className="flex gap-2">
            <button
              onClick={createInvite}
              disabled={inviteLoading}
              className="rounded-2xl bg-black px-4 py-3 text-sm font-medium text-white ring-1 ring-black hover:bg-black/90 disabled:opacity-60"
            >
              {inviteLoading ? "Oppretter…" : "Opprett invitasjonslenke"}
            </button>

            <button
              onClick={loadEmployees}
              disabled={loading}
              className="rounded-2xl bg-white px-4 py-3 text-sm font-medium ring-1 ring-[rgb(var(--lp-border))] hover:bg-white/80 disabled:opacity-60"
            >
              {loading ? "Laster…" : "Oppdater"}
            </button>
          </div>
        </div>

        {/* Invite link */}
        {inviteUrl && (
          <div className="mt-5 rounded-2xl bg-white p-4 ring-1 ring-[rgb(var(--lp-border))]">
            <div className="text-sm font-semibold">Invitasjonslenke</div>
            <div className="mt-1 break-all text-sm">{inviteUrl}</div>
            <div className="mt-3 flex gap-2">
              <button
                onClick={copyInvite}
                className="rounded-2xl bg-white px-3 py-2 text-sm ring-1 ring-[rgb(var(--lp-border))] hover:bg-white/80"
              >
                Kopier
              </button>
              <a
                href={inviteUrl}
                target="_blank"
                rel="noreferrer"
                className="rounded-2xl bg-white px-3 py-2 text-sm ring-1 ring-[rgb(var(--lp-border))] hover:bg-white/80"
              >
                Åpne
              </a>
            </div>
          </div>
        )}

        {/* Error */}
        {err && (
          <div className="mt-5 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-900 ring-1 ring-red-200">
            {err}
          </div>
        )}

        {/* Table */}
        <div className="mt-6 rounded-2xl bg-white p-4 ring-1 ring-[rgb(var(--lp-border))]">
          <div className="text-sm font-semibold">
            Oversikt{" "}
            <span className="text-[rgb(var(--lp-muted))]">
              ({activeCount} aktive)
            </span>
          </div>

          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-[rgb(var(--lp-muted))]">
                <tr>
                  <th className="py-2 pr-3">Navn</th>
                  <th className="py-2 pr-3">E-post</th>
                  <th className="py-2 pr-3">Opprettet</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2 pr-3 text-right"></th>
                </tr>
              </thead>
              <tbody>
                {employees.map((e) => {
                  const disabled = !!e.disabled_at;
                  return (
                    <tr
                      key={e.user_id}
                      className="border-t border-[rgb(var(--lp-border))]"
                    >
                      <td className="py-3 pr-3">{e.name || "—"}</td>
                      <td className="py-3 pr-3">{e.email || "—"}</td>
                      <td className="py-3 pr-3">
                        {fmtDate(e.created_at)}
                      </td>
                      <td className="py-3 pr-3">
                        {disabled ? (
                          <span className="rounded-full bg-neutral-100 px-2 py-1 text-xs">
                            Deaktivert
                          </span>
                        ) : (
                          <span className="rounded-full bg-emerald-50 px-2 py-1 text-xs text-emerald-900">
                            Aktiv
                          </span>
                        )}
                      </td>
                      <td className="py-3 pr-3 text-right">
                        {disabled ? (
                          <button
                            onClick={() =>
                              toggleDisabled(e.user_id, false)
                            }
                            className="rounded-2xl bg-white px-3 py-2 text-xs ring-1 ring-[rgb(var(--lp-border))] hover:bg-white/80"
                          >
                            Reaktiver
                          </button>
                        ) : (
                          <button
                            onClick={() =>
                              toggleDisabled(e.user_id, true)
                            }
                            className="rounded-2xl bg-white px-3 py-2 text-xs ring-1 ring-[rgb(var(--lp-border))] hover:bg-white/80"
                          >
                            Deaktiver
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}

                {!loading && employees.length === 0 && (
                  <tr>
                    <td
                      colSpan={5}
                      className="py-6 text-center text-sm text-[rgb(var(--lp-muted))]"
                    >
                      Ingen ansatte registrert ennå.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </main>
  );
}
