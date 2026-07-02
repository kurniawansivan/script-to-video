import "dotenv/config";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";

const PEXELS_API_KEY = process.env.PEXELS_API_KEY;

function pickVideoFile(video) {
  // Brand note: HD not 4K, keep files under ~1GB, 9:16 portrait.
  const portrait = video.video_files.filter((f) => f.height > f.width);
  const candidates = portrait.length ? portrait : video.video_files;
  const hd = candidates.filter((f) => f.width >= 720 && f.width <= 1080);
  const pool = hd.length ? hd : candidates;
  return pool.sort((a, b) => b.width - a.width)[0];
}

async function searchPexels(query, perPage = 5) {
  const url = `https://api.pexels.com/videos/search?query=${encodeURIComponent(query)}&orientation=portrait&per_page=${perPage}`;
  const res = await fetch(url, { headers: { Authorization: PEXELS_API_KEY } });
  if (!res.ok) {
    throw new Error(`Pexels search gagal (${res.status}): ${await res.text()}`);
  }
  return res.json();
}

async function downloadTo(url, destPath) {
  const res = await fetch(url);
  if (!res.ok || !res.body) {
    throw new Error(`Download gagal (${res.status}): ${url}`);
  }
  await pipeline(Readable.fromWeb(res.body), (await import("node:fs")).createWriteStream(destPath));
}

async function main() {
  const [, , slugArg] = process.argv;
  if (!slugArg) {
    console.error("Pakai: node pipeline/fetchBroll.js <slug>");
    process.exit(1);
  }
  if (!PEXELS_API_KEY) {
    console.error("PEXELS_API_KEY kosong. Isi dulu di .env (lihat .env.example).");
    process.exit(1);
  }

  const beatsPath = resolve("remotion/public/timelines", `${slugArg}.beats.json`);
  const { slug, beats } = JSON.parse(readFileSync(beatsPath, "utf8"));

  // relBrollDir/destPath: broll is stored under remotion/public so Remotion's
  // staticFile() can address it by the relative path alone (relBroll).
  const relBrollDir = `broll-cache/${slug}`;
  const cacheDir = resolve("remotion/public", relBrollDir);
  mkdirSync(cacheDir, { recursive: true });

  for (const beat of beats) {
    const query = beat.query || beat.keywords.join(" ");
    const hash = createHash("sha1").update(query).digest("hex").slice(0, 10);
    const fileName = `beat-${beat.index}-${hash}.mp4`;
    const destPath = resolve(cacheDir, fileName);
    const relBroll = `${relBrollDir}/${fileName}`;

    if (existsSync(destPath)) {
      console.log(`beat ${beat.index}: cache hit -> ${relBroll}`);
      beat.broll = relBroll;
      continue;
    }

    console.log(`beat ${beat.index}: cari "${query}"`);
    const results = await searchPexels(query);
    if (!results.videos?.length) {
      console.warn(`  tidak ada hasil buat "${query}" -- beat ini butuh query manual atau b-roll custom (Higgsfield)`);
      beat.broll = null;
      continue;
    }

    const file = pickVideoFile(results.videos[0]);
    if (!file) {
      console.warn(`  tidak ada file video cocok buat "${query}"`);
      beat.broll = null;
      continue;
    }

    await downloadTo(file.link, destPath);
    console.log(`  -> ${relBroll} (${file.width}x${file.height})`);
    beat.broll = relBroll;
  }

  writeFileSync(beatsPath, JSON.stringify({ slug, beats }, null, 2));
  console.log(`Selesai. Beat tanpa broll perlu diisi manual sebelum render.`);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
