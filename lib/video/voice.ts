/**
 * Stemme-motor — norsk, varm og litt trøndersk i tone (tekstlig profil).
 * Valgfritt ElevenLabs (VOICE_PROVIDER=elevenlabs + nøkkel); ellers trygg fallback uten ekstern API.
 */

import "server-only";

import { randomBytes } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

export const DEFAULT_VIDEO_VOICE_ID = "no-NO-female-trondelag";

export type VoiceGenerationResult = {
  audioUrl: string | null;
  /** Stabil stemme-identifikator for provider/TTS. */
  voice: string;
  /** Beskrivende tone (ikke API-krav). */
  toneProfile: "warm_trondelag_friendly";
  /** Kort merknad til menneskelig QA / senere TTS-prompt. */
  directionNotes: string;
};

/**
 * Genererer stemme-metadata. `audioUrl` er null inntil ekstern TTS lykkes eller kobles.
 */
export async function generateVoice(text: string): Promise<VoiceGenerationResult> {
  const trimmed = text.trim();
  const directionNotes =
    trimmed.length > 0
      ? "Varm, vennlig, lett trøndersk nyanser — naturlig, ikke robot. Tempo rolig, tydelig artikulasjon."
      : "Ingen tekst — ingen TTS.";

  if (process.env.VOICE_PROVIDER === "elevenlabs") {
    const apiKey = process.env.ELEVENLABS_API_KEY?.trim();
    const voiceId = process.env.ELEVENLABS_VOICE_ID?.trim();
    if (apiKey && voiceId && trimmed.length > 0) {
      try {
        const modelId = process.env.ELEVENLABS_MODEL_ID?.trim() || "eleven_multilingual_v2";
        const res = await fetch(
          `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}`,
          {
            method: "POST",
            headers: {
              "xi-api-key": apiKey,
              "Content-Type": "application/json",
              Accept: "audio/mpeg",
            },
            body: JSON.stringify({
              text: trimmed.slice(0, 2500),
              model_id: modelId,
            }),
          },
        );
        if (res.ok) {
          const buf = Buffer.from(await res.arrayBuffer());
          if (buf.length > 0) {
            const dir = join(process.cwd(), "public", "generated", "voice-studio");
            await mkdir(dir, { recursive: true });
            const fn = `${Date.now()}-${randomBytes(4).toString("hex")}.mp3`;
            await writeFile(join(dir, fn), buf);
            return {
              audioUrl: `/generated/voice-studio/${fn}`,
              voice: voiceId,
              toneProfile: "warm_trondelag_friendly",
              directionNotes,
            };
          }
        }
      } catch {
        /* fail-closed: metadata-fallback under */
      }
    }
  }

  return {
    audioUrl: null,
    voice: DEFAULT_VIDEO_VOICE_ID,
    toneProfile: "warm_trondelag_friendly",
    directionNotes,
  };
}
