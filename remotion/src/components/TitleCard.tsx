import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { loadFont } from "@remotion/google-fonts/PlusJakartaSans";
import { BRAND } from "../brand";

const { fontFamily } = loadFont();

// Chapter break / rhetorical-question card -- a beat of its own (still
// spoken/timed like any other), used to punctuate section changes instead
// of jumping straight from one topic's b-roll into the next. Matches the
// "Kita harus gimana?" pattern from the Raymond Chin reference: big
// centered statement, dark background, no b-roll competing for attention.
export const TitleCard: React.FC<{ text: string; durationInFrames: number }> = ({
  text,
  durationInFrames,
}) => {
  const frame = useCurrentFrame();
  const enter = interpolate(frame, [0, 12], [0, 1], { extrapolateRight: "clamp" });
  const exit = interpolate(frame, [durationInFrames - 10, durationInFrames], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const opacity = Math.min(enter, exit);
  const scale = interpolate(enter, [0, 1], [0.92, 1]);

  return (
    <AbsoluteFill
      style={{
        backgroundColor: BRAND.colors.ink,
        alignItems: "center",
        justifyContent: "center",
        padding: "0 10%",
      }}
    >
      <div
        style={{
          opacity,
          transform: `scale(${scale})`,
          fontFamily,
          fontWeight: 800,
          fontSize: "6.5vw",
          lineHeight: 1.25,
          color: BRAND.colors.cream,
          textAlign: "center",
        }}
      >
        {text}
      </div>
    </AbsoluteFill>
  );
};
