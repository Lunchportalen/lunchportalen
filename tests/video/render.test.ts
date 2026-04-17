import { describe, expect, test } from "vitest";

import { renderVideo } from "@/lib/video/render";
import type { VideoStructureBeat } from "@/lib/video/structure";

describe("renderVideo", () => {
  test("never throws; always returns previewFrames array", async () => {
    const structure: VideoStructureBeat[] = [
      { type: "hook", duration: 2, text: "Test hook" },
      { type: "product", duration: 3, media: null, label: "Produkt" },
      { type: "cta", duration: 2, text: "Bestill nå" },
    ];
    const r = await renderVideo(structure, { images: [], videos: [] }, [], {
      audioUrl: null,
      voice: "test-voice",
      toneProfile: "warm_trondelag_friendly",
      directionNotes: "",
    });
    expect(Array.isArray(r.previewFrames)).toBe(true);
    expect(r.renderMetadata.engine === "ffmpeg" || r.renderMetadata.engine === "none").toBe(true);
  });
});
