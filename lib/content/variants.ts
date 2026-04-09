import type { ImprovableContent } from "@/lib/content/improve";

/**
 * Deterministiske varianter for A/B og gjenbruk (samme kjerne, kontrollert variasjon).
 */
export function generateVariants(content: ImprovableContent): ImprovableContent[] {
  const t = String(content.text ?? "");
  return [
    { ...content },
    {
      ...content,
      text: t.replace(/perfekt/gi, "helt unikt"),
    },
    {
      ...content,
      text: `${t}\n\nBegrenset kapasitet.`,
    },
  ];
}
