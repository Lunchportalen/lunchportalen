import { readFileSync, writeFileSync } from "fs";
import { join } from "path";

const ROOT = join(import.meta.dirname, "../..");
const { checks } = JSON.parse(readFileSync(join(ROOT, ".p3m3-parse.json"), "utf8"));
const mini = [];
for (let i = 0; i < checks.length; i += 10) {
  const slice = checks.slice(i, i + 10);
  const parts = slice.map(
    (c, j) =>
      `SELECT ${i + j} AS cid, '${c.file.replace(/'/g, "''")}' AS file, '${c.kind}' AS kind, '${c.name.replace(/'/g, "''")}' AS obj, (${c.sql}) AS ok`
  );
  mini.push(parts.join("\nUNION ALL\n"));
}
writeFileSync(join(ROOT, ".p3m3-mini-chunks.json"), JSON.stringify(mini));
console.log("mini chunks", mini.length);
