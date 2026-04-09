/**
 * Lokal videorendering: ffmpeg når tilgjengelig, ellers trygg fallback (ingen crash).
 * Ingen ekstern API-krav — alt fungerer uten nett etter at assets er hentet.
 */

import "server-only";

import { spawnSync } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { CaptionCue } from "@/lib/video/captions";
import type { VideoStructureBeat } from "@/lib/video/structure";
import type { VoiceGenerationResult } from "@/lib/video/voice";

export type RenderVideoInput = {
  structure: VideoStructureBeat[];
  media: { images: string[]; videos: string[] };
  captions: CaptionCue[];
  voice: VoiceGenerationResult;
};

export type RenderVideoResult =
  | {
      videoUrl: string;
      previewFrames: string[];
      renderMetadata: { engine: "ffmpeg"; durationSec: number; relativePath: string };
    }
  | {
      videoUrl?: undefined;
      previewFrames: string[];
      renderMetadata: { engine: "none"; reason: string };
    };

let ffmpegChecked: boolean | null = null;

function ffmpegAvailable(): boolean {
  if (ffmpegChecked !== null) return ffmpegChecked;
  const r = spawnSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-version"], {
    encoding: "utf8",
    windowsHide: true,
  });
  ffmpegChecked = r.status === 0;
  return ffmpegChecked;
}

function ffprobeDurationSec(filePath: string): number | null {
  const r = spawnSync(
    "ffprobe",
    [
      "-v",
      "error",
      "-show_entries",
      "format=duration",
      "-of",
      "default=noprint_wrappers=1:nokey=1",
      filePath,
    ],
    { encoding: "utf8", windowsHide: true },
  );
  if (r.status !== 0 || !r.stdout) return null;
  const n = Number(String(r.stdout).trim());
  return Number.isFinite(n) && n > 0 ? n : null;
}

function defaultFontfilePath(): string | null {
  if (process.platform === "win32") {
    const p = "C:/Windows/Fonts/segoeui.ttf";
    return existsSync(p) ? p : null;
  }
  const candidates = [
    "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
  ];
  for (const p of candidates) {
    if (existsSync(p)) return p;
  }
  return null;
}

/** FFmpeg drawtext `fontfile=...` fragment, eller tom når ingen font funnet (bruker standardfont hvis støttet). */
function fontfileArg(): string {
  const fromEnv = process.env.VIDEO_RENDER_FONT_FILE?.trim();
  const raw = fromEnv ?? defaultFontfilePath();
  if (!raw) return "";
  return raw.replace(/\\/g, "/").replace(":", "\\:");
}

async function fetchToFile(url: string, dest: string): Promise<boolean> {
  try {
    const res = await fetch(url, { redirect: "follow" });
    if (!res.ok) return false;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length === 0) return false;
    await writeFile(dest, buf);
    return true;
  } catch {
    return false;
  }
}

/** Støtter absolutt http(s) eller offentlig sti under `/` (leses fra `public/`). */
async function resolveAssetToFile(url: string, dest: string): Promise<boolean> {
  const trimmed = url.trim();
  if (trimmed.startsWith("/")) {
    try {
      const local = join(process.cwd(), "public", trimmed.replace(/^\//, ""));
      const buf = await readFile(local);
      if (buf.length === 0) return false;
      await writeFile(dest, buf);
      return true;
    } catch {
      return false;
    }
  }
  return fetchToFile(trimmed, dest);
}

function extFromUrl(url: string): string {
  try {
    const p = new URL(url).pathname;
    const dot = p.lastIndexOf(".");
    if (dot === -1) return "";
    const e = p.slice(dot + 1).toLowerCase();
    if (/^[a-z0-9]{2,5}$/.test(e)) return `.${e}`;
  } catch {
    /* ignore */
  }
  return "";
}

function buildSrt(captions: CaptionCue[]): string {
  const lines: string[] = [];
  let i = 1;
  for (const c of captions) {
    const start = formatSrtTime(c.start);
    const end = formatSrtTime(c.end);
    lines.push(String(i++), `${start} --> ${end}`, c.text.trim() || " ", "");
  }
  return lines.join("\n");
}

function formatSrtTime(sec: number): string {
  const s = Math.max(0, sec);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const rs = s % 60;
  const whole = Math.floor(rs);
  const ms = Math.round((rs - whole) * 1000);
  const pad = (n: number, w: number) => String(n).padStart(w, "0");
  return `${pad(h, 2)}:${pad(m, 2)}:${pad(whole, 2)},${pad(ms, 3)}`;
}

function runFfmpeg(args: string[]): { ok: boolean; stderr: string } {
  const r = spawnSync("ffmpeg", args, {
    encoding: "utf8",
    maxBuffer: 20 * 1024 * 1024,
    windowsHide: true,
  });
  return { ok: r.status === 0, stderr: `${r.stderr || ""}${r.error || ""}` };
}

async function writeTextFile(path: string, content: string): Promise<void> {
  await writeFile(path, content, "utf8");
}

/**
 * Lokal MP4 (ffmpeg) med tekst-overlay og undertekster; valgfri lyd fra `voice.audioUrl`.
 * Uten ffmpeg: `{ previewFrames: [] }` (ingen throw).
 */
export async function renderVideo(
  structure: VideoStructureBeat[],
  media: RenderVideoInput["media"],
  captions: CaptionCue[],
  voice: VoiceGenerationResult,
): Promise<RenderVideoResult> {
  if (!ffmpegAvailable()) {
    return {
      previewFrames: [],
      renderMetadata: { engine: "none", reason: "ffmpeg_not_available" },
    };
  }

  const totalDurationSec = structure.reduce((s, b) => s + b.duration, 0);
  if (totalDurationSec <= 0 || structure.length === 0) {
    return {
      previewFrames: [],
      renderMetadata: { engine: "none", reason: "empty_structure" },
    };
  }

  const workRoot = await mkdtemp(join(tmpdir(), "lp-vid-"));
  const segments: string[] = [];

  const filterEscapePath = (p: string) => p.replace(/\\/g, "/").replace(":", "\\:").replace("'", "\\'");

  try {
    const fontEsc = fontfileArg();
    const drawfont = fontEsc ? `:fontfile=${fontEsc}` : "";

    for (let i = 0; i < structure.length; i++) {
      const beat = structure[i]!;
      const segPath = join(workRoot, `seg_${i}.mp4`);
      const dur = Math.max(0.5, beat.duration);

      if (beat.type === "hook" || beat.type === "cta") {
        const textPath = join(workRoot, `txt_${i}.txt`);
        await writeTextFile(textPath, beat.text);

        const hookStyle =
          "drawtext=textfile='" +
          filterEscapePath(textPath) +
          "'" +
          drawfont +
          ":fontcolor=black:fontsize=56:box=1:boxcolor=white@0.72:boxborderw=20" +
          ":borderw=3:bordercolor=white:x=(w-text_w)/2:y=h*0.40:shadowx=4:shadowy=4:shadowcolor=black@0.45";
        const ctaStyle =
          "drawtext=textfile='" +
          filterEscapePath(textPath) +
          "'" +
          drawfont +
          ":fontcolor=white:fontsize=52:box=1:boxcolor=black@0.78:boxborderw=14" +
          ":borderw=4:bordercolor=white:x=(w-text_w)/2:y=h*0.44";

        const vf = [
          `scale=720:1280:force_original_aspect_ratio=decrease`,
          `pad=720:1280:(ow-iw)/2:(oh-ih)/2`,
          beat.type === "hook" ? hookStyle : ctaStyle,
        ].join(",");

        const { ok, stderr } = runFfmpeg([
          "-y",
          "-f",
          "lavfi",
          "-i",
          `color=c=0xfdf8f3:s=720x1280:r=30`,
          "-vf",
          vf,
          "-t",
          String(dur),
          "-c:v",
          "libx264",
          "-pix_fmt",
          "yuv420p",
          "-an",
          segPath,
        ]);
        if (!ok) {
          return {
            previewFrames: [],
            renderMetadata: { engine: "none", reason: `hook_cta_segment_failed:${stderr.slice(0, 200)}` },
          };
        }
      } else {
        const url = beat.media;
        const isVideo =
          url &&
          (url.includes(".mp4") ||
            url.includes(".webm") ||
            url.includes(".mov") ||
            /video\//i.test(url));

        if (url && isVideo) {
          const ext = extFromUrl(url) || ".mp4";
          const rawPath = join(workRoot, `raw_v_${i}${ext}`);
          const okDl = await resolveAssetToFile(url, rawPath);
          if (!okDl) {
            const { ok, stderr } = runFfmpeg([
              "-y",
              "-f",
              "lavfi",
              "-i",
              `color=c=0xe8e4dc:s=720x1280:r=30`,
              "-vf",
              `drawtext=text='Kunne ikke laste CMS-video'${drawfont}:fontcolor=black:fontsize=36:x=(w-text_w)/2:y=h*0.45`,
              "-t",
              String(dur),
              "-c:v",
              "libx264",
              "-pix_fmt",
              "yuv420p",
              "-an",
              segPath,
            ]);
            if (!ok) {
              return {
                previewFrames: [],
                renderMetadata: { engine: "none", reason: `product_fallback_failed:${stderr.slice(0, 200)}` },
              };
            }
          } else {
            const { ok, stderr } = runFfmpeg([
              "-y",
              "-i",
              rawPath,
              "-t",
              String(dur),
              "-vf",
              "scale=720:1280:force_original_aspect_ratio=decrease,pad=720:1280:(ow-iw)/2:(oh-ih)/2,fps=30",
              "-c:v",
              "libx264",
              "-pix_fmt",
              "yuv420p",
              "-an",
              segPath,
            ]);
            if (!ok) {
              return {
                previewFrames: [],
                renderMetadata: { engine: "none", reason: `product_video_failed:${stderr.slice(0, 200)}` },
              };
            }
          }
        } else if (url) {
          const ext = extFromUrl(url) || ".img";
          const rawPath = join(workRoot, `raw_i_${i}${ext}`);
          const okDl = await resolveAssetToFile(url, rawPath);
          if (!okDl) {
            const { ok, stderr } = runFfmpeg([
              "-y",
              "-f",
              "lavfi",
              "-i",
              `color=c=0xe8e4dc:s=720x1280:r=30`,
              "-vf",
              `drawtext=text='Kunne ikke laste CMS-bilde'${drawfont}:fontcolor=black:fontsize=36:x=(w-text_w)/2:y=h*0.45`,
              "-t",
              String(dur),
              "-c:v",
              "libx264",
              "-pix_fmt",
              "yuv420p",
              "-an",
              segPath,
            ]);
            if (!ok) {
              return {
                previewFrames: [],
                renderMetadata: { engine: "none", reason: `product_image_fallback_failed:${stderr.slice(0, 200)}` },
              };
            }
          } else {
            const { ok, stderr } = runFfmpeg([
              "-y",
              "-loop",
              "1",
              "-i",
              rawPath,
              "-vf",
              "scale=720:1280:force_original_aspect_ratio=decrease,pad=720:1280:(ow-iw)/2:(oh-ih)/2,fps=30",
              "-t",
              String(dur),
              "-c:v",
              "libx264",
              "-pix_fmt",
              "yuv420p",
              "-an",
              segPath,
            ]);
            if (!ok) {
              return {
                previewFrames: [],
                renderMetadata: { engine: "none", reason: `product_image_failed:${stderr.slice(0, 200)}` },
              };
            }
          }
        } else {
          const labelPath = join(workRoot, `lbl_${i}.txt`);
          await writeTextFile(labelPath, `${beat.label}\n(${media.images.length ? "Legg til CMS-bilder" : "Ingen CMS-media"})`);
          const { ok, stderr } = runFfmpeg([
            "-y",
            "-f",
            "lavfi",
            "-i",
            `color=c=0xe8e4dc:s=720x1280:r=30`,
            "-vf",
            `drawtext=textfile='${filterEscapePath(labelPath)}'${drawfont}:fontcolor=black:fontsize=36:box=1:boxcolor=white@0.55:boxborderw=12:x=(w-text_w)/2:y=h*0.42`,
            "-t",
            String(dur),
            "-c:v",
            "libx264",
            "-pix_fmt",
            "yuv420p",
            "-an",
            segPath,
          ]);
          if (!ok) {
            return {
              previewFrames: [],
              renderMetadata: { engine: "none", reason: `product_placeholder_failed:${stderr.slice(0, 200)}` },
            };
          }
        }
      }

      segments.push(segPath);
    }

    const listPath = join(workRoot, "concat.txt");
    await writeTextFile(
      listPath,
      segments.map((p) => `file '${p.replace(/'/g, "'\\''")}'`).join("\n"),
    );

    const concatOut = join(workRoot, "concat_nosub.mp4");
    {
      const { ok, stderr } = runFfmpeg([
        "-y",
        "-f",
        "concat",
        "-safe",
        "0",
        "-i",
        listPath,
        "-c",
        "copy",
        concatOut,
      ]);
      if (!ok) {
        return {
          previewFrames: [],
          renderMetadata: { engine: "none", reason: `concat_failed:${stderr.slice(0, 200)}` },
        };
      }
    }

    const srtPath = join(workRoot, "captions.srt");
    await writeTextFile(srtPath, buildSrt(captions));

    const subOut = join(workRoot, "with_subs.mp4");
    const srtForFilter = filterEscapePath(srtPath);
    {
      const { ok, stderr } = runFfmpeg([
        "-y",
        "-i",
        concatOut,
        "-vf",
        `subtitles='${srtForFilter}':force_style='FontSize=20,PrimaryColour=&H00202020,OutlineColour=&H00FFFFFF,BorderStyle=1'`,
        "-c:v",
        "libx264",
        "-pix_fmt",
        "yuv420p",
        "-an",
        subOut,
      ]);
      if (!ok) {
        const { ok: okCopy, stderr: errCopy } = runFfmpeg([
          "-y",
          "-i",
          concatOut,
          "-c",
          "copy",
          subOut,
        ]);
        if (!okCopy) {
          return {
            previewFrames: [],
            renderMetadata: { engine: "none", reason: `subtitles_failed:${stderr.slice(0, 120)}|${errCopy.slice(0, 120)}` },
          };
        }
      }
    }

    let finalVideoPath = subOut;
    if (voice.audioUrl && (voice.audioUrl.startsWith("/") || /^https?:\/\//i.test(voice.audioUrl))) {
      const audioExt = voice.audioUrl.includes(".mp3") ? ".mp3" : extFromUrl(voice.audioUrl) || ".audio";
      const audioPath = join(workRoot, `voice${audioExt}`);
      const okAudio = await resolveAssetToFile(voice.audioUrl, audioPath);
      if (okAudio) {
        const muxOut = join(workRoot, "final_mux.mp4");
        const audioDur = ffprobeDurationSec(audioPath);
        const padSec =
          audioDur != null && audioDur < totalDurationSec ? Math.max(0.1, totalDurationSec - audioDur + 0.25) : 0;
        const filter =
          padSec > 0
            ? `[1:a]apad=pad_dur=${padSec.toFixed(3)},atrim=0:${totalDurationSec.toFixed(3)},asetpts=PTS-STARTPTS[aout]`
            : `[1:a]atrim=0:${totalDurationSec.toFixed(3)},asetpts=PTS-STARTPTS[aout]`;
        const { ok, stderr } = runFfmpeg([
          "-y",
          "-i",
          subOut,
          "-i",
          audioPath,
          "-filter_complex",
          filter,
          "-map",
          "0:v:0",
          "-map",
          "[aout]",
          "-c:v",
          "copy",
          "-c:a",
          "aac",
          "-t",
          String(totalDurationSec),
          muxOut,
        ]);
        if (ok) {
          finalVideoPath = muxOut;
        } else {
          finalVideoPath = subOut;
          void stderr;
        }
      }
    }

    const outDir = join(process.cwd(), "public", "generated", "video-studio");
    await mkdir(outDir, { recursive: true });
    const hash = createHash("sha256")
      .update(JSON.stringify(structure.map((b) => ({ ...b }))))
      .update(voice.audioUrl ?? "")
      .digest("hex")
      .slice(0, 16);
    const fileName = `${Date.now()}-${hash}-${randomBytes(4).toString("hex")}.mp4`;
    const publicPath = join(outDir, fileName);
    const videoBytes = await readFile(finalVideoPath);
    await writeFile(publicPath, videoBytes);

    const relativePath = `/generated/video-studio/${fileName}`;
    return {
      videoUrl: relativePath,
      previewFrames: [],
      renderMetadata: {
        engine: "ffmpeg",
        durationSec: totalDurationSec,
        relativePath,
      },
    };
  } catch {
    return {
      previewFrames: [],
      renderMetadata: { engine: "none", reason: "render_threw" },
    };
  } finally {
    await rm(workRoot, { recursive: true, force: true }).catch(() => undefined);
  }
}
