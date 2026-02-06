"use client";

import { useRouter } from "next/navigation";
import AuthShell from "@/components/auth/AuthShell";
import { Button } from "@/components/ui/button";

export default function RegisterGatePage() {
  const router = useRouter();

  function onContinue(e: React.FormEvent) {
    e.preventDefault();
    router.push("/onboarding");
  }

  return (
    <AuthShell
      title="Enklere firmalunsj starter her"
      subtitle="Registrer bedriften og få full kontroll på lunsjlevering, bestillinger og rammer — uten manuelle unntak."
    >
      <form onSubmit={onContinue} className="space-y-4">
        <Button type="submit" className="w-full">
          Registrer bedrift
        </Button>

        <div className="text-center text-sm text-[rgb(var(--lp-muted))]">
          <a className="underline" href="/login">
            Har du allerede konto? Logg inn
          </a>
        </div>
      </form>
    </AuthShell>
  );
}
