"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import AuthShell from "@/components/auth/AuthShell";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";

type Choice = "admin" | "employee";

export default function RegisterGatePage() {
  const router = useRouter();
  const [choice, setChoice] = useState<Choice>("admin");
  const [confirmed, setConfirmed] = useState(false);

  const canContinue = choice === "employee" || confirmed;

  function onContinue(e: React.FormEvent) {
    e.preventDefault();
    if (!canContinue) return;
    if (choice === "employee") {
      router.push("/login");
      return;
    }
    router.push("/onboarding");
  }

  return (
    <AuthShell title="Registrering" subtitle="Velg riktig spor før du går videre.">
      <form onSubmit={onContinue} className="space-y-4">
        <div className="space-y-2">
          <Label>Jeg er…</Label>
          <div className="grid gap-2">
            <button
              type="button"
              onClick={() => setChoice("admin")}
              className={[
                "rounded-2xl border px-4 py-3 text-left text-sm",
                choice === "admin"
                  ? "border-[rgb(var(--lp-text))] bg-white text-[rgb(var(--lp-text))]"
                  : "border-[rgb(var(--lp-border))] bg-white/60 text-[rgb(var(--lp-muted))]",
              ].join(" ")}
            >
              <div className="font-semibold">Jeg er firmaadmin</div>
              <div className="mt-1 text-xs text-[rgb(var(--lp-muted))]">Opprett firmakonto og administrator.</div>
            </button>

            <button
              type="button"
              onClick={() => setChoice("employee")}
              className={[
                "rounded-2xl border px-4 py-3 text-left text-sm",
                choice === "employee"
                  ? "border-[rgb(var(--lp-text))] bg-white text-[rgb(var(--lp-text))]"
                  : "border-[rgb(var(--lp-border))] bg-white/60 text-[rgb(var(--lp-muted))]",
              ].join(" ")}
            >
              <div className="font-semibold">Jeg er ansatt</div>
              <div className="mt-1 text-xs text-[rgb(var(--lp-muted))]">Gå til innlogging.</div>
            </button>
          </div>
        </div>

        <div className="rounded-2xl border border-[rgb(var(--lp-border))] bg-white/70 px-4 py-3 text-sm">
          <Checkbox
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
            label="Jeg bekrefter at jeg registrerer firma, ikke ansatt."
          />
        </div>

        <Button type="submit" disabled={!canContinue} className="w-full lp-btn--stable lp-neon-focus lp-neon-glow-hover">
          Fortsett
        </Button>
      </form>
    </AuthShell>
  );
}
