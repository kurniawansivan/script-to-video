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
export const KaryaOverlay: React.FC<{ asset: KaryaAsset | null; size?: "big" | null }> = ({
  asset,
  size,
}) => {
  const frame = useCurrentFrame();
  const { fps: compositionFps } = useVideoConfig();

  if (!asset) return null;

  const body =
    // Note: this OffthreadVideo does not loop -- Remotion's version here
    // has no `loop` prop on it, and wrapping in <Loop> needs a known
    // durationInFrames we don't have for arbitrary source clips. Prefer
    // "frames" (PNG sequence) poses in practice; this branch exists for
    // completeness if a pre-looped video asset is ever supplied directly.
    asset.type === "video" ? (
      <OffthreadVideo src={resolveSrc(asset.src)} muted style={{ width: "100%" }} />
    ) : (
      <Img
        src={resolveSrc(
          asset.frames[Math.floor((frame * asset.fps) / compositionFps) % asset.frames.length]
        )}
        style={{ width: "100%" }}
      />
    );

  // % units (not px) so this lands in the same relative spot whether we
  // render 9:16 or 4:5. Default: top-right corner accent. "big": Karya as
  // on-screen host, bottom-right at roughly double size (the content
  // calendar's "tampil besar" direction for trust-topic beats) -- bottom
  // so it never collides with Statement/StatCard text in the middle.
  if (size === "big") {
    return (
      <div style={{ position: "absolute", bottom: "9%", right: "5%", width: "48%" }}>{body}</div>
    );
  }
  return <div style={{ position: "absolute", top: "7%", right: "6%", width: "26%" }}>{body}</div>;
};
