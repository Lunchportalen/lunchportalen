type EmployeeWarningBannerProps = {
  className?: string;
};

export default function EmployeeWarningBanner({ className }: EmployeeWarningBannerProps) {
  const cls = className ? ` ${className}` : "";
  return (
    <section
      className={`rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900${cls}`}
      role="note"
      aria-label="Viktig informasjon for ansatte"
    >
      Ansatt? Du skal ikke registrere firma. Gå til innlogging på <span className="font-semibold">/login</span>.
    </section>
  );
}
