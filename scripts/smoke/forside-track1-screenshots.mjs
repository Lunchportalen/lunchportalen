/**
 * Render proof for Umbraco forside track 1.
 * Serves wwwroot via static server and captures desktop / 980 / 640.
 */
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const wwwroot = path.resolve(__dirname, "../../umbraco17/lunchportalen/wwwroot");
const outDir = path.resolve(__dirname, "../../umbraco17/lunchportalen/proof/forside-track1");

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
};

function contentType(filePath) {
  return MIME[path.extname(filePath).toLowerCase()] ?? "application/octet-stream";
}

function startServer() {
  return new Promise((resolve) => {
    const server = createServer(async (req, res) => {
      const urlPath = decodeURIComponent((req.url ?? "/").split("?")[0]);
      const rel = urlPath === "/" ? "/dev/forside-track1-preview.html" : urlPath;
      const filePath = path.join(wwwroot, rel.replace(/^\//, ""));
      try {
        const body = await readFile(filePath);
        res.writeHead(200, { "Content-Type": contentType(filePath) });
        res.end(body);
      } catch {
        res.writeHead(404);
        res.end("Not found");
      }
    });
    server.listen(0, "127.0.0.1", () => resolve(server));
  });
}

const viewports = [
  { name: "desktop", width: 1280, height: 900 },
  { name: "980", width: 980, height: 900 },
  { name: "640", width: 640, height: 1200 },
];

const server = await startServer();
const { port } = server.address();
const base = `http://127.0.0.1:${port}/dev/forside-track1-preview.html`;

await import("node:fs/promises").then((fs) => fs.mkdir(outDir, { recursive: true }));

const browser = await chromium.launch();
const page = await browser.newPage();

for (const vp of viewports) {
  await page.setViewportSize({ width: vp.width, height: vp.height });
  await page.goto(base, { waitUntil: "networkidle" });
  await page.screenshot({ path: path.join(outDir, `forside-${vp.name}.png`), fullPage: true });
  console.log(`Wrote forside-${vp.name}.png`);
}

await browser.close();
server.close();
