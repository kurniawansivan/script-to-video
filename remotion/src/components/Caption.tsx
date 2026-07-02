import { interpolate, useCurrentFrame } from "remotion";
import { loadFont } from "@remotion/google-fonts/PlusJakartaSans";
import { BRAND } from "../brand";

const { fontFamily } = loadFont();

export const Caption: React.FC<{ text: string; durationInFrames: number }> = ({
  text,
  durationInFrames,
}) => {
  const frame = useCurrentFrame();
  const enter = interpolate(frame, [0, 8], [0, 1], { extrapolateRight: "clamp" });
  const exit = interpolate(
    frame,
    [durationInFrames - 8, durationInFrames],
    [1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );
  const opacity = Math.min(enter, exit);
  const translateY = interpolate(enter, [0, 1], [24, 0]);

  return (
    <div
      style={{
        position: "absolute",
        left: 60,
        right: 60,
        bottom: 220,
        opacity,
        transform: `translateY(${translateY}px)`,
      }}
    >
      <div
        style={{
          fontFamily,
          fontWeight: 800,
          fontSize: 56,
          lineHeight: 1.15,
          color: BRAND.colors.cream,
          textShadow: `0 2px 0 ${BRAND.colors.ink}, 0 4px 18px rgba(0,0,0,0.55)`,
          textAlign: "center",
        }}
      >
        {text}
      </div>
    </div>
  );
};
