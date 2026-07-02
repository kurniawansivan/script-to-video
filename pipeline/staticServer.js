import http from "node:http";
import { createReadStream, existsSync, statSync } from "node:fs";
import { extname, join, normalize } from "node:path";

// Remotion's own render command copies remotion/public into a fresh temp
// dir on every run and serves it via an internal dev server. Whichever
// asset gets requested first in a render consistently 404s there -- the
// copy hasn't caught up yet (reproduced repeatedly: swapping which file
// sits first, delaying its start frame, absolute paths -- always whichever
// asset is touched first fails, never a specific file). Serving our own
// static server for remotion/public and pointing beats at its http URLs
// sidesteps that copy step entirely.
const MIME = {
  ".mp4": "video/mp4",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".m4a": "audio/mp4",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".json": "application/json",
};

export function startStaticServer(rootDir) {
  const root = normalize(rootDir);
  const server = http.createServer((req, res) => {
    const urlPath = decodeURIComponent((req.url || "/").split("?")[0]);
    const filePath = normalize(join(root, urlPath));
    if (!filePath.startsWith(root) || !existsSync(filePath) || !statSync(filePath).isFile()) {
      res.writeHead(404);
      res.end("not found");
      return;
    }

    if (req.method === "HEAD") {
      const { size } = statSync(filePath);
      res.writeHead(200, {
        "Content-Type": MIME[extname(filePath)] || "application/octet-stream",
        "Content-Length": size,
        "Accept-Ranges": "bytes",
      });
      res.end();
      return;
    }

    const { size } = statSync(filePath);
    const contentType = MIME[extname(filePath)] || "application/octet-stream";
    const range = req.headers.range;

    // OffthreadVideo/ffmpeg seek into video files via byte-range requests
    // (needed for frame extraction) -- without 206 support the reader stalls
    // waiting for data that a plain 200 full-body response won't provide in
    // the shape it expects.
    if (range) {
      const match = /bytes=(\d*)-(\d*)/.exec(range);
      const start = match[1] ? parseInt(match[1], 10) : 0;
      const end = match[2] ? parseInt(match[2], 10) : size - 1;
      res.writeHead(206, {
        "Content-Type": contentType,
        "Content-Length": end - start + 1,
        "Content-Range": `bytes ${start}-${end}/${size}`,
        "Accept-Ranges": "bytes",
      });
      createReadStream(filePath, { start, end }).pipe(res);
      return;
    }

    res.writeHead(200, {
      "Content-Type": contentType,
      "Content-Length": size,
      "Accept-Ranges": "bytes",
    });
    createReadStream(filePath).pipe(res);
  });

  return new Promise((resolvePromise) => {
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      resolvePromise({ server, baseUrl: `http://127.0.0.1:${address.port}` });
    });
  });
}
