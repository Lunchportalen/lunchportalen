/**
 * Enkel statisk mal — bruker ikke {@link lib/social/generator} (kalender/AI-motor) for å unngå duplikat.
 */
export function generateSocialPost(product: unknown): {
  text: string;
  hashtags: string[];
} {
  void product;
  return {
    text: `Lei av kantinekaos?

Få lunsj levert – enkelt og forutsigbart.

Book demo i dag.`,
    hashtags: ["#lunsj", "#kontor", "#bedrift", "#catering"],
  };
}
