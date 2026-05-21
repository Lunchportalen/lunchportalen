import { badgeSemanticClasses, badgeVariantClasses } from "@/lib/ui/chipBadgeVariants";

type Semantic = keyof typeof badgeSemanticClasses;

function semanticForStatus(status: string): Semantic {
  const s = String(status ?? "").toUpperCase();
  if (s === "PAID" || s === "PROCESSED" || s === "SENT") return "success";
  if (s === "FAILED" || s === "FAILED_PERMANENT" || s === "VOID") return "error";
  if (s === "PENDING" || s === "PROCESSING" || s === "DRAFT" || s === "OVERDUE") return "warning";
  if (s === "IGNORED") return "neutral";
  return "info";
}

export default function TripletexStatusBadge({ status }: { status: string }) {
  const semantic = semanticForStatus(status);
  return (
    <span
      className={[
        "lp-badge",
        badgeVariantClasses.soft,
        badgeSemanticClasses[semantic],
        "inline-flex min-h-[28px] items-center rounded-full px-2.5 py-0.5 text-xs font-semibold",
      ].join(" ")}
    >
      {status || "—"}
    </span>
  );
}
