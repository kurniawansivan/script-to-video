import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { loadFont } from "@remotion/google-fonts/PlusJakartaSans";
import { BRAND } from "../brand";
import { CaptionWord } from "./Caption";

const { fontFamily } = loadFont();

const isEmphasis = (word: string) => {
  const stripped = word.replace(/[^A-Za-z]/g, "");
  return stripped.length > 1 && stripped === stripped.toUpperCase();
};

const StatementWord: React.FC<{ word: CaptionWord }> = ({ word }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const drive = spring({
    frame: frame - word.startFrame,
    fps,
    config: { damping: 200, stiffness: 260 },
  });
  const opacity = interpolate(frame, [word.startFrame, word.startFrame + 3], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const scale = interpolate(drive, [0, 1], [0.75, 1]);
  const active = frame >= word.startFrame && frame < word.endFrame;

  if (word.highlight) {
    return (
      <span
        style={{
          display: "inline-block",
          opacity,
          transform: `scale(${scale}) rotate(-1.5deg)`,
          color: BRAND.colors.ink,
          backgroundColor: BRAND.colors.amber,
          padding: "0.02em 0.24em",
          margin: "0.06em 0.16em",
          boxShadow: "0 6px 24px rgba(0,0,0,0.35)",
        }}
      >
        {word.text}
      </span>
    );
  }

  return (
    <span
      style={{
        display: "inline-block",
        opacity,
        transform: `scale(${scale})`,
        color: active || isEmphasis(word.text) ? BRAND.colors.amber : BRAND.colors.cream,
        margin: "0.06em 0.16em",
      }}
    >
      {word.text}
    </span>
  );
};

// Big-typography statement beat (the Raymond Chin look): the sentence IS the
// visual, centered mid-screen over a heavily dimmed b-roll, one word at a
// time on its spoken timestamp. Highlighted words (==word== in the script)
// sit in an amber block; everything else pops in cream.
export const Statement: React.FC<{ words: CaptionWord[]; durationInFrames: number }> = ({
  words,
  durationInFrames,
}) => {
  const frame = useCurrentFrame();
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
        alignItems: "center",
        justifyContent: "center",
        padding: "0 6%",
        opacity: exit,
      }}
    >
      <div
        style={{
          fontFamily,
          fontWeight: 800,
          fontSize: "8vw",
          lineHeight: 1.28,
          textAlign: "center",
          textShadow: `0 2px 0 ${BRAND.colors.ink}, 0 6px 26px rgba(0,0,0,0.6)`,
        }}
      >
        {words.map((w, i) => (
          <StatementWord key={i} word={w} />
        ))}
      </div>
    </div>
  );
};
