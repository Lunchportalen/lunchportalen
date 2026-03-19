type SystemState = "NORMAL" | "DEGRADED";

function tone(state: SystemState) {
  if (state === "DEGRADED") return "bg-amber-100/70 text-amber-900 ring-amber-200";
  return "bg-emerald-100/70 text-emerald-900 ring-emerald-200";
}

export default function StatusPill({ state }: { state: SystemState }) {
  return (
    <span
      className={[
        "inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] ring-1 shadow-[var(--lp-shadow-soft)]",
        tone(state),
      ].join(" ")}
    >
      SYSTEM: {state}
    </span>
  );
}
