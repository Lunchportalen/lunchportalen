/**
 * Creative-pool for video/hook-rotasjon.
 */

export type Creative = {
  id: string;
  videoUrl: string;
  hook: string;
  disabled?: boolean;
  performance?: {
    roas: number;
    conversions: number;
  };
};

export function getActiveCreatives(creatives: Creative[]): Creative[] {
  return creatives.filter((c) => !c.disabled);
}
