/* scripts/codex-design-system.mjs
------------------------------------------------------------
Design-system Codex runner (NO CLI):
- Reads design/DESIGN_BRIEF.md + selected repo context
- Calls OpenAI Responses API via fetch (Node 20)
- Expects unified git diff ONLY (git apply compatible)
- Writes codex.design.patch and applies it (git apply)
- NO-OP (clean exit) when no diff is returned
- Refuses any output that contains CLI artifacts (codex/--system/--prompt)
------------------------------------------------------------ */

import fs from "node:fs";
import { execSync } from "node:child_process";

/* =========================================================
   Helpers
========================================================= */

function requireEnv(name) {
  const v = process.env[name];
  if (!v || !String(v).trim()) throw new Error(`Missing env: ${name}`);
  return String(v).trim();
}

function readFileSafe(p) {
  try {
    return fs.readFileSync(p, "utf8");
  } catch {
    return "";
  }
}

function writeFile(p, content) {
  fs.writeFileSync(p, content ?? "", "utf8");
}

function run(cmd) {
  return execSync(cmd, { stdio: "pipe", encoding: "utf8" });
}

function runQuiet(cmd) {
  execSync(cmd, { stdio: "ignore" });
}

function normalizeNewlines(s) {
  return String(s ?? "").replace(/\r\n/g, "\n");
}

function stripCodeFences(s) {
  let out = String(s ?? "");
  out = out.replace(/^```(?:diff)?\s*\n/i, "");
  out = out.replace(/\n```$/i, "");
  return out;
}

function isUnifiedDiff(text) {
  const t = String(text || "").trimStart();
  return (
    t.startsWith("diff --git ") ||
    (t.startsWith("--- ") && t.includes("\n+++ "))
  );
}

function extractFirstUnifiedDiffBlock(text) {
  const s = normalizeNewlines(String(text ?? ""));
  const idx = s.indexOf("diff --git ");
  if (idx >= 0) return s.slice(idx);

  const idx2 = s.indexOf("\n--- ");
  if (idx2 >= 0) return s.slice(idx2 + 1);

  if (s.startsWith("--- ")) return s;
  return s;
}

function guardNoCliArtifacts(rawText) {
  const t = String(rawText ?? "");
  if (/\bcodex\b/i.test(t) || /--system\b/i.test(t) || /--prompt\b/i.test(t)) {
    throw new Error(
      "Model output contained CLI artifacts (codex/--system/--prompt). Refusing to apply."
    );
  }
}

/* =========================================================
   OpenAI: Responses API → unified diff
========================================================= */

async function openaiUnifiedDiff({ apiKey, model, brief, context }) {
  const url = "https://api.openai.com/v1/responses";

  const body = {
    model,
    input: [
      {
        role: "system",
        content: [
          {
            type: "input_text",
            text: [
              "You are the Lunchportalen design-system engineer.",
              "Goal: create a cohesive premium dark design system with a strong 'red thread' across the app.",
              "",
              "Hard rules:",
              "- Do NOT change business logic, auth, guards, audit, cron, or API shapes.",
              "- Do NOT add dependencies. Do NOT modify package-lock.json.",
              "- Focus only on: tokens, CSS variables, UI components, layout shells, and page styling.",
              "- Use design/DESIGN_BRIEF.md as source of truth.",
              "- Output ONLY a unified git diff (git apply compatible). No explanation.",
              "- If you cannot produce a safe patch, output nothing.",
            ].join("\n"),
          },
        ],
      },
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: [
              "DESIGN BRIEF:",
              "----------------",
              brief,
              "",
              "REPO CONTEXT (selected excerpts):",
              "----------------",
              context,
              "",
              "Task:",
              "- Implement/extend design tokens (CSS variables + lib/design/tokens.ts).",
              "- Ensure a coherent dark premium theme with crimson primary and warm accent.",
              "- Add/standardize basic UI primitives (Button, Card, Badge) if missing.",
              "- Improve layout shells and spacing where safe, without changing logic.",
              "",
              "Constraints:",
              "- No logic/auth changes.",
              "- No API shape changes.",
              "- No new deps / no package-lock changes.",
              "",
              "Output only unified diff.",
            ].join("\n"),
          },
        ],
      },
    ],
  };

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`OpenAI API error ${res.status}: ${txt}`);
  }

  const data = await res.json();

  // Robust parsing:
  let text = typeof data.output_text === "string" ? data.output_text : "";
  if (!text) {
    const out = Array.isArray(data.output) ? data.output : [];
    const chunks = [];
    for (const item of out) {
      const content = Array.isArray(item?.content) ? item.content : [];
      for (const c of content) {
        if (typeof c?.text === "string" && c.text.trim()) chunks.push(c.text);
      }
    }
    text = chunks.join("\n");
  }

  return String(text || "");
}

/* =========================================================
   Main
========================================================= */

async function main() {
  const apiKey = requireEnv("OPENAI_API_KEY");
  const model = (process.env.OPENAI_MODEL || "gpt-5").trim();

  const brief = readFileSafe("design/DESIGN_BRIEF.md");
  if (!brief.trim()) {
    throw new Error("Missing design/DESIGN_BRIEF.md");
  }

  // Keep context small & safe (no secrets). This is just to help the model.
  const globals = readFileSafe("app/globals.css");
  const layout = readFileSafe("app/layout.tsx");
  const tailwind = readFileSafe("tailwind.config.js");
  const uiIndex = readFileSafe("components/ui/index.ts");
  const tokens = readFileSafe("lib/design/tokens.ts");

  const context = [
    "app/globals.css (excerpt):",
    globals.slice(0, 8000),
    "",
    "app/layout.tsx (excerpt):",
    layout.slice(0, 8000),
    "",
    "tailwind.config.js (excerpt):",
    tailwind.slice(0, 4000),
    "",
    "components/ui/index.ts (excerpt):",
    uiIndex.slice(0, 2000),
    "",
    "lib/design/tokens.ts (excerpt):",
    tokens.slice(0, 3000),
  ].join("\n");

  // Clean working tree (the workflow creates a branch before this step)
  try {
    runQuiet("git reset --hard");
  } catch {}

  const raw = await openaiUnifiedDiff({
    apiKey,
    model,
    brief: brief.slice(0, 120_000),
    context: context.slice(0, 120_000),
  });

  const rawNorm = normalizeNewlines(raw);

  // Always save raw output for audit/debug
  writeFile("codex.design.raw.txt", rawNorm);

  // Guard against any CLI artifacts
  guardNoCliArtifacts(rawNorm);

  // Clean output into a diff
  let cleaned = stripCodeFences(rawNorm);
  cleaned = extractFirstUnifiedDiffBlock(cleaned).trimEnd() + "\n";

  // NO-OP is OK
  if (!isUnifiedDiff(cleaned) || !cleaned.trim()) {
    process.stdout.write("ℹ️ No unified diff returned. Exiting without changes.\n");
    return;
  }

  writeFile("codex.design.patch", cleaned);

  // Validate + apply
  run("git apply --check codex.design.patch");
  runQuiet("git apply codex.design.patch");

  process.stdout.write("✅ Design patch applied (codex.design.patch)\n");
}

main().catch((err) => {
  process.stderr.write(`❌ Design autofix failed: ${err?.message || err}\n`);
  process.exit(1);
});
