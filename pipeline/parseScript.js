import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve, basename, extname } from "node:path";
import { beatsFromText } from "./textToBeats.js";

function readStdin() {
  const chunks = [];
  process.stdin.setEncoding("utf8");
  return new Promise((res) => {
    process.stdin.on("data", (c) => chunks.push(c));
    process.stdin.on("end", () => res(chunks.join("")));
  });
}

async function main() {
  const [, , inputArg, slugArg] = process.argv;
  const rawText = inputArg ? readFileSync(resolve(inputArg), "utf8") : await readStdin();

  if (!rawText.trim()) {
    console.error("Script kosong. Kasih file: node pipeline/parseScript.js script.txt [slug]");
    process.exit(1);
  }

  const slug = slugArg || (inputArg ? basename(inputArg, extname(inputArg)) : `script-${Date.now()}`);
  const beats = beatsFromText(rawText);

  mkdirSync(resolve("remotion/public/timelines"), { recursive: true });
  const outPath = resolve("remotion/public/timelines", `${slug}.beats.json`);
  writeFileSync(outPath, JSON.stringify({ slug, beats }, null, 2));

  console.log(`${beats.length} beat -> ${outPath}`);
}

main();
