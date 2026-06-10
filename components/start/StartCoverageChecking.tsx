type Props = {
  /** Calm, locale-ready loading line (e.g. "Sjekker dekning …"). */
  label: string;
};

export default function StartCoverageChecking({ label }: Props) {
  return (
    <div className="lp-start-step lp-start-step--checking" role="status" aria-live="polite" aria-busy="true">
      <p className="lp-start-checking__text">{label}</p>
      <div className="lp-start-checking__loader" aria-hidden="true">
        <span className="lp-start-checking__dot" />
        <span className="lp-start-checking__dot" />
        <span className="lp-start-checking__dot" />
      </div>
    </div>
  );
}
