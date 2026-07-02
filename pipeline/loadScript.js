import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve, basename, extname } from "node:path";
import { beatsFromText } from "./textToBeats.js";
import { extractKeywords } from "./stopwords.id.js";
import { toVisualQuery } from "./visualTerms.id-en.js";

function beatsFromScenes(scenes) {
  return scenes.map((scene, index) => {
    if (!scene.text) throw new Error(`scenes[${index}] butuh field "text"`);
    const keywords = extractKeywords(scene.text);
    return {
      index,
      text: scene.text,
      wordCount: scene.text.split(/\s+/).filter(Boolean).length,
      keywords,
      query: scene.visualQuery || toVisualQuery(keywords),
      karyaPose: scene.karyaPose || "idle",
      cta: Boolean(scene.cta),
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
    return { slug: slugOverride || data.slug, beats: beatsFromScenes(data.scenes) };
  }

  const slug = slugOverride || basename(inputPath, ext);
  return { slug, beats: beatsFromText(raw) };
}

export function loadScriptToFile(inputPath, slugOverride) {
  const { slug, beats } = loadScript(inputPath, slugOverride);
  mkdirSync(resolve("remotion/public/timelines"), { recursive: true });
  const outPath = resolve("remotion/public/timelines", `${slug}.beats.json`);
  writeFileSync(outPath, JSON.stringify({ slug, beats }, null, 2));
  return { slug, beats, outPath };
}
