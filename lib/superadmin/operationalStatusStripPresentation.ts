/**
 * UI-tekst for operativ statuslinje — speiler nivåer fra loadProductionReadiness (ingen egen logikk).
 * Ved endring i ProductionReadinessLevel: oppdater denne filen.
 */
export type OperationalStripLevel =
  | "NOT_DELIVERY_DAY"
  | "ERROR"
  | "BLOCKED_GLOBAL_CLOSED"
  | "READY"
  | "READY_WITH_WARNINGS";

export type OperationalStripVariant = "ok" | "warn" | "blocked" | "neutral" | "error";

export function operationalStatusStripPresentation(level: OperationalStripLevel): {
  label: string;
  variant: OperationalStripVariant;
} {
  switch (level) {
    case "READY":
      return { label: "Produksjon i dag: klar", variant: "ok" };
    case "READY_WITH_WARNINGS":
      return { label: "Produksjon i dag: klar med avvik", variant: "warn" };
    case "BLOCKED_GLOBAL_CLOSED":
      return { label: "Produksjon i dag: blokkert", variant: "blocked" };
    case "NOT_DELIVERY_DAY":
      return { label: "Operativt: ikke leveringsdag (helg)", variant: "neutral" };
    case "ERROR":
    default:
      return { label: "Produksjon i dag: status utilgjengelig", variant: "error" };
  }
}
