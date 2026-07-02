import { staticFile } from "remotion";

// http(s) URLs (from our own static server, see pipeline/staticServer.js)
// are passed straight through; anything else is resolved against
// remotion/public via staticFile() -- used for interactive `remotion studio`
// preview where our static server isn't running.
export const resolveSrc = (path: string) => (/^https?:\/\//.test(path) ? path : staticFile(path));
