# Pustaka Sukses — Auto Generate

Tool otomasi buat rakit reel edukasi (@pustaka.sukses) dari script JSON (scene per scene): cari b-roll → voiceover → kinetic caption per-kata sinkron VO → Karya → render 9:16 + 4:5 + thumbnail. Render-nya lokal (Remotion + ffmpeg), gratis, jalan lewat terminal, **satu command** buat seluruh flow.

**Catatan model kerja:** langkah voiceover & b-roll custom (Higgsfield) butuh tool MCP yang cuma bisa dipanggil di sesi chat Claude — bukan CLI yang jalan sendiri tanpa Claude. Jadi alurnya: kamu kasih script ke Claude di chat → generate VO lewat Claude (atau upload rekaman asli) → jalanin satu command di bawah → keluar video jadi di `output/`.

## Prasyarat

- Node.js, ffmpeg, Python 3 (sudah ada di environment ini)
- `PEXELS_API_KEY` — daftar gratis di pexels.com/api, isi ke file `.env` (copy dari `.env.example`)
- `faster-whisper` — buat align VO ke timestamp kata. **Tidak perlu install manual**: `generate.js` otomatis bikin virtualenv `.venv/` dan install ke situ saat pertama kali dibutuhkan (Homebrew Python menolak `pip install` langsung ke sistem, jadi wajib lewat venv). Tanpa ini timing tetap jalan tapi kasar (estimasi word-count).

```
cp .env.example .env
# isi PEXELS_API_KEY=xxxxx di .env
npm install
```

## Struktur folder

```
pipeline/
  script.example.json       contoh format script JSON (scene per scene)
  generate.js                *** satu command orchestrator, jalanin ini ***
  loadScript.js               load script JSON/txt -> beats
  fetchBroll.js                cari & download b-roll Pexels per beat
  buildTimeline.js              gabung beats + timing + pose Karya -> render.json
  align.py                       whisper alignment (word-level timestamp)
  staticServer.js                 static server lokal buat serve asset ke render (lihat "Kenapa ada static server")
remotion/
  src/                       komposisi video (Video.tsx, Caption.tsx, KaryaOverlay.tsx, Thumbnail.tsx)
  public/
    timelines/               *.beats.json & *.render.json (di-generate tiap run, gitignored)
    broll-cache/<slug>/      hasil download Pexels per reel (gitignored)
    vo/                      file audio voiceover per reel (gitignored)
    karya/                   poses.json + pose-N/frame-0XX.png (aset Karya, di-commit)
output/                      hasil render final (.mp4, gitignored)
.venv/                       python venv buat faster-whisper (auto-dibuat, gitignored)
```

## Cara pakai — satu command

**1. Tulis script sebagai JSON, array scene** (lihat [pipeline/script.example.json](pipeline/script.example.json)):

```json
{
  "slug": "reel2",
  "scenes": [
    { "text": "Kalimat VO buat scene ini.", "visualQuery": "confident person office", "karyaPose": "greet" },
    { "text": "Kalimat berikutnya.", "karyaPose": "talking" },
    { "text": "Kalimat penutup, CTA.", "karyaPose": "celebrate", "cta": true }
  ]
}
```

Field per scene:
- `text` (wajib) — kalimat VO buat scene itu, jadi juga caption layar.
- `visualQuery` (opsional) — query pencarian b-roll manual. Kosongkan buat auto-translate dari `text` (ID→EN, terbatas, cek hasilnya).
- `karyaPose` (opsional) — nama pose Karya (`idle`, `greet`, `talking`, `point`, `celebrate`, dst — didefinisikan di `remotion/public/karya/poses.json`). Default `idle`.
- `cta` (opsional) — tandai scene CTA/penutup.
- `badge` (opsional) — label callout kecil pojok kiri atas, mis. `"TIPS"`, `"CONTOH"`, `"FAKTA"`. Render sebagai `[ TIPS ]` on-brand amber/ink.
- `title` (opsional, boolean) — jadiin scene ini chapter card: teks besar di tengah layar background gelap, tanpa b-roll/Karya, buat jeda/pergantian section. Tetap dinarasikan & diberi timing kayak scene biasa.
- `style: "statement"` (opsional) — teks kalimat jadi bintang: tipografi besar di tengah layar per-kata (gaya Raymond Chin), b-roll di-dim + blur di belakang. Caption bawah tidak dipakai. Buat hook & kalimat kunci.
- `stat` (opsional) — `{ "label": "...", "value": "Rp150–300rb", "note": "per paket" }`: kartu angka/harga besar di tengah (label Space Mono amber, value gede spring-pop). VO tetap ngucapin angkanya dalam kata; kartu ini yang dibaca penonton tanpa suara. B-roll otomatis di-dim.
- Marker `==kata==` di `text` (scene biasa maupun statement) — kata itu dirender dengan blok amber + teks ink (penekanan paling kuat, kayak blok warna di referensi). Marker di-strip dari VO/alignment, aman buat timing.

Jumlah scene bebas, tinggal nambah/kurangin elemen array.

Field opsional tambahan di level script (bukan per-scene):
- `thumbnail: { headline, karyaPose }` — teks besar + pose Karya buat thumbnail. Kosongkan biar auto-diambil dari kalimat scene pertama.

**2. Siapkan voiceover** — minta Claude generate TTS lewat Higgsfield di chat (**pakai `text2speech_v2` variant `minimax`**, bukan `seed_audio` — seed_audio kedengeran aksen asing buat Bahasa Indonesia, minimax jauh lebih natural, sudah dibandingin langsung), atau upload rekaman asli. Simpan ke `remotion/public/vo/<slug>.mp3` (nama file harus sama dengan `slug` di JSON).

**3. Jalankan satu command:**
```
node pipeline/generate.js path/ke/script.json
```
Ini otomatis: load script → fetch b-roll (Pexels) → align VO ke timestamp per-kata (whisper, auto-install kalau belum ada) → build timeline → render **9:16 dan 4:5** + thumbnail PNG masing-masing rasio → `output/<slug>-9x16.mp4`, `output/<slug>-4x5.mp4`, `output/<slug>-9x16-thumb.png`, `output/<slug>-4x5-thumb.png`.

Belum ada VO? Pakai `--draft` buat preview cepat (timing estimasi kasar dari jumlah kata, tanpa audio):
```
node pipeline/generate.js path/ke/script.json --draft
```

Opsi lain: `--slug nama` (override slug dari JSON), `--fps`, `--width`, `--height`, `--ratio 9:16` atau `--ratio 4:5` (default render dua-duanya, pakai ini kalau cuma butuh satu buat iterasi cepat).

**4. Preview interaktif (opsional)** — `npm run studio` buka Remotion Studio buat scrub timeline manual sebelum render final.

## Kenapa ada static server (`pipeline/staticServer.js`)

Ditemukan bug race-condition di `remotion render` bawaan: tiap render, dia nyalin folder `public/` ke folder temp, dan asset PERTAMA yang diminta (belum pernah dipakai sebelumnya) konsisten 404 karena diminta sebelum proses salin kelar — sudah diverifikasi lewat beberapa percobaan (tuker posisi file, delay start frame, path absolut, hasilnya selalu sama: siapapun file yang "pertama dipakai" gagal). `generate.js` jalanin static server sendiri buat folder `public/` dan render ambil asset dari situ, bukan dari mekanisme copy Remotion yang race. Kalau render manual langsung pakai `npx remotion render` (bukan lewat `generate.js`), bug ini bisa muncul lagi.

## Gaya editing (biar gak flat)

- **Kinetic caption per-kata** — tiap kata muncul (pop-in + scale) sesuai timestamp asli dari whisper alignment, bukan satu blok kalimat langsung nongol. Kata yang lagi diucapin di-highlight amber; kata ALLCAPS (AI, PANG, UMKM, dst) permanen amber; `==kata==` dapat blok amber penuh.
- **Statement & stat card** — lihat field `style`/`stat` di atas; b-roll di-dim (brightness 0.38 + blur) biar tipografi jadi bintang.
- **Punch-in tiap cut** — scale 1.14→1 settle 9 frame di awal beat, kombinasi sama Ken Burns arah selang-seling per beat (genap zoom-in 1→1.08, ganjil zoom-out 1.08→1) biar kerasa di-edit, bukan template.
- **Vignette** — sudut layar digelapin halus (radial gradient) di atas semua beat, nambah kontras teks di pinggir.
- **Circular wipe reveal per cut** — tiap beat baru "punch hole" masuk dari titik tengah (clip-path circle 0→100vmax dalam 12 frame), bukan sekadar potong-tempel. Terinspirasi pack Envato "punch hole transition" yang di-download user (aset aslinya project AE/FCP, gak bisa dipakai langsung karena Adobe After Effects/Final Cut Pro gak keinstall di environment ini — jadi efeknya dibikin ulang murni CSS, malah resolution-independent).
- **Film grain overlay** — tekstur noise halus (`mix-blend-mode: overlay`, opacity rendah) nempel di seluruh video, kesan lebih "dibikin", bukan raw footage. Generate ulang framenya: `ffmpeg -f lavfi -i "color=c=gray:s=540x960:d=1:r=10" -vf "format=gray,noise=alls=45:allf=t+u" -pix_fmt gray remotion/public/fx/grain/frame-%02d.png`.
- **Badge/tag & title card** — lihat field `badge`/`title` di atas.
- **Progress bar** amber tipis di atas, nunjukkin posisi nonton (dorongan buat nonton sampai habis).
- **Music bed (opsional)** — taruh file di `remotion/public/music/<slug>.mp3` (atau `music/default.mp3` buat semua reel), otomatis di-mix pelan (volume 0.09, fade in/out) di bawah VO. Higgsfield `generate_audio` gak bisa bikin musik (khusus speech), jadi file musiknya cari sendiri (mis. CapCut/Envato stock audio yang berlisensi).
- **Gradient overlay** di bawah layar buat kontras caption, bukan cuma text-shadow doang.

Semua logic ini ada di `remotion/src/Video.tsx` (BrollBackground, WipeReveal, BeatContent, ProgressBar) dan `remotion/src/components/` (Caption, Badge, TitleCard, GrainOverlay).

## Karya mascot — nambah/ganti pose

`remotion/public/karya/poses.json` memetakan nama pose (dipakai lewat `karyaPose` di script JSON) ke aset. Overlay-nya nempel di pojok kanan atas komposisi (`KaryaOverlay.tsx`), pakai unit % biar konsisten di 9:16 maupun 4:5.

Pose harus berupa **frame PNG terpisah**, bukan video/GIF langsung — h264/mp4 gak bisa nyimpen alpha channel, jadi convert GIF transparan ke mp4 bakal nampilin kotak putih nutupin latar (sudah kejadian, sudah diperbaiki). Kalau ada GIF baru dari Higgsfield/Canva, extract dulu jadi PNG per-frame (alpha ke-preserve):

```
ffmpeg -i karya-pose-baru.gif -vsync 0 -pix_fmt rgba remotion/public/karya/pose-baru/frame-%03d.png
```

Cek dulu frame rate asli GIF-nya (`ffprobe -select_streams v:0 -show_entries stream=avg_frame_rate karya-pose-baru.gif`) biar `fps` di `poses.json` sesuai. Baru daftarin:

```json
"nama-pose": { "type": "frames", "fps": 14, "frames": ["karya/pose-baru/frame-001.png", "..."] }
```

Pose yang sudah ada sekarang (dari 10 GIF gerak dasar): `idle`, `greet`, `point`, `celebrate`, `talking`, `think` — mapping ke file `pose-1` s/d `pose-10` masih **tebakan visual dari Claude, belum dikonfirmasi**. Cek [poses.json](remotion/public/karya/poses.json), betulkan kalau ada yang meleset. Pose `talking` masih pinjam gesture lain sebagai placeholder — 20 GIF "ngomong" (mulut gerak, buat sinkron VO) dari dokumen brand belum di-drop ke project ini.

## Contoh yang sudah dites

[pipeline/reel-2jul-pang.json](pipeline/reel-2jul-pang.json) — reel "Rumus PANG" (adaptasi dari kalender konten #13), full pipeline: TTS Higgsfield (minimax) → align whisper → b-roll Pexels → Karya per-scene → kinetic caption → render 9:16 + 4:5 + thumbnail. Hasil di `output/reel-2jul-pang-9x16.mp4`, `-4x5.mp4`, dan thumbnail `-9x16-thumb.png` / `-4x5-thumb.png`. Pakai ini sebagai referensi format kalau bikin script baru.

## Lain-lain

- **CapCut** tetap opsional buat polish akhir manual kalau perlu, tapi bukan bagian pipeline otomatis (CapCut gak punya API resmi).
- **`assets/` (gitignored)** — pack Envato yang di-download user (Motion Backgrounds, Motion Shapes, Punch Hole Transitions). Ini semua project file After Effects (`.aep`) / Final Cut Pro (`.motr`), preview mp4 yang ikut kebundle resolusinya kecil (300-500px), gak layak dipakai langsung. AE/FCP gak keinstall di environment ini jadi gak bisa di-render jadi video asli di sini. Kalau mau pakai isinya beneran: render manual di mesin yang ada AE/FCP-nya, taruh hasil mp4-nya di `remotion/public/`, baru saya sambungin ke pipeline. Buat asset motion graphic yang langsung kepake tanpa AE/FCP, cari di Envato Elements bagian **Stock Video** (bukan **Video Templates**) — itu file jadi, bukan project mentah.

## Aturan brand (wajib diikuti tiap generate)

- Teks layar presisi/manual (Gemini Omni & AI text rendering gak diandalkan) — sudah dihandle Remotion di sini.
- CTA satu aksi per reel, bukan dua.
- Tidak ada bukti/testimoni palsu.
- Warna: Teal `#0E6E5B`, Teal Deep `#0A4A3E`, Amber `#D79A2B`, Cream `#FBF8F1`, Ink `#16201C` — sudah di `remotion/src/brand.ts`.
