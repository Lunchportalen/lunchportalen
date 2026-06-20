export function buildPasswordResetEmail(link: string): { subject: string; text: string } {
  const subject = "Tilbakestill passordet ditt i Lunchportalen";
  const text =
    "Hei,\n" +
    "Du ba om å tilbakestille passordet ditt i Lunchportalen.\n\n" +
    "Bruk lenken under for å velge nytt passord:\n" +
    `${link}\n\n` +
    "Lenken er gyldig i 30 minutter. Hvis du ikke ba om dette, kan du se bort fra e-posten.\n\n" +
    "Vennlig hilsen\n" +
    "Lunchportalen";

  return { subject, text };
}
