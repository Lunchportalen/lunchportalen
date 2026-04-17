"use client";

import { useState, useTransition } from "react";

import { createEmployeeInvite } from "@/app/admin/invite/actions";

export default function SimpleEmployeeInvite() {
  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [link, setLink] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setLink(null);
    startTransition(async () => {
      const r = await createEmployeeInvite(email);
      if (r.ok === false) {
        setMsg(r.message);
        return;
      }
      setLink(r.inviteUrl);
      setMsg(
        r.emailSent
          ? "Invitasjon sendt på e-post."
          : "Invitasjon opprettet. SMTP er ikke konfigurert — kopier lenken under og send den manuelt."
      );
      if (r.emailError) {
        setMsg((prev) => `${prev ?? ""} (${r.emailError})`.trim());
      }
      setEmail("");
    });
  }

  return (
    <section className="mb-10 rounded-3xl border border-black/10 bg-white/80 p-6 shadow-sm backdrop-blur">
      <h2 className="text-lg font-semibold text-neutral-900">Inviter én ansatt</h2>
      <p className="mt-1 text-sm text-neutral-600">Lenken er gyldig i 48 timer og kan bare brukes én gang.</p>

      <form onSubmit={onSubmit} className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
        <label className="flex-1 text-sm">
          <span className="font-medium text-neutral-800">E-post</span>
          <input
            type="email"
            name="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={pending}
            className="mt-1 h-11 w-full rounded-2xl border border-black/10 bg-white px-3 text-sm outline-none ring-0 focus:border-neutral-400"
            placeholder="navn@firma.no"
          />
        </label>
        <button
          type="submit"
          disabled={pending}
          className="h-11 shrink-0 rounded-full bg-neutral-900 px-6 text-sm font-semibold text-white disabled:opacity-50"
        >
          {pending ? "Sender…" : "Send invitasjon"}
        </button>
      </form>

      {msg ? <p className="mt-3 text-sm text-neutral-700">{msg}</p> : null}
      {link ? (
        <div className="mt-3 rounded-2xl bg-neutral-50 p-3 text-xs break-all text-neutral-800 ring-1 ring-black/5">{link}</div>
      ) : null}
    </section>
  );
}
