/**
 * Undertekster synket til struktur-tidslinje (deterministisk, lesbar hook først).
 */

import type { VideoScript } from "@/lib/video/script";
import type { VideoStructureBeat } from "@/lib/video/structure";

export type CaptionEmphasis = "hook" | "body" | "cta";

export type CaptionCue = {
  text: string;
  start: number;
  end: number;
  emphasis: CaptionEmphasis;
};

/**
 * Bygger undertekst-spor fra beats — `start`/`end` i sekunder, matcher {@link buildVideoStructure}.
 */
export function generateCaptions(script: VideoScript, structure: VideoStructureBeat[]): CaptionCue[] {
  const out: CaptionCue[] = [];
  let t = 0;
  for (const beat of structure) {
    const start = t;
    const end = t + beat.duration;
    if (beat.type === "hook") {
      out.push({ text: beat.text, start, end, emphasis: "hook" });
    } else if (beat.type === "product") {
      out.push({
        text: script.middle,
        start,
        end,
        emphasis: "body",
      });
    } else {
      out.push({ text: beat.text, start, end, emphasis: "cta" });
    }
    t = end;
  }
  return out;
}
