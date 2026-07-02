import { Img, OffthreadVideo, useCurrentFrame, useVideoConfig } from "remotion";
import { resolveSrc } from "../resolveSrc";

export type KaryaAsset =
  | { type: "video"; src: string }
  | { type: "frames"; frames: string[]; fps: number };

// Positioned at the bottom-right corner. "frames" mode picks the pose frame
// deterministically from the current composition frame -- this is why PNG
// frame sequences are preferred over animated GIFs here: a GIF's own
// playback clock doesn't line up with Remotion's per-frame render clock, so
// its animation phase would drift/judder in the final render.
export const KaryaOverlay: React.FC<{ asset: KaryaAsset | null }> = ({ asset }) => {
  const frame = useCurrentFrame();
  const { fps: compositionFps } = useVideoConfig();

  if (!asset) return null;

  const body =
    asset.type === "video" ? (
      <OffthreadVideo src={resolveSrc(asset.src)} loop muted style={{ width: "100%" }} />
    ) : (
      <Img
        src={resolveSrc(
          asset.frames[Math.floor((frame * asset.fps) / compositionFps) % asset.frames.length]
        )}
        style={{ width: "100%" }}
      />
    );

  return <div style={{ position: "absolute", right: 16, bottom: 340, width: 300 }}>{body}</div>;
};
