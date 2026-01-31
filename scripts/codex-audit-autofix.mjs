import fs from "node:fs";
import { execSync } from "node:child_process";

const log = fs.existsSync("critical.log") ? fs.readFileSync("critical.log", "utf8") : "";

// ⚠️ Dette forutsetter at du har en måte å kalle Codex på i CI,
// f.eks. en codex-cli eller et internt skript som bruker OpenAI API.
// Hvis du sier hvilken “Codex runtime” du bruker (CLI eller API),
// tilpasser jeg denne filen 1:1 til ditt oppsett.

const SYSTEM = `
DU ER "LUNCHPORTALEN AUTOFIX BOT".
MÅL: Få npm run ci:critical grønn med minst mulig endring.

REGLER:
- Minimal patch. Ingen refactor, ingen ny funksjonalitet.
- Ikke svekk auth/role-gates eller RLS/tenant isolation.
- Cut-off 08:00 Europe/Oslo og no-exception rule skal aldri brytes.
- Bevar API-shapes.
- Output kun unified diff patch.
`;

const USER = `
ci:critical feilet. Her er loggen:
---
${log.slice(-20000)}
---

Lag minimal patch som fikser feilen(e). Output kun unified diff.
`;

// Placeholder: erstatt med din Codex-kallmekanisme:
const cmd = `codex --model gpt-5-codex --system "${SYSTEM.replaceAll('"','\\"')}" --prompt "${USER.replaceAll('"','\\"')}"`;
const patch = execSync(cmd, { encoding: "utf8" });

fs.writeFileSync("codex.patch", patch, "utf8");
execSync("git apply codex.patch", { stdio: "inherit" });
