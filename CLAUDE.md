# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Automation tool for @pustaka.sukses (Instagram brand, sells eBook "Karyawan AI"). Turns a scene-by-scene JSON script into a finished 9:16 + 4:5 educational reel: fetch b-roll (Pexels) → align voiceover to word timestamps (whisper) → build a Remotion timeline → render video + thumbnail. Rendering is local (Remotion + ffmpeg), runs from the terminal, one command for the whole flow.

**Voiceover/b-roll generation via Higgsfield requires MCP tools only callable inside a Claude Code chat session** — there is no standalone CLI for that step. Workflow: give the script to Claude in chat → generate VO via Higgsfield MCP (`text2speech_v2`, variant `minimax` — not `seed_audio`, which sounds foreign-accented in Indonesian) → save to `remotion/public/vo/<slug>.mp3` → run the one pipeline command below.

## Commands

```
cp .env.example .env        # then fill PEXELS_API_KEY=xxxxx
npm install
```

Full pipeline (the only command normally needed):
```
node pipeline/generate.js path/to/script.json
```
Does: load script → fetch b-roll (Pexels) → align VO to word timestamps (faster-whisper, auto-installs into `.venv/` on first use — Homebrew Python blocks system-wide `pip install`) → build timeline → render both 9:16 and 4:5 + a thumbnail PNG for each → `output/<slug>-9x16.mp4`, `-4x5.mp4`, `-9x16-thumb.png`, `-4x5-thumb.png`.

No VO yet? `--draft` renders a quick preview with word-count-estimated timing (no real audio, don't publish from this).

Other flags: `--slug name` (override slug from JSON), `--fps`, `--width`, `--height`, `--ratio 9:16|4:5` (default renders both; use one ratio for faster iteration).

```
npm run studio     # Remotion Studio, scrub the timeline manually before final render
```

Individual pipeline steps also have npm scripts (`generate`, `parse`, `fetch-broll`, `build-timeline`, `render`) but normally only `node pipeline/generate.js` is run directly — the others are stages it orchestrates.

There is no lint/test suite in this repo.

## Architecture

### Pipeline stages (`pipeline/`, run in this order by `generate.js`)

1. **`loadScript.js`** — reads the input script (`.json` scene array or free-text `.txt`), converts scenes to "beats" (`extractKeywords`/`toVisualQuery` from `stopwords.id.js`/`visualTerms.id-en.js` auto-derive a Pexels search query from Indonesian text when `visualQuery` isn't given), writes `remotion/public/timelines/<slug>.beats.json`. `parseScript.js` is an older standalone CLI for text-only scripts (predates JSON scene support) — not part of the `generate.js` flow.
2. **`fetchBroll.js`** — downloads b-roll per beat from Pexels (Portrait filter, HD not 4K to stay under 1GB), caches to `remotion/public/broll-cache/<slug>/`.
3. **`align.py`** (faster-whisper, Python) — aligns the VO audio to word-level timestamps, writes `<slug>.align.json`. Falls back to a word-count speaking-rate estimate (`WORDS_PER_SECOND = 2.3` in `buildTimeline.js`) when no VO or alignment is available — this is what powers `--draft` mode and is intentionally rough.
4. **`buildTimeline.js`** — merges beats + timing (from alignment or estimate) + Karya pose lookup (`poses.json`) into `<slug>.render.json`, the single JSON prop file the Remotion composition renders from. Per-word `startFrame`/`endFrame` here drive the karaoke-style kinetic caption. Parses `==word==` highlight markers into `word.highlight` (markers are display-only; stripped before word counting so alignment slicing stays in sync).

   Beat-boundary alignment is the trickiest part of this file. Whisper's transcribed word count rarely matches the script's (spoken-out numbers like "seratus lima puluh" come back as digits — "150-300", 2 tokens instead of 5), so a beat can't be sliced by raw word-count ratio without drifting into the next beat's sentence — the video then cuts to the next beat's visual while the VO is still finishing the current one. Fix: compute the proportional word-count boundary as a starting guess, then snap it onto the nearest whisper word that actually ends a sentence (`.`/`!`/`?`, within a small token window) — that lands on the real pause in the audio regardless of how the token counts diverged. Exact sentence-count matching between whisper and beats was tried first and rejected: whisper's punctuation restoration doesn't always agree with the script's (a script comma sometimes comes back as a whisper period), so `sentences.length !== beats.length` happens often enough to make an exact-match requirement useless. After boundaries are set, each beat's start is pulled up to 0.4s *before* its first spoken word (bounded by a max 0.2s J-cut into the previous sentence's tail — whisper often reports zero gap between sentences) so the matte transition plays over the breath pause and has opened by the time the first caption word lands; without this lead the cut sits exactly on the first word and the transition eats it ("captions feel late"). Then each beat's `durationFrames` is stretched to reach the next beat's `startFrame` — otherwise the silent gap for the VO's natural sentence pause renders as a flash to the black background before the next beat's wipe-in. An optional un-narrated `endCard` beat (`endCard: { text, karyaPose? }` at script top level → `EndCard.tsx`: @pustaka.sukses handle + closing line, ~1.6s) is appended after the last spoken beat.
5. **`generate.js`** (orchestrator) — clones the base render.json per aspect ratio (only width/height differ; content is identical because `Caption`/`KaryaOverlay` layout is percentage/vw-based), starts a local static server (`staticServer.js`) over `remotion/public`, rewrites asset paths in each render.json to point at that server, then shells out to `npx remotion render`/`still` per variant.

**Why the static server exists**: `remotion render`'s own public-dir copy has a race condition — whichever asset is requested first (never previously used) 404s because it's requested before the copy finishes (verified repeatedly: swapping file order, delaying start frame, absolute paths — always the "first-used" file that fails). `generate.js` runs its own static server and points render.json asset URLs at it instead of relying on Remotion's copy mechanism. Rendering manually via `npx remotion render` directly (bypassing `generate.js`) can reintroduce this bug.

### Remotion composition (`remotion/src/`)

- `Video.tsx` — main composition: `BrollBackground` (punch-in 1.14→1 settle at each cut + Ken Burns drift alternating direction per beat; uniform CSS grade + `GradeWash` soft-light teal overlay so mixed Pexels clips read as one graded piece; `dim` mode darkens+blurs footage under statement/stat beats), `MatteWipe` (the real Envato punch-hole transition: 4K fill + luma matte from the pack's FCP `Media/` folders merged into 1080×1920 alpha webm via ffmpeg `alphamerge` **with the source's first ~0.4s trimmed at encode time** — that stretch is a fully-opaque hold before the hole starts moving, and untrimmed it covers the first spoken words of every beat; auto-detected from `remotion/public/fx/transitions/*.webm`, cycled per cut, skipped on beat 0 so the hook is visible from frame one), whoosh SFX per cut (`fx/whoosh-*.mp3`, ffmpeg-synthesized noise sweeps, cycled like the transitions, also skipped on beat 0), `BeatContent` (branches per beat: endCard → EndCard, title → TitleCard, stat → StatCard, style "statement" → Statement, else Caption), `Vignette`, `ProgressBar`, optional low-volume looping music bed (`musicSrc`, auto-detected from `remotion/public/music/<slug>.mp3` or `music/default.mp3`; Higgsfield can't generate music — speech only).

  **Envato asset packs in `assets/` (gitignored)**: only the punch-hole pack is directly usable — its FCP `Media/` folders hide 3840×2160 fill+matte mp4s (M-prefixed/`Luminanc` files are the mattes; pair by matching frame counts). The other packs (Motion Typography, Motion Backgrounds, Motion Shapes) are AE `.aep` projects whose only rendered output is 340×192–480×270 previews, unusable at 1080p — `MotionAccents.tsx` (drifting glow blobs + radar ring behind statement/stat/title beats) is the procedural stand-in for that look. Don't re-audit only the pack root: the top-level preview mp4s being tiny does not mean the pack has no usable media.
- `components/Caption.tsx` — per-word kinetic caption (pop-in + scale on each word's own timestamp), currently-spoken word highlighted amber, ALLCAPS words (AI, PANG, UMKM, etc.) permanently amber, `==word==` script markers render as an amber block behind the word.
- `components/Statement.tsx` — big-typography beat (`style: "statement"` in script): the sentence itself centered mid-screen, word-by-word on spoken timestamps, over dimmed b-roll.
- `components/StatCard.tsx` — number/price callout beat (`stat: { label, value, note? }` in script): Space Mono kicker + huge spring-pop value; the VO narrates the number in words, the card is what sound-off viewers read.
- `components/KaryaOverlay.tsx` — mascot overlay, top-right corner, % positioning so it's identical at 9:16 and 4:5. `karyaSize: "big"` in the script renders it large bottom-right (the calendar's "tampil besar" direction) — don't combine with a bottom Caption beat, they collide; use it on statement beats where text sits mid-screen.
- `components/Badge.tsx`, `components/TitleCard.tsx`, `components/GrainOverlay.tsx` — callout tag, chapter/section break card (centered text, no b-roll/Karya, still timed like a normal beat), film-grain texture (`mix-blend-mode: overlay`).
- `Thumbnail.tsx` — separate composition, renders from `<slug>-<ratio>.thumbnail.json` (headline + Karya frame).
- `brand.ts` — brand color/font constants, single source of truth for styling.
- `resolveSrc.ts` — resolves asset paths (local public-dir vs. static-server URL) uniformly across compositions.

All render/thumbnail props are driven by the JSON files in `remotion/public/timelines/` — the React components are pure renderers of that data, not where beat/timing logic lives.

### Karya mascot poses

`remotion/public/karya/poses.json` maps pose names (used via `karyaPose` in script JSON) to PNG frame sequences (`pose-N/frame-0XX.png`). Poses must be separate PNG frames, not video/GIF — h264/mp4 can't hold an alpha channel (converting a transparent GIF to mp4 flattens transparency to a white box; already hit this, fixed by extracting PNG frames instead: `ffmpeg -i x.gif -vsync 0 -pix_fmt rgba .../frame-%03d.png`). Current `pose-1`..`pose-10` → `idle`/`greet`/`point`/`celebrate`/`talking`/`think` mapping in `poses.json` is an unconfirmed visual guess — verify before trusting it. `talking` still reuses another pose as a placeholder; the 20 mouth-flap "talking" GIFs from the brand doc haven't been dropped into the project yet.

## Brand rules (apply to every generated script/video)

- No fake proof — no fake screenshots, income numbers, or testimonials.
- No hyper-realistic AI face as host, no face/voice cloning (Gemini Omni's Avatar feature is off-limits).
- No instant-money / no-effort claims.
- Single CTA per reel — never two competing calls to action.
- On-screen text is always rendered by Remotion (Caption/Badge/TitleCard), never by AI (Gemini Omni is unreliable at in-frame text).
- Brand colors (`remotion/src/brand.ts`): Teal `#0E6E5B`, Teal Deep `#0A4A3E`, Amber `#D79A2B`, Cream `#FBF8F1`, Ink `#16201C`. Fonts: Plus Jakarta Sans (headline/body), Space Mono (labels/numbers/tags). Avoid collage/halftone style and electric blue (a competitor's visual identity).

## Reference example

[pipeline/reel-2jul-pang.json](pipeline/reel-2jul-pang.json) is a full worked example (script → TTS → whisper align → b-roll → Karya → captions → 9:16/4:5 render + thumbnails), output in `output/reel-2jul-pang-*`. Use it as the format reference when writing a new script.
