// Renders index.html frame by frame to an MP4 (no audio).
//   node render.mjs                  -> out/faa-ground-stop.mp4 at 60 fps
//   node render.mjs --fps 30         -> 30 fps
//   node render.mjs --stills 1,4.5   -> PNG stills at those seconds, no video
// Needs Playwright (Chromium) and ffmpeg on the PATH.
import { createRequire } from "node:module";
import { spawn, execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require("playwright")); }
catch { ({ chromium } = createRequire(execFileSync("npm", ["root", "-g"]).toString().trim() + "/")("playwright")); }

const here = path.dirname(fileURLToPath(import.meta.url));
const arg = (name, fallback) => { const i = process.argv.indexOf("--" + name); return i > -1 ? process.argv[i + 1] : fallback; };
const fps = Number(arg("fps", 60));
const workers = Number(arg("workers", 4));
const stills = arg("stills", null);
const out = path.join(here, "out");
mkdirSync(out, { recursive: true });
const url = pathToFileURL(path.join(here, "index.html")).href + "?render";

const browser = await chromium.launch();
const open = async () => {
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
  page.on("pageerror", (e) => { console.error("page error:", e.message); process.exitCode = 1; });
  await page.goto(url);
  await page.waitForFunction("window.__ready === true");
  return page;
};

if (stills) {
  const page = await open();
  const dir = path.join(out, arg("dir", "stills"));
  mkdirSync(dir, { recursive: true });
  for (const t of stills.split(",").map(Number)) {
    await page.evaluate((x) => window.__seek(x), t);
    await page.screenshot({ path: path.join(dir, `still-${t.toFixed(2).padStart(6, "0")}.png`) });
  }
  await browser.close();
  process.exit();
}

const first = await open();
const duration = await first.evaluate("window.__duration");
await first.close();
const frames = Math.round(duration * fps);
const per = Math.ceil(frames / workers);
console.log(`${duration.toFixed(2)} s, ${frames} frames at ${fps} fps, ${workers} workers`);

const parts = await Promise.all(Array.from({ length: workers }, async (_, w) => {
  const from = w * per, to = Math.min(frames, from + per);
  const file = path.join(out, `.part-${w}.mp4`);
  const ff = spawn("ffmpeg", ["-v", "error", "-y", "-f", "image2pipe", "-framerate", String(fps), "-c:v", "png", "-i", "-",
    "-c:v", "libx264", "-preset", "slow", "-crf", "14", "-pix_fmt", "yuv420p", "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "bt709", "-movflags", "+faststart", file], { stdio: ["pipe", "inherit", "inherit"] });
  const page = await open();
  for (let f = from; f < to; f++) {
    await page.evaluate((x) => window.__seek(x), f / fps);
    const buf = await page.screenshot({ type: "png" });
    if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once("drain", r));
  }
  ff.stdin.end();
  await new Promise((r) => ff.on("close", r));
  await page.close();
  return file;
}));
await browser.close();

const list = path.join(out, ".parts.txt");
writeFileSync(list, parts.map((p) => `file '${p}'`).join("\n"));
const final = path.join(out, "faa-ground-stop.mp4");
execFileSync("ffmpeg", ["-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", list, "-c", "copy", "-movflags", "+faststart", final]);
[...parts, list].forEach((p) => rmSync(p));
console.log("wrote", final);
