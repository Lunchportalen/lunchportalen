/** Ren visningstekst for /week/min-dag — ingen ny ordresemantikk. */

export function minDagLockExplanationNb(
  lockReason: string | null | undefined,
  agreementMessage: string | null | undefined,
): string {
  const lr = String(lockReason ?? "").trim().toUpperCase();
  if (lr === "CUTOFF") {
    return "Cut-off for samme dag er passert (Oslo) — dagen kan ikke endres i bestillingsvinduet.";
  }
  if (lr === "CLOSED_DATE") {
    return "Datoen er stengt i operativ kalender (closed_dates).";
  }
  if (lr === "COMPANY") {
    const am = String(agreementMessage ?? "").trim();
    if (am) return `Bestilling er ikke tilgjengelig: ${am}`;
    return "Firma eller avtale tillater ikke bestilling for denne datoen.";
  }
  return "Dagen er ikke tilgjengelig for bestilling i operativ modell.";
}

export function minDagOwnLunchLabelNb(params: {
  wantsLunch: boolean;
  orderStatus: string | null | undefined;
  isLocked: boolean;
}): string {
  if (params.wantsLunch || String(params.orderStatus ?? "").toUpperCase() === "ACTIVE") {
    return "Lunsj er registrert for denne datoen.";
  }
  if (String(params.orderStatus ?? "").toUpperCase() === "CANCELLED" || String(params.orderStatus ?? "").toUpperCase() === "CANCELED") {
    return "Bestilling er kansellert for denne datoen.";
  }
  if (params.isLocked) {
    return "Ingen aktiv bestilling (dagen er låst eller ikke bestillbar).";
  }
  return "Ingen registrert bestilling for denne datoen.";
}

export function minDagDayBookableLabelNb(isEnabled: boolean, isLocked: boolean): string {
  if (isEnabled && !isLocked) return "Dagen er åpen for bestilling i vinduet.";
  if (isLocked) return "Dagen er blokkert eller låst for endring.";
  return "Dagen er ikke en operativ bestillingsdag i avtalen.";
}
