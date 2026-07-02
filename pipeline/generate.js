import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { loadScriptToFile } from "./loadScript.js";
import { startStaticServer } from "./staticServer.js";

function parseArgs(argv) {
  const args = { fps: 30, width: 1080, height: 1920, draft: false };
  const positional = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--slug") args.slug = argv[++i];
    else if (a === "--draft") args.draft = true;
    else if (a === "--fps") args.fps = Number(argv[++i]);
    else if (a === "--width") args.width = Number(argv[++i]);
    else if (a === "--height") args.height = Number(argv[++i]);
    else positional.push(a);
  }
  args.input = positional[0];
  return args;
}

function findVoAudio(slug) {
  for (const ext of ["mp3", "wav", "m4a"]) {
    const rel = `vo/${slug}.${ext}`;
    if (existsSync(resolve("remotion/public", rel))) return rel;
  }
  return null;
}

function run(cmd, cmdArgs, label) {
  console.log(`\n> ${label}`);
  const res = spawnSync(cmd, cmdArgs, { stdio: "inherit" });
  if (res.status !== 0) {
    throw new Error(`${label} gagal (exit ${res.status})`);
  }
}

// spawnSync blocks the whole Node event loop -- fine for steps before our
// static server starts, but fatal for the render step: it runs concurrently
// with our in-process HTTP server (see staticServer.js), and a blocked event
// loop means that server can never actually answer the render's asset
// requests (a deadlock, not a slow response).
function runAsync(cmd, cmdArgs, label) {
  console.log(`\n> ${label}`);
  return new Promise((resolvePromise, reject) => {
    const child = spawn(cmd, cmdArgs, { stdio: "inherit" });
    child.on("close", (code) => {
      if (code !== 0) reject(new Error(`${label} gagal (exit ${code})`));
      else resolvePromise();
    });
  });
}

// Homebrew's system Python refuses plain `pip install` (PEP 668,
// externally-managed-environment) -- faster-whisper needs its own venv
// rather than --break-system-packages, which risks the system install.
function ensureWhisperPython() {
  const venvPython = resolve(".venv/bin/python3");
  if (existsSync(venvPython)) return venvPython;

  console.log("Bikin virtualenv buat faster-whisper (.venv)...");
  if (spawnSync("python3", ["-m", "venv", ".venv"], { stdio: "inherit" }).status !== 0) return null;
  if (spawnSync(resolve(".venv/bin/pip"), ["install", "faster-whisper"], { stdio: "inherit" }).status !== 0) {
    return null;
  }
  return venvPython;
}

function tryAlign(slug, voRel) {
  const alignRel = `timelines/${slug}.align.json`;
  const alignAbs = resolve("remotion/public", alignRel);
  const voAbs = resolve("remotion/public", voRel);

  console.log("\n> Align VO ke timestamp (whisper)");
  let python = existsSync(resolve(".venv/bin/python3")) ? resolve(".venv/bin/python3") : "python3";
  let res = spawnSync(python, ["pipeline/align.py", voAbs, alignAbs], { stdio: "inherit" });

  if (res.status === 2) {
    python = ensureWhisperPython();
    if (python) {
      res = spawnSync(python, ["pipeline/align.py", voAbs, alignAbs], { stdio: "inherit" });
    }
  }

  if (!python || res.status !== 0) {
    console.warn(
      "Align dilewati -- pakai estimasi word-count buat timing (kurang presisi, jangan publish tanpa dicek)."
    );
    return null;
  }
  return alignRel;
}

// Rewrite the render.json's asset paths to absolute http URLs served by our
// own static server (see pipeline/staticServer.js) so Remotion's render
// step doesn't go through its own public-dir copy, which races on the
// first never-before-requested asset in a render and 404s.
function pointRenderJsonAtServer(slug, baseUrl) {
  const renderPath = resolve("remotion/public/timelines", `${slug}.render.json`);
  const timeline = JSON.parse(readFileSync(renderPath, "utf8"));
  const toUrl = (relPath) => `${baseUrl}/${relPath}`;

  for (const beat of timeline.beats) {
    if (beat.broll) beat.broll = toUrl(beat.broll);
    if (beat.karya?.type === "video") beat.karya.src = toUrl(beat.karya.src);
    if (beat.karya?.type === "frames") beat.karya.frames = beat.karya.frames.map(toUrl);
  }
  if (timeline.audioSrc) timeline.audioSrc = toUrl(timeline.audioSrc);

  writeFileSync(renderPath, JSON.stringify(timeline, null, 2));
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.input) {
    console.error("Pakai: node pipeline/generate.js <script.json|script.txt> [--slug xxx] [--draft]");
    process.exit(1);
  }

  const { slug } = loadScriptToFile(args.input, args.slug);
  console.log(`Script dimuat -> slug "${slug}"`);

  run("node", ["pipeline/fetchBroll.js", slug], "Ambil b-roll (Pexels)");

  const vo = args.draft ? null : findVoAudio(slug);
  if (!vo && !args.draft) {
    console.log(
      `\nVO belum ada di remotion/public/vo/${slug}.mp3 -- generate dulu lewat Claude (Higgsfield TTS) atau taruh rekaman di path itu, lalu jalankan ulang command ini.\n` +
        `Atau pakai --draft buat preview cepat tanpa VO asli (timing estimasi kasar).`
    );
    process.exit(1);
  }

  const alignRel = vo ? tryAlign(slug, vo) : null;

  const buildArgs = [
    "pipeline/buildTimeline.js",
    slug,
    "--fps", String(args.fps),
    "--width", String(args.width),
    "--height", String(args.height),
  ];
  if (vo) buildArgs.push("--audio", vo);
  if (alignRel) buildArgs.push("--align", alignRel);
  run("node", buildArgs, "Bangun timeline");

  mkdirSync(resolve("output"), { recursive: true });
  const outPath = resolve("output", `${slug}.mp4`);

  const { server, baseUrl } = await startStaticServer(resolve("remotion/public"));
  try {
    pointRenderJsonAtServer(slug, baseUrl);
    await runAsync(
      "npx",
      [
        "remotion",
        "render",
        "remotion/src/index.ts",
        "Video",
        outPath,
        `--props=remotion/public/timelines/${slug}.render.json`,
      ],
      "Render video"
    );
  } finally {
    server.close();
  }

  console.log(`\nSelesai -> ${outPath}`);
}

main().catch((err) => {
  console.error(`\n${err.message}`);
  process.exit(1);
});
