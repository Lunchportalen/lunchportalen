type Props = {
  city: string;
};

export default function StartCoverageChecking({ city }: Props) {
  return (
    <div className="lp-start-step lp-start-step--checking" role="status" aria-live="polite" aria-busy="true">
      <p className="lp-start-checking__text">Finner caterere i {city}…</p>
      <div className="lp-start-checking__loader" aria-hidden="true">
        <span className="lp-start-checking__dot" />
        <span className="lp-start-checking__dot" />
        <span className="lp-start-checking__dot" />
      </div>
    </div>
  );
}
