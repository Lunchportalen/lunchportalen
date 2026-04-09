/**
 * Session pattern detector capability: detectSessionPatterns.
 * Detects session-level patterns from session data: entry/exit pages, length distribution,
 * navigation style (linear vs multi-step), and dominant paths. Deterministic; no LLM.
 * Import this module to register the capability.
 */

import type { Capability } from "../../capabilityRegistry";
import { registerCapability } from "../../capabilityRegistry";

const CAPABILITY_NAME = "detectSessionPatterns";

const detectSessionPatternsCapability: Capability = {
  name: CAPABILITY_NAME,
  description:
    "Detects session-level patterns from session data: entry/exit pages, session length distribution, navigation style (linear, multi-step, single-page), and dominant path hints. Returns patterns, top entry/exit pages, and summary. Deterministic; no LLM.",
  requiredContext: [],
  inputSchema: {
    type: "object",
    description: "Session pattern detection input",
    properties: {
      sessions: {
        type: "array",
        description: "List of sessions to analyze",
        items: {
          type: "object",
          properties: {
            sessionId: { type: "string" },
            startTime: { type: "string", description: "ISO or Unix ms" },
            endTime: { type: "string" },
            durationSeconds: { type: "number" },
            entryPage: { type: "string" },
            exitPage: { type: "string" },
            pages: { type: "array", items: { type: "string" }, description: "Ordered page sequence" },
            pageViewCount: { type: "number" },
          },
        },
      },
      locale: { type: "string", enum: ["nb", "en"] },
    },
    required: ["sessions"],
  },
  outputSchema: {
    type: "object",
    description: "Session pattern detection result",
    required: ["patterns", "topEntryPages", "topExitPages", "sessionLengthDistribution", "summary", "generatedAt"],
    properties: {
      patterns: {
        type: "array",
        items: { type: "object", required: ["id", "label", "description", "prevalence"], properties: { id: { type: "string" }, label: { type: "string" }, description: { type: "string" }, prevalence: { type: "string", enum: ["low", "medium", "high"] } } },
      },
      topEntryPages: { type: "array", items: { type: "object", properties: { page: { type: "string" }, count: { type: "number" }, share: { type: "number" } } } },
      topExitPages: { type: "array", items: { type: "object", properties: { page: { type: "string" }, count: { type: "number" }, share: { type: "number" } } } },
      sessionLengthDistribution: {
        type: "object",
        properties: {
          short: { type: "number", description: "Sessions under shortThresholdSeconds" },
          medium: { type: "number" },
          long: { type: "number", description: "Sessions over longThresholdSeconds" },
          shortThresholdSeconds: { type: "number" },
          longThresholdSeconds: { type: "number" },
        },
      },
      pathHints: { type: "array", items: { type: "string" } },
      summary: { type: "string" },
      generatedAt: { type: "string", description: "ISO timestamp" },
    },
  },
  safetyConstraints: [
    { code: "read_only", description: "Output is detection only; no session or user data mutation.", enforce: "hard" },
  ],
  targetSurfaces: ["backoffice", "api"],
};

registerCapability(detectSessionPatternsCapability);

const SHORT_SESSION_SEC = 30;
const LONG_SESSION_SEC = 300;
const TOP_N = 5;
const DOMINANT_SHARE = 0.4;

function safeStr(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function countBy<T>(arr: T[], keyFn: (x: T) => string): Map<string, number> {
  const m = new Map<string, number>();
  for (const x of arr) {
    const k = keyFn(x);
    const v = m.get(k) ?? 0;
    m.set(k, v + 1);
  }
  return m;
}

function topFromMap(m: Map<string, number>, n: number): { page: string; count: number; share: number }[] {
  const total = [...m.values()].reduce((a, b) => a + b, 0);
  const entries = [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, n);
  return entries.map(([page, count]) => ({ page, count, share: total > 0 ? count / total : 0 }));
}

export type SessionInput = {
  sessionId?: string | null;
  startTime?: string | null;
  endTime?: string | null;
  durationSeconds?: number | null;
  entryPage?: string | null;
  exitPage?: string | null;
  pages?: string[] | null;
  pageViewCount?: number | null;
};

export type DetectSessionPatternsInput = {
  sessions: SessionInput[];
  locale?: "nb" | "en" | null;
};

export type SessionPattern = {
  id: string;
  label: string;
  description: string;
  prevalence: "low" | "medium" | "high";
};

export type PageCount = { page: string; count: number; share: number };

export type SessionLengthDistribution = {
  short: number;
  medium: number;
  long: number;
  shortThresholdSeconds: number;
  longThresholdSeconds: number;
};

export type DetectSessionPatternsOutput = {
  patterns: SessionPattern[];
  topEntryPages: PageCount[];
  topExitPages: PageCount[];
  sessionLengthDistribution: SessionLengthDistribution;
  pathHints: string[];
  summary: string;
  generatedAt: string;
};

/**
 * Detects session patterns from session list. Deterministic; no external calls.
 */
export function detectSessionPatterns(input: DetectSessionPatternsInput): DetectSessionPatternsOutput {
  const isEn = input.locale === "en";
  const sessions = Array.isArray(input.sessions) ? input.sessions.filter((s) => s && typeof s === "object") : [];
  const n = sessions.length;

  const entryCount = countBy(sessions, (s) => safeStr(s.entryPage) || "(unknown)");
  const exitCount = countBy(sessions, (s) => safeStr(s.exitPage) || "(unknown)");

  const topEntryPages = topFromMap(entryCount, TOP_N);
  const topExitPages = topFromMap(exitCount, TOP_N);

  let short = 0;
  let medium = 0;
  let long = 0;
  let singlePage = 0;
  let linearPath = 0;
  const entryPageValues = [...entryCount.keys()];

  for (const s of sessions) {
    const dur = typeof s.durationSeconds === "number" && s.durationSeconds >= 0
      ? s.durationSeconds
      : (s.pages?.length ?? s.pageViewCount ?? 1) * 20;
    if (dur < SHORT_SESSION_SEC) short++;
    else if (dur > LONG_SESSION_SEC) long++;
    else medium++;

    const pageCount = Array.isArray(s.pages) ? s.pages.length : (typeof s.pageViewCount === "number" ? s.pageViewCount : 1);
    if (pageCount <= 1) singlePage++;

    const pages = Array.isArray(s.pages) ? s.pages.map(safeStr).filter(Boolean) : [];
    if (pages.length >= 2 && s.entryPage && pages[0] === safeStr(s.entryPage) && s.exitPage && pages[pages.length - 1] === safeStr(s.exitPage)) linearPath++;
  }

  const patterns: SessionPattern[] = [];
  const pathHints: string[] = [];

  if (n > 0) {
    const singleShare = singlePage / n;
    if (singleShare >= 0.5) {
      patterns.push({
        id: "single_page_dominant",
        label: isEn ? "Single-page dominant" : "Enside dominerende",
        description: isEn ? "Most sessions have one page view." : "De fleste økter har én sidevisning.",
        prevalence: singleShare >= 0.7 ? "high" : "medium",
      });
      pathHints.push(isEn ? "Consider entry page engagement and internal links." : "Vurder engasjement på landingsside og interne lenker.");
    }

    const linearShare = n >= 2 ? linearPath / n : 0;
    if (linearShare >= 0.4) {
      patterns.push({
        id: "linear_navigation",
        label: isEn ? "Linear navigation" : "Lineær navigasjon",
        description: isEn ? "Sessions often follow entry → … → exit in order." : "Økter følger ofte entry → … → exit i rekkefølge.",
        prevalence: linearShare >= 0.6 ? "high" : "medium",
      });
    }

    const shortShare = n > 0 ? short / n : 0;
    if (shortShare >= 0.5) {
      patterns.push({
        id: "short_sessions",
        label: isEn ? "Short sessions" : "Korte økter",
        description: isEn ? `Many sessions under ${SHORT_SESSION_SEC}s.` : `Mange økter under ${SHORT_SESSION_SEC}s.`,
        prevalence: shortShare >= 0.7 ? "high" : "medium",
      });
    }

    const topEntryShare = topEntryPages[0]?.share ?? 0;
    if (topEntryShare >= DOMINANT_SHARE && topEntryPages[0]?.page) {
      patterns.push({
        id: "entry_concentration",
        label: isEn ? "Entry page concentration" : "Konsentrasjon landingsside",
        description: isEn ? `Many sessions start at "${topEntryPages[0].page}".` : `Mange økter starter på "${topEntryPages[0].page}".`,
        prevalence: topEntryShare >= 0.6 ? "high" : "medium",
      });
    }

    const topExitShare = topExitPages[0]?.share ?? 0;
    if (topExitShare >= DOMINANT_SHARE && topExitPages[0]?.page) {
      patterns.push({
        id: "exit_concentration",
        label: isEn ? "Exit page concentration" : "Konsentrasjon avslutningsside",
        description: isEn ? `Many sessions end at "${topExitPages[0].page}".` : `Mange økter slutter på "${topExitPages[0].page}".`,
        prevalence: topExitShare >= 0.6 ? "high" : "medium",
      });
      pathHints.push(isEn ? "Review exit page for drop-off or completion intent." : "Vurder avslutningssiden for frafall eller fullføringsintensjon.");
    }
  }

  const sessionLengthDistribution: SessionLengthDistribution = {
    short,
    medium,
    long,
    shortThresholdSeconds: SHORT_SESSION_SEC,
    longThresholdSeconds: LONG_SESSION_SEC,
  };

  const summary = isEn
    ? `Session patterns: ${patterns.length} pattern(s) from ${n} session(s). Entry/exit and length distribution computed.`
    : `Øktmønstre: ${patterns.length} mønster(e) fra ${n} økt(er). Entry/exit og varfordeling beregnet.`;

  return {
    patterns,
    topEntryPages,
    topExitPages,
    sessionLengthDistribution,
    pathHints,
    summary,
    generatedAt: new Date().toISOString(),
  };
}

export { detectSessionPatternsCapability, CAPABILITY_NAME };
