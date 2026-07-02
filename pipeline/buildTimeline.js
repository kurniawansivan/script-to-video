import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

function loadPoses() {
  const posesPath = resolve("remotion/public/karya/poses.json");
  if (!existsSync(posesPath)) return {};
  return JSON.parse(readFileSync(posesPath, "utf8"));
}

// Rough Indonesian speaking-pace fallback, only used when no real alignment
// is available yet. Always replace with --align once VO audio exists --
// word-count timing is a placeholder, not accurate enough to publish.
const WORDS_PER_SECOND = 2.3;
const MIN_BEAT_SECONDS = 1.2;

function parseArgs(argv) {
  const args = { fps: 30, width: 1080, height: 1920 };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--audio") args.audio = argv[++i];
    else if (a === "--align") args.align = argv[++i];
    else if (a === "--fps") args.fps = Number(argv[++i]);
    else if (a === "--width") args.width = Number(argv[++i]);
    else if (a === "--height") args.height = Number(argv[++i]);
    else if (!args.slug) args.slug = a;
  }
  return args;
}

function estimateDurationsFromWordCount(beats, fps) {
  let cursor = 0;
  return beats.map((beat) => {
    const seconds = Math.max(MIN_BEAT_SECONDS, beat.wordCount / WORDS_PER_SECOND);
    const durationFrames = Math.round(seconds * fps);
    const startFrame = cursor;
    cursor += durationFrames;
    return { ...beat, startFrame, durationFrames };
  });
}

function timingsFromAlignment(beats, alignment, fps) {
  // alignment.words: [{ word, start, end }] in seconds, in the same reading
  // order as the beats' text (e.g. from a Whisper word-timestamp pass).
  const words = alignment.words;
  let wordCursor = 0;
  return beats.map((beat) => {
    const beatWordCount = beat.text.split(/\s+/).filter(Boolean).length;
    const slice = words.slice(wordCursor, wordCursor + beatWordCount);
    wordCursor += beatWordCount;
    const start = slice.length ? slice[0].start : 0;
    const end = slice.length
      ? slice[slice.length - 1].end
      : start + beat.wordCount / WORDS_PER_SECOND;
    return {
      ...beat,
      startFrame: Math.round(start * fps),
      durationFrames: Math.max(1, Math.round((end - start) * fps)),
    };
  });
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.slug) {
    console.error(
      "Pakai: node pipeline/buildTimeline.js <slug> [--audio vo/xxx.mp3] [--align timelines/xxx.align.json]"
    );
    process.exit(1);
  }

  const beatsPath = resolve("remotion/public/timelines", `${args.slug}.beats.json`);
  const { beats } = JSON.parse(readFileSync(beatsPath, "utf8"));
  const poses = loadPoses();

  let timedBeats;
  if (args.align) {
    const alignment = JSON.parse(readFileSync(resolve("remotion/public", args.align), "utf8"));
    timedBeats = timingsFromAlignment(beats, alignment, args.fps);
    console.log(`Timing dari alignment: ${args.align}`);
  } else {
    timedBeats = estimateDurationsFromWordCount(beats, args.fps);
    console.log(
      "Timing dari estimasi word-count -- belum ada alignment asli, durasi kasar. Rebuild dengan --align setelah VO + whisper alignment siap."
    );
  }

  const durationFrames = timedBeats.reduce(
    (max, b) => Math.max(max, b.startFrame + b.durationFrames),
    0
  );

  const renderBeats = timedBeats.map((b) => ({
    index: b.index,
    text: b.text,
    startFrame: b.startFrame,
    durationFrames: b.durationFrames,
    broll: b.broll ?? null,
    karya: poses[b.karyaPose] ?? null,
  }));

  const timeline = {
    slug: args.slug,
    fps: args.fps,
    width: args.width,
    height: args.height,
    audioSrc: args.audio ?? null,
    durationFrames,
    beats: renderBeats,
  };

  const outPath = resolve("remotion/public/timelines", `${args.slug}.render.json`);
  writeFileSync(outPath, JSON.stringify(timeline, null, 2));
  console.log(
    `Timeline -> ${outPath} (${(durationFrames / args.fps).toFixed(1)}s, ${renderBeats.length} beat)`
  );
}

main();
