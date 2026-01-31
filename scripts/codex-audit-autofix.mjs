/* scripts/codex-audit-autofix.mjs
------------------------------------------------------------
Enterprise-safe autofix motor (NO CLI):
- Leser critical.log
- Kaller OpenAI Responses API via fetch (Node 20)
- Forventer unified diff (git apply kompatibelt)
- Skriver codex.patch og forsøker å apply patchen
- Hvis modellen ikke gir diff: NO-OP (grønn workflow), lagrer codex.raw.txt
------------------------------------------------------------ */

import fs from "node:fs";
import path from "node:path";
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

function safeWrite(p, content) {
  fs.writeFileSync(p, content ?? "", "utf8");
}

function normalizeNewlines(s) {
  return String(s ?? "").replace(/\r\n/g, "\n");
}

function stripCodeFences(s) {
  // Stripper ```diff ... ``` og ``` ... ```
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
  // Hvis modellen skriver noe før diffen, finn starten på diff-blokken.
  const s = normalizeNewlines(String(text ?? ""));
  const idx = s.indexOf("diff --git ");
  if (idx >= 0) return s.slice(idx);

  // fallback: ---/+++ style
  const idx2 = s.indexOf("\n--- ");
  if (idx2 >= 0) return s.slice(idx2 + 1);

  if (s.startsWith("--- ")) return s;
  return s;
}

function run(cmd) {
  return execSync(cmd, { stdio: "pipe", encoding: "utf8" });
}

function runQuiet(cmd) {
  execSync(cmd, { stdio: "ignore" });
}

/**
 * Hard guard: aldri tillat CLI-instruksjoner å snike seg inn i output.
 */
function guardNoCliArtifacts(rawText) {
  const t = String(rawText ?? "");
  if (/\bcodex\b/i.test(t) || /--system\b/i.test(t) || /--prompt\b/i.test(t)) {
    throw new Error(
      "Model output contained CLI artifacts (codex/--system/--prompt). Refusing to apply. Saved raw output to codex.raw.txt"
    );
  }
}

/* =========================================================
   OpenAI: Responses API → unified diff
========================================================= */

async function openaiUnifiedDiff({ apiKey, model, inputText }) {
  const url = "https://api.openai.com/v1/responses";

  const body = {
    model,
    input: [
      {
        role: "system",
        content: [
          {
            // ✅ Responses API krever "input_text"
            type: "input_text",
            text: [
              "Du er LUNCHPORTALEN AUTOFIX BOT.",
              "MÅL: Få `npm run ci:critical` grønn med minst mulig endring.",
              "",
              "REGLER:",
              "- Minimal patch. Ingen refactor, ingen ny funksjonalitet.",
              "- Ikke svekk auth/role-gates eller RLS/tenant isolation.",
              "- Cut-off 08:00 Europe/Oslo og no-exception rule skal aldri brytes.",
              "- Bevar API-shapes. Ikke endre response-formater.",
              "- Output KUN unified git diff (git apply kompatibel).",
              "- Hvis du ikke kan foreslå en trygg minimal patch, returner INGEN diff (tomt svar).",
              "- Ingen forklaringer. Kun diff.",
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
              "ci:critical feilet. Her er loggen:",
              "",
              "----- START LOG -----",
              inputText,
              "----- END LOG -----",
              "",
              "Lag minimal patch som fikser feilen(e). Output KUN unified diff.",
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
    const errTxt = await res.text().catch(() => "");
    throw new Error(`OpenAI API error ${res.status}: ${errTxt}`);
  }

  const data = await res.json();

  // Robust parsing:
  // 1) output_text hvis finnes
  let text = typeof data.output_text === "string" ? data.output_text : "";

  // 2) ellers samle tekst fra output items
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

  const repoRoot = process.cwd();
  const criticalPath = path.join(repoRoot, "critical.log");
  const criticalLog = readFileSafe(criticalPath);

  if (!criticalLog.trim()) {
    throw new Error(
      "critical.log is missing or empty. The workflow must generate it before running autofix."
    );
  }

  // Ren arbeidsflate: unngå halvt appliserte patches
  try {
    runQuiet("git reset --hard");
  } catch {}

  const raw = await openaiUnifiedDiff({
    apiKey,
    model,
    inputText: criticalLog.slice(0, 120_000),
  });

  const rawNorm = normalizeNewlines(raw);

  // Guard: avvis CLI-artefakter i output
  try {
    guardNoCliArtifacts(rawNorm);
  } catch (e) {
    safeWrite("codex.raw.txt", rawNorm);
    throw e;
  }

  // Rens output til ren diff
  let cleaned = stripCodeFences(rawNorm);
  cleaned = extractFirstUnifiedDiffBlock(cleaned).trimEnd() + "\n";

  // ✅ Kontrollert NO-OP hvis modellen ikke ga diff
  if (!isUnifiedDiff(cleaned)) {
    safeWrite("codex.raw.txt", rawNorm);
    process.stdout.write(
      "ℹ️ No unified diff returned. No safe autofix suggested. Exiting without changes.\n"
    );
    return;
  }

  // Tom diff → NO-OP
  if (!cleaned.trim()) {
    safeWrite("codex.raw.txt", rawNorm);
    process.stdout.write("ℹ️ Empty diff returned. No changes to apply.\n");
    return;
  }

  safeWrite("codex.patch", cleaned);

  // Dry-run: valider patch før apply
  try {
    run("git apply --check codex.patch");
  } catch (e) {
    safeWrite("codex.raw.txt", rawNorm);
    const msg = String(e?.message || e);
    throw new Error(
      `git apply --check failed. Patch saved to codex.patch. Raw saved to codex.raw.txt. ${msg}`
    );
  }

  // Apply patch
  runQuiet("git apply codex.patch");

  process.stdout.write("✅ Patch applied successfully (codex.patch)\n");
}

main().catch((err) => {
  process.stderr.write(`❌ Autofix failed: ${err?.message || err}\n`);
  process.exit(1);
});
