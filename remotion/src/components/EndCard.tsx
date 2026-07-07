import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { loadFont as loadJakarta } from "@remotion/google-fonts/PlusJakartaSans";
import { loadFont as loadMono } from "@remotion/google-fonts/SpaceMono";
import { BRAND } from "../brand";
import { KaryaOverlay, KaryaAsset } from "./KaryaOverlay";
import { MotionAccents } from "./MotionAccents";

const { fontFamily: jakarta } = loadJakarta();
const { fontFamily: mono } = loadMono();

// Un-narrated ~1.5s outro: brand handle + one closing line over the deep
// teal, so the reel lands on a branded frame instead of hard-stopping the
// moment the CTA sentence ends (also the frame Instagram tends to freeze
// on when the reel loops/ends).
export const EndCard: React.FC<{ text: string; karya: KaryaAsset | null }> = ({ text, karya }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const drive = spring({ frame, fps, config: { damping: 16, stiffness: 130 } });
  const lineIn = interpolate(frame, [6, 14], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ backgroundColor: BRAND.colors.tealDeep }}>
      <MotionAccents />
      <AbsoluteFill
        style={{
          alignItems: "center",
          justifyContent: "center",
          padding: "0 10%",
          textAlign: "center",
        }}
      >
        <div
          style={{
            fontFamily: mono,
            fontWeight: 700,
            fontSize: "4.6vw",
            letterSpacing: 3,
            color: BRAND.colors.amber,
            transform: `scale(${interpolate(drive, [0, 1], [0.7, 1])})`,
            opacity: Math.min(1, drive * 2),
          }}
        >
          @pustaka.sukses
        </div>
        {text ? (
          <div
            style={{
              fontFamily: jakarta,
              fontWeight: 700,
              fontSize: "3.6vw",
              color: BRAND.colors.cream,
              marginTop: "1.1em",
              opacity: lineIn * 0.92,
              transform: `translateY(${interpolate(lineIn, [0, 1], [12, 0])}px)`,
            }}
          >
            {text}
          </div>
        ) : null}
      </AbsoluteFill>
      <KaryaOverlay asset={karya} />
    </AbsoluteFill>
  );
};
