import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { loadFont as loadJakarta } from "@remotion/google-fonts/PlusJakartaSans";
import { loadFont as loadMono } from "@remotion/google-fonts/SpaceMono";
import { BRAND } from "../brand";

const { fontFamily: jakarta } = loadJakarta();
const { fontFamily: mono } = loadMono();

export type StatData = { label: string; value: string; note?: string | null };

// Big number/price callout beat: kicker label on top (Space Mono, amber),
// the value huge in the middle, optional unit note below. The VO narrates
// the number in words; this card is what a sound-off scroller actually
// reads, so the value gets the full-screen treatment (same role as the big
// red stat shots in the Raymond Chin reference, but on-brand amber/cream).
export const StatCard: React.FC<{ stat: StatData; durationInFrames: number }> = ({
  stat,
  durationInFrames,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const labelIn = interpolate(frame, [0, 8], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const valueDrive = spring({ frame: frame - 4, fps, config: { damping: 14, stiffness: 120 } });
  const valueScale = interpolate(valueDrive, [0, 1], [0.6, 1]);
  const noteIn = interpolate(frame, [12, 20], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const barWidth = interpolate(frame, [6, 18], [0, 100], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const exit = interpolate(frame, [durationInFrames - 8, durationInFrames], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "0 8%",
        opacity: exit,
        textAlign: "center",
      }}
    >
      <div
        style={{
          fontFamily: mono,
          fontSize: "3vw",
          fontWeight: 700,
          letterSpacing: 4,
          textTransform: "uppercase",
          color: BRAND.colors.ink,
          backgroundColor: BRAND.colors.amber,
          padding: "0.45em 1em",
          opacity: labelIn,
          transform: `translateY(${interpolate(labelIn, [0, 1], [14, 0])}px)`,
        }}
      >
        {stat.label}
      </div>

      <div
        style={{
          fontFamily: jakarta,
          fontWeight: 800,
          fontSize: "12vw",
          lineHeight: 1.1,
          color: BRAND.colors.cream,
          marginTop: "0.35em",
          transform: `scale(${valueScale})`,
          opacity: Math.min(1, valueDrive * 2),
          textShadow: `0 4px 0 ${BRAND.colors.ink}, 0 10px 40px rgba(0,0,0,0.55)`,
        }}
      >
        {stat.value}
      </div>

      <div
        style={{
          width: `${barWidth * 0.28}%`,
          height: "0.5vw",
          backgroundColor: BRAND.colors.amber,
          marginTop: "0.9em",
        }}
      />

      {stat.note ? (
        <div
          style={{
            fontFamily: mono,
            fontSize: "2.8vw",
            color: BRAND.colors.cream,
            opacity: noteIn * 0.85,
            marginTop: "1em",
            letterSpacing: 2,
          }}
        >
          {stat.note}
        </div>
      ) : null}
    </div>
  );
};
