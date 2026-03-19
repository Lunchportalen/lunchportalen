import type { AuthReason } from "@/lib/auth/getAuthContext";
import { Container } from "@/components/ui/container";

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
    <main>
      <Container className="max-w-3xl py-10">
        <h1 className="font-heading text-2xl font-semibold">Ingen tilgang</h1>
        <p className="font-body mt-3 text-sm">{message}</p>
      </Container>
    </main>
  );
}
