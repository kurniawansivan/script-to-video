import { AbsoluteFill, Img, useCurrentFrame, useVideoConfig } from "remotion";
import { resolveSrc } from "../resolveSrc";

const GRAIN_FPS = 12;

// Subtle film-grain texture over the whole frame -- cycles through
// pre-rendered noise stills (see remotion/public/fx/grain) rather than a
// per-frame SVG filter, which is cheaper to render. Kept faint (not the
// heavy VHS look of the Raymond Chin reference) since Pustaka Sukses's
// brand is clean teal/amber, not gritty documentary.
//
// Frame paths come in via props (not hardcoded) and get rewritten to
// absolute static-server URLs by generate.js's pointRenderJsonAtServer,
// same as broll/karya/audio -- skipping that step reproduces the exact
// public-dir-copy race that broll hit early on (see staticServer.js).
export const GrainOverlay: React.FC<{ frames: string[] }> = ({ frames }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  if (!frames.length) return null;
  const src = frames[Math.floor((frame * GRAIN_FPS) / fps) % frames.length];

  return (
    <AbsoluteFill style={{ pointerEvents: "none", mixBlendMode: "overlay", opacity: 0.15 }}>
      <Img src={resolveSrc(src)} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
    </AbsoluteFill>
  );
};
