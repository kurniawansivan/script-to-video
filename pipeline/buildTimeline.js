import { readFileSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

function loadPoses() {
  const posesPath = resolve("remotion/public/karya/poses.json");
  if (!existsSync(posesPath)) return {};
  return JSON.parse(readFileSync(posesPath, "utf8"));
}

function listGrainFrames() {
  const grainDir = resolve("remotion/public/fx/grain");
  if (!existsSync(grainDir)) return [];
  return readdirSync(grainDir)
    .filter((f) => f.endsWith(".png"))
    .sort()
    .map((f) => `fx/grain/${f}`);
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
    else if (a === "--music") args.music = argv[++i];
    else if (a === "--align") args.align = argv[++i];
    else if (a === "--fps") args.fps = Number(argv[++i]);
    else if (a === "--width") args.width = Number(argv[++i]);
    else if (a === "--height") args.height = Number(argv[++i]);
    else if (!args.slug) args.slug = a;
  }
  return args;
}

// Word timing (beat-relative frames) drives the karaoke-style kinetic
// caption in Caption.tsx -- without it, captions can only pop in/out as one
// block per beat, which is the "flat" look we're moving away from.
// Split beat text into display words, honoring ==word== / ==multi word==
// highlight markers: the marks are stripped from the rendered text and the
// covered words get highlight: true (amber block behind the word, see
// Caption.tsx/Statement.tsx). Word count must match the spoken text exactly
// or alignment slicing drifts, hence marker-aware splitting here rather
// than in the components.
function parseDisplayWords(text) {
  const words = [];
  text.split("==").forEach((segment, i) => {
    const highlight = i % 2 === 1;
    for (const token of segment.split(/\s+/).filter(Boolean)) {
      // Trailing punctuation right after a closing marker ("==harga==?")
      // would otherwise become its own zero-length "word" and shift timing.
      if (!/[\p{L}\p{N}]/u.test(token) && words.length > 0) {
        words[words.length - 1].text += token;
      } else {
        words.push({ text: token, highlight });
      }
    }
  });
  return words;
}

function estimateDurationsFromWordCount(beats, fps) {
  let cursor = 0;
  return beats.map((beat) => {
    const words = parseDisplayWords(beat.text);
    const seconds = Math.max(MIN_BEAT_SECONDS, words.length / WORDS_PER_SECOND);
    const durationFrames = Math.round(seconds * fps);
    const startFrame = cursor;
    cursor += durationFrames;

    const perWordFrames = durationFrames / words.length;
    const wordTimings = words.map((w, i) => ({
      ...w,
      startFrame: Math.round(i * perWordFrames),
      endFrame: Math.round((i + 1) * perWordFrames),
    }));

    return { ...beat, startFrame, durationFrames, words: wordTimings };
  });
}

function timingsFromAlignment(beats, alignment, fps) {
  // alignment.words: [{ word, start, end }] in seconds, in the same reading
  // order as the beats' text (e.g. from a Whisper word-timestamp pass).
  // Display text stays the original script word (so typography/casing
  // matches the brand copy) -- only the timing comes from Whisper.
  const words = alignment.words;
  const beatWords = beats.map((beat) => parseDisplayWords(beat.text));
  const totalScriptWords = beatWords.reduce((sum, w) => sum + w.length, 0);

  // Whisper's transcript word count can differ from the script's -- most
  // often spoken numbers ("seratus lima puluh ribu", 4 words) coming back
  // as digits ("150.000", 1 token). Naive fixed-size slicing then drifts
  // cumulatively across every later beat. Slice boundaries are scaled by
  // the count ratio instead: exact when counts match, gracefully
  // approximate when they don't.
  const ratio = words.length / totalScriptWords;
  if (words.length !== totalScriptWords) {
    console.warn(
      `Jumlah kata whisper (${words.length}) != script (${totalScriptWords}) -- slicing proporsional, cek hasilnya di studio.`
    );
  }

  let cumScript = 0;
  return beats.map((beat, beatIdx) => {
    const originalWords = beatWords[beatIdx];
    const sliceStart = Math.round(cumScript * ratio);
    cumScript += originalWords.length;
    const sliceEnd = Math.max(sliceStart + 1, Math.round(cumScript * ratio));
    const slice = words.slice(sliceStart, Math.min(sliceEnd, words.length));

    const start = slice.length ? slice[0].start : 0;
    const end = slice.length
      ? slice[slice.length - 1].end
      : start + beat.wordCount / WORDS_PER_SECOND;
    const startFrame = Math.round(start * fps);
    const durationFrames = Math.max(1, Math.round((end - start) * fps));

    const wordTimings = originalWords.map((word, i) => {
      // Map script word i onto the (possibly shorter/longer) whisper slice.
      const w = slice.length
        ? slice[Math.min(slice.length - 1, Math.floor((i * slice.length) / originalWords.length))]
        : null;
      const evenStart = Math.round((i * durationFrames) / originalWords.length);
      const evenEnd = Math.round(((i + 1) * durationFrames) / originalWords.length);
      const wStartFrame = w ? Math.round(w.start * fps) - startFrame : evenStart;
      const wEndFrame = w ? Math.round(w.end * fps) - startFrame : evenEnd;
      return {
        ...word,
        startFrame: Math.max(0, wStartFrame),
        endFrame: Math.max(wStartFrame + 1, wEndFrame),
      };
    });

    return { ...beat, startFrame, durationFrames, words: wordTimings };
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
    words: b.words,
    startFrame: b.startFrame,
    durationFrames: b.durationFrames,
    broll: b.broll ?? null,
    karya: poses[b.karyaPose] ?? null,
    badge: b.badge ?? null,
    title: Boolean(b.title),
    style: b.style ?? null,
    stat: b.stat ?? null,
  }));

  const timeline = {
    slug: args.slug,
    fps: args.fps,
    width: args.width,
    height: args.height,
    audioSrc: args.audio ?? null,
    musicSrc: args.music ?? null,
    durationFrames,
    beats: renderBeats,
    grainFrames: listGrainFrames(),
  };

  const outPath = resolve("remotion/public/timelines", `${args.slug}.render.json`);
  writeFileSync(outPath, JSON.stringify(timeline, null, 2));
  console.log(
    `Timeline -> ${outPath} (${(durationFrames / args.fps).toFixed(1)}s, ${renderBeats.length} beat)`
  );
}

main();
