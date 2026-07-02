import { extractKeywords } from "./stopwords.id.js";
import { toVisualQuery } from "./visualTerms.id-en.js";

export function splitIntoSentences(rawText) {
  const paragraphs = rawText
    .replace(/\r\n/g, "\n")
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);

  const sentences = [];
  for (const paragraph of paragraphs) {
    const matches = paragraph.replace(/\s+/g, " ").match(/[^.!?]+[.!?]*/g);
    if (!matches) continue;
    for (const raw of matches) {
      const text = raw.trim();
      if (text) sentences.push(text);
    }
  }
  return sentences;
}

// Free-text mode: beats + keywords + search query are all guessed. Good for
// a quick draft; for real production use the JSON scene format instead
// (see pipeline/script.example.json) where query/karyaPose are explicit.
export function beatsFromText(rawText) {
  return splitIntoSentences(rawText).map((text, index) => {
    const keywords = extractKeywords(text);
    return {
      index,
      text,
      wordCount: text.split(/\s+/).filter(Boolean).length,
      keywords,
      query: toVisualQuery(keywords),
      karyaPose: "idle",
      cta: false,
    };
  });
}
