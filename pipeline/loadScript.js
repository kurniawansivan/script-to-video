import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve, basename, extname } from "node:path";
import { beatsFromText } from "./textToBeats.js";
import { extractKeywords } from "./stopwords.id.js";
import { toVisualQuery } from "./visualTerms.id-en.js";

function beatsFromScenes(scenes) {
  return scenes.map((scene, index) => {
    if (!scene.text) throw new Error(`scenes[${index}] butuh field "text"`);
    // ==word== highlight markers are display-only decoration; strip them
    // before keyword extraction and word counting so visual-query derivation
    // and whisper alignment slicing stay in sync with the spoken text.
    const cleanText = scene.text.replace(/==/g, "");
    const keywords = extractKeywords(cleanText);
    return {
      index,
      text: scene.text,
      wordCount: cleanText.split(/\s+/).filter(Boolean).length,
      keywords,
      query: scene.visualQuery || toVisualQuery(keywords),
      karyaPose: scene.karyaPose || "idle",
      // "big" -> Karya rendered large bottom-right as on-screen host (the
      // calendar's "tampil besar" note for trust topics). Default corner size.
      karyaSize: scene.karyaSize || null,
      cta: Boolean(scene.cta),
      // Optional callout tag rendered top-left, e.g. "TIPS" / "CONTOH" / "FAKTA".
      badge: scene.badge || null,
      // Chapter/section break: renders as a centered statement card on a
      // grainy background instead of the normal broll+caption beat layout
      // (still spoken/timed like any other scene). See TitleCard.tsx.
      title: Boolean(scene.title),
      // "statement": big centered kinetic text over dimmed/blurred b-roll
      // (the Raymond Chin big-typography look) instead of the bottom caption.
      style: scene.style || null,
      // Big number/price callout card: { label, value, note? }. The VO still
      // narrates the number in words; the card is what sound-off viewers read.
      stat: scene.stat || null,
    };
  });
}

// Accepts either a JSON scene script (pipeline/script.example.json format)
// or a free-text .txt script. Returns { slug, beats } -- does not write
// anything to disk (see loadScriptToFile for that).
export function loadScript(inputPath, slugOverride) {
  const ext = extname(inputPath).toLowerCase();
  const raw = readFileSync(resolve(inputPath), "utf8");

  if (ext === ".json") {
    const data = JSON.parse(raw);
    if (!data.slug && !slugOverride) {
      throw new Error('Script JSON butuh field "slug" (atau kasih slug lewat argumen).');
    }
    if (!Array.isArray(data.scenes) || data.scenes.length === 0) {
      throw new Error('Script JSON butuh array "scenes" dengan minimal 1 scene.');
    }
    return {
      slug: slugOverride || data.slug,
      beats: beatsFromScenes(data.scenes),
      // Optional { headline, karyaPose } override for the thumbnail (see
      // Thumbnail.tsx) -- generate.js falls back to deriving one from the
      // first scene's text when this is absent.
      thumbnail: data.thumbnail || null,
      // Optional { text, karyaPose? } outro card appended after the last
      // spoken beat (~1.5s, not narrated): handle + closing line so the
      // reel doesn't hard-stop the instant the CTA sentence ends.
      endCard: data.endCard || null,
    };
  }

  const slug = slugOverride || basename(inputPath, ext);
  return { slug, beats: beatsFromText(raw), thumbnail: null, endCard: null };
}

export function loadScriptToFile(inputPath, slugOverride) {
  const { slug, beats, thumbnail, endCard } = loadScript(inputPath, slugOverride);
  mkdirSync(resolve("remotion/public/timelines"), { recursive: true });
  const outPath = resolve("remotion/public/timelines", `${slug}.beats.json`);
  writeFileSync(outPath, JSON.stringify({ slug, beats, thumbnail, endCard }, null, 2));
  return { slug, beats, thumbnail, endCard, outPath };
}
