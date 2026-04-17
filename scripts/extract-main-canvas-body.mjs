import fs from "fs";

const p = "app/(backoffice)/backoffice/content/_components/ContentWorkspace.tsx";
const lines = fs.readFileSync(p, "utf8").split(/\r?\n/);
// Children of EditorCanvas: lines 6248–6711 (1-based) → index 6247..6710
const start = 6247;
const end = 6710;
const slice = lines.slice(start, end + 1);

function normalizeIndent(rows) {
  const nonEmpty = rows.filter((l) => l.trim().length > 0);
  const indents = nonEmpty.map((l) => l.match(/^\s*/)[0].length);
  const min = Math.min(...indents);
  return rows.map((l) => {
    if (!l.trim()) return "";
    const m = l.match(/^(\s*)(.*)$/);
    const n = (m[1] ?? "").length;
    const rest = m[2] ?? "";
    const next = Math.max(0, n - min);
    return " ".repeat(next) + rest;
  });
}

const body = normalizeIndent(slice).join("\n");
fs.writeFileSync("scripts/_main_canvas_body.txt", body, "utf8");
console.log("lines", slice.length, "min indent", Math.min(...slice.filter((l) => l.trim()).map((l) => l.match(/^\s*/)[0].length)));
