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

// Alpha-channel webm transitions converted from the Envato punch-hole pack
// (4K fill + luma matte from the FCP Media folders, merged via ffmpeg
// alphamerge -- see README). Cycled per beat cut in Video.tsx. Empty dir =
// fall back to the CSS circle wipe.
function listTransitions() {
  const dir = resolve("remotion/public/fx/transitions");
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith(".webm"))
    .sort()
    .map((f) => `fx/transitions/${f}`);
}

// Several whoosh variants, cycled per cut in Video.tsx -- one identical
// whoosh on 7 cuts in a 30s reel reads as a template, slight variation
// reads as sound design.
function listWhooshes() {
  const dir = resolve("remotion/public/fx");
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => /^whoosh.*\.mp3$/.test(f))
    .sort()
    .map((f) => `fx/${f}`);
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

// Indices of whisper words that end a sentence (. ! ?) -- candidate pause
// points to snap a beat boundary onto. Numbers read out as digits
// ("150-300") don't end a sentence so they never produce a false snap
// point mid-number.
function terminalIndices(words) {
  const idx = [];
  words.forEach((w, i) => {
    if (/[.!?]$/.test(w.word.trim())) idx.push(i);
  });
  return idx;
}

// Nearest terminal index to `target` (searching from `minIdx` onward,
// within `window` tokens). Ties resolve to the earlier index, which in
// practice is the correct one slightly more often (a beat's own
// sentence-end is reached before the next beat's).
function snapToTerminal(terminalIdx, target, minIdx, window) {
  let best = null;
  let bestDist = Infinity;
  for (const idx of terminalIdx) {
    if (idx < minIdx) continue;
    const dist = Math.abs(idx - target);
    if (dist <= window && dist < bestDist) {
      best = idx;
      bestDist = dist;
    }
  }
  return best;
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
  // as digits ("150-300", 2 tokens) -- so a naive word-count-ratio slice
  // boundary lands mid-sentence, ahead of where the VO actually is.
  // Requiring whisper's sentence breaks to match beats 1:1 doesn't work
  // either: whisper's punctuation restoration doesn't always agree with
  // the script's (a script comma sometimes comes back as a period,
  // splitting one beat into several whisper "sentences"). So: compute the
  // proportional boundary as before, then snap it onto the nearest actual
  // sentence-ending word within a small window -- exact when whisper's
  // punctuation lines up with the script, still close when it doesn't,
  // and never worse than the plain proportional guess.
  const ratio = totalScriptWords > 0 ? words.length / totalScriptWords : 1;
  const terminalIdx = terminalIndices(words);
  const SNAP_WINDOW = 6;

  let cumScript = 0;
  let sliceStart = 0;
  const slices = beats.map((beat, beatIdx) => {
    const originalWords = beatWords[beatIdx];
    cumScript += originalWords.length;
    let sliceEndExclusive;
    if (beatIdx === beats.length - 1) {
      sliceEndExclusive = words.length;
    } else {
      const target = Math.round(cumScript * ratio) - 1;
      const snapped = snapToTerminal(terminalIdx, target, sliceStart, SNAP_WINDOW);
      const guess = snapped ?? Math.max(sliceStart, target);
      sliceEndExclusive = Math.max(sliceStart + 1, Math.min(guess + 1, words.length));
    }
    const slice = words.slice(sliceStart, sliceEndExclusive);
    sliceStart = sliceEndExclusive;
    return slice;
  });

  // Cuts land in the breath pause BEFORE a sentence, not on its first
  // word: each beat starts up to LEAD_SECONDS before its first spoken word
  // (bounded by where the previous sentence actually ends), so the matte
  // transition plays over silence and has fully opened by the time the VO
  // -- and therefore the first caption word -- lands. Without this the
  // paper cover eats the first 2-3 words of every sentence ("captions feel
  // late").
  const LEAD_SECONDS = 0.4;
  // Whisper often reports zero gap between sentences (its end timestamps
  // overshoot into the pause), which would leave no room for the lead. A
  // J-cut is allowed instead: the cut may bite up to this far into the
  // tail of the previous sentence -- standard editing, audio leads video.
  const MAX_JCUT_SECONDS = 0.2;

  return beats.map((beat, beatIdx) => {
    const originalWords = beatWords[beatIdx];
    const slice = slices[beatIdx];

    const firstWordStart = slice.length ? slice[0].start : 0;
    const prevSlice = beatIdx > 0 ? slices[beatIdx - 1] : null;
    const prevEnd = prevSlice && prevSlice.length ? prevSlice[prevSlice.length - 1].end : 0;
    const start =
      beatIdx === 0
        ? 0
        : Math.max(prevEnd - MAX_JCUT_SECONDS, firstWordStart - LEAD_SECONDS);
    const end = slice.length
      ? slice[slice.length - 1].end
      : firstWordStart + beat.wordCount / WORDS_PER_SECOND;
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
  const { beats, endCard } = JSON.parse(readFileSync(beatsPath, "utf8"));
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

  // Whisper alignment leaves a silent gap between beats for the VO's
  // natural sentence pause (its words end where speech ends, not where the
  // next beat starts) -- left alone, that gap renders as a blank cut to
  // the ink background before the next beat's wipe-in even begins. Stretch
  // each beat's visual to fill through to the next beat's start instead,
  // so the b-roll/caption holds through the breath rather than flashing
  // black. No-op for word-count estimation, which is already contiguous.
  for (let i = 0; i < timedBeats.length - 1; i++) {
    const gapEnd = timedBeats[i + 1].startFrame;
    timedBeats[i].durationFrames = Math.max(timedBeats[i].durationFrames, gapEnd - timedBeats[i].startFrame);
  }

  let durationFrames = timedBeats.reduce(
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
    karyaSize: b.karyaSize ?? null,
    badge: b.badge ?? null,
    title: Boolean(b.title),
    style: b.style ?? null,
    stat: b.stat ?? null,
    endCard: false,
  }));

  // Un-narrated outro card so the reel breathes for a beat after the CTA
  // sentence instead of hard-stopping on its last word.
  if (endCard) {
    const END_CARD_FRAMES = Math.round(1.6 * args.fps);
    renderBeats.push({
      index: renderBeats.length,
      text: endCard.text || "",
      words: [],
      startFrame: durationFrames,
      durationFrames: END_CARD_FRAMES,
      broll: null,
      karya: poses[endCard.karyaPose || "point"] ?? null,
      karyaSize: null,
      badge: null,
      title: false,
      style: null,
      stat: null,
      endCard: true,
    });
    durationFrames += END_CARD_FRAMES;
  }

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
    transitionSrcs: listTransitions(),
    whooshSrcs: listWhooshes(),
  };

  const outPath = resolve("remotion/public/timelines", `${args.slug}.render.json`);
  writeFileSync(outPath, JSON.stringify(timeline, null, 2));
  console.log(
    `Timeline -> ${outPath} (${(durationFrames / args.fps).toFixed(1)}s, ${renderBeats.length} beat)`
  );
}

main();
