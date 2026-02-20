import type { AuthReason } from "@/lib/auth/getAuthContext";

type BlockedAccessProps = {
  reason: AuthReason;
};

export default function BlockedAccess({ reason }: BlockedAccessProps) {
  const message =
    reason === "NO_PROFILE"
      ? "Konto ikke aktivert. Kontakt administrator."
      : reason === "BLOCKED"
        ? "Konto ikke aktiv. Kontakt administrator."
        : reason === "ERROR"
          ? "Kunne ikke verifisere tilgang. Prøv igjen."
          : "Konto ikke aktivert. Kontakt administrator.";

  return (
    <main className="mx-auto w-full max-w-[760px] px-4 py-10">
      <h1 className="text-2xl font-semibold">Ingen tilgang</h1>
      <p className="mt-3 text-sm">{message}</p>
    </main>
  );
}
