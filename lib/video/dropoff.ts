/**
 * Enkel drop-off-diagnose fra målte nøkkeltall (0–100-skala).
 */

export type VideoDropOffInput = {
  hookRetention: number;
  completionRate: number;
};

export type VideoDropOffDiagnosis = "weak_hook" | "weak_story";

/**
 * @returns diagnose eller null når signalene er innenfor «OK».
 */
export function detectDropOff(data: VideoDropOffInput): VideoDropOffDiagnosis | null {
  if (data.hookRetention < 40) {
    return "weak_hook";
  }
  if (data.completionRate < 20) {
    return "weak_story";
  }
  return null;
}
