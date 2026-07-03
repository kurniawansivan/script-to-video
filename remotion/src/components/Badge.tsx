import { interpolate, useCurrentFrame } from "remotion";
import { loadFont } from "@remotion/google-fonts/SpaceMono";
import { BRAND } from "../brand";

const { fontFamily } = loadFont();

// Callout tag like "[TIPS]" / "[CONTOH]" / "[FAKTA]" -- same idea as the
// "[DISCLAIMER]" tag in the Raymond Chin reference, but on-brand colors
// (amber/ink) instead of introducing a red the brand palette doesn't have.
export const Badge: React.FC<{ label: string }> = ({ label }) => {
  const frame = useCurrentFrame();
  const pop = interpolate(frame, [0, 4, 8], [0.6, 1.08, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const opacity = interpolate(frame, [0, 6], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <div
      style={{
        position: "absolute",
        top: "16%",
        left: "7%",
        opacity,
        transform: `scale(${pop})`,
        transformOrigin: "left center",
      }}
    >
      <span
        style={{
          fontFamily,
          fontSize: "2.6vw",
          fontWeight: 700,
          letterSpacing: 2,
          color: BRAND.colors.ink,
          backgroundColor: BRAND.colors.amber,
          padding: "0.4em 0.8em",
          textTransform: "uppercase",
        }}
      >
        [ {label} ]
      </span>
    </div>
  );
};
