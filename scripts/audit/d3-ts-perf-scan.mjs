#!/usr/bin/env node
import fs from "node:fs";
import { globSync } from "glob";

const files = globSync("**/*.{ts,tsx}", {
  cwd: process.cwd(),
  ignore: ["**/node_modules/**", "**/.next/**", "**/archive/**", "**/playwright-report/**"],
});
let anyTotal = 0;
let anyFiles = 0;
let tsIgnoreTotal = 0;
let imgRaw = 0;
let imgNext = 0;
const anyByFile = [];

for (const f of files) {
  const src = fs.readFileSync(f, "utf8");
  const anyM = src.match(/: any\b/g);
  if (anyM) {
    anyTotal += anyM.length;
    anyFiles++;
    anyByFile.push({ file: f.replace(/\\/g, "/"), count: anyM.length });
  }
  tsIgnoreTotal += (src.match(/@ts-ignore|@ts-expect-error/g) || []).length;
  if (/\.tsx$/.test(f)) {
    imgRaw += (src.match(/<img[\s>]/g) || []).length;
    if (/from ['"]next\/image['"]/.test(src) || /<Image[\s>]/.test(src)) imgNext++;
  }
}

anyByFile.sort((a, b) => b.count - a.count);
console.log(
  JSON.stringify(
    {
      files_scanned: files.length,
      any_total: anyTotal,
      any_files: anyFiles,
      ts_ignore_total: tsIgnoreTotal,
      img_raw: imgRaw,
      img_next_files: imgNext,
      top_any_files: anyByFile.slice(0, 15),
    },
    null,
    2,
  ),
);
