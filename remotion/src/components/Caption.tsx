import { interpolate, useCurrentFrame } from "remotion";
import { loadFont } from "@remotion/google-fonts/PlusJakartaSans";
import { BRAND } from "../brand";

const { fontFamily } = loadFont();

export type CaptionWord = {
  text: string;
  startFrame: number;
  endFrame: number;
  // From ==word== markers in the script (parsed in buildTimeline.js):
  // rendered as an amber block behind the word, the strongest emphasis tier.
  highlight?: boolean;
};

// ALLCAPS words (AI, PANG, UMKM, DIBAYAR...) get permanent amber emphasis --
// matches the brand's existing script convention of capitalizing words for
// stress (see Pustaka_Sukses_Rangkuman_Proyek.pdf script examples).
const isEmphasis = (word: string) => {
  const stripped = word.replace(/[^A-Za-z]/g, "");
  return stripped.length > 1 && stripped === stripped.toUpperCase();
};

const Word: React.FC<{ word: CaptionWord }> = ({ word }) => {
  const frame = useCurrentFrame();
  const pop = interpolate(
    frame,
    [word.startFrame, word.startFrame + 4, word.startFrame + 9],
    [0.4, 1.18, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );
  const opacity = interpolate(frame, [word.startFrame, word.startFrame + 4], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const active = frame >= word.startFrame && frame < word.endFrame;
  const color = active || isEmphasis(word.text) ? BRAND.colors.amber : BRAND.colors.cream;

  if (word.highlight) {
    return (
      <span
        style={{
          display: "inline-block",
          opacity,
          transform: `scale(${pop}) rotate(-1.2deg)`,
          color: BRAND.colors.ink,
          backgroundColor: BRAND.colors.amber,
          padding: "0.02em 0.22em",
          marginRight: "0.28em",
          textShadow: "none",
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
        transform: `scale(${pop})`,
        color,
        marginRight: "0.28em",
      }}
    >
      {word.text}
    </span>
  );
};

// Karaoke-style kinetic caption: each word pops in and highlights amber as
// it's spoken (driven by word.startFrame/endFrame from whisper alignment,
// see buildTimeline.js), instead of the whole sentence appearing as one flat
// block. % positioning (not px) so this lands correctly in both 9:16 and 4:5.
export const Caption: React.FC<{ words: CaptionWord[]; durationInFrames: number }> = ({
  words,
  durationInFrames,
}) => {
  const frame = useCurrentFrame();
  const exit = interpolate(frame, [durationInFrames - 8, durationInFrames], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div style={{ position: "absolute", left: "7%", right: "7%", bottom: "16%", opacity: exit }}>
      <div
        style={{
          fontFamily,
          fontWeight: 800,
          fontSize: "5.2vw",
          lineHeight: 1.2,
          textShadow: `0 2px 0 ${BRAND.colors.ink}, 0 4px 18px rgba(0,0,0,0.55)`,
          textAlign: "center",
        }}
      >
        {words.map((w, i) => (
          <Word key={i} word={w} />
        ))}
      </div>
    </div>
  );
};
