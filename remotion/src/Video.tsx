import {
  AbsoluteFill,
  Audio,
  OffthreadVideo,
  Sequence,
  interpolate,
  useCurrentFrame,
} from "remotion";
import { Caption, CaptionWord } from "./components/Caption";
import { Statement } from "./components/Statement";
import { StatCard, StatData } from "./components/StatCard";
import { KaryaOverlay, KaryaAsset } from "./components/KaryaOverlay";
import { GrainOverlay } from "./components/GrainOverlay";
import { Badge } from "./components/Badge";
import { TitleCard } from "./components/TitleCard";
import { BRAND } from "./brand";
import { resolveSrc } from "./resolveSrc";

const WIPE_FRAMES = 12;

// Circular "punch hole" reveal on every cut -- inspired by an Envato punch
// hole transition pack the user downloaded (its actual asset is an AE/FCP
// project, unusable without those apps installed here, so this recreates
// the effect procedurally: a growing clip-path circle, resolution
// independent and tunable). 100vmax comfortably covers both 9:16 and 4:5
// corners well before the wipe finishes.
const WipeReveal: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const frame = useCurrentFrame();
  const radius = interpolate(frame, [0, WIPE_FRAMES], [0, 100], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return (
    <AbsoluteFill style={{ clipPath: `circle(${radius}vmax at 50% 50%)` }}>{children}</AbsoluteFill>
  );
};

export type RenderBeat = {
  index: number;
  text: string;
  words: CaptionWord[];
  startFrame: number;
  durationFrames: number;
  broll: string | null;
  karya: KaryaAsset | null;
  badge: string | null;
  title: boolean;
  style: "statement" | null;
  stat: StatData | null;
};

export type RenderTimeline = {
  slug: string;
  fps: number;
  width: number;
  height: number;
  audioSrc: string | null;
  musicSrc?: string | null;
  durationFrames: number;
  beats: RenderBeat[];
  grainFrames: string[];
};

// B-roll never sits still: a quick punch-in settle right after the cut
// (reads as an editor's cut, not a template) on top of a slow Ken Burns
// drift whose direction alternates per beat so back-to-back shots don't
// all breathe the same way. "dim" treatment (statement/stat beats) pushes
// the footage back with brightness+blur so the typography is the star --
// the extra base scale hides the blurred edges.
const BrollBackground: React.FC<{
  src: string;
  durationInFrames: number;
  beatIndex: number;
  dim?: boolean;
}> = ({ src, durationInFrames, beatIndex, dim }) => {
  const frame = useCurrentFrame();
  const punch = interpolate(frame, [0, 9], [1.14, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const drift =
    beatIndex % 2 === 0
      ? interpolate(frame, [0, durationInFrames], [1, 1.08])
      : interpolate(frame, [0, durationInFrames], [1.08, 1]);
  const base = dim ? 1.06 : 1;
  return (
    <AbsoluteFill style={{ overflow: "hidden", backgroundColor: BRAND.colors.ink }}>
      <OffthreadVideo
        src={resolveSrc(src)}
        muted
        delayRenderTimeoutInMilliseconds={30000}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          transform: `scale(${punch * drift * base})`,
          filter: dim ? "brightness(0.38) blur(4px) saturate(0.85)" : undefined,
        }}
      />
    </AbsoluteFill>
  );
};

// Subtle darkened corners over everything -- lifts perceived production
// value and guarantees cream/amber text contrast at the edges.
const Vignette: React.FC = () => (
  <AbsoluteFill
    style={{
      pointerEvents: "none",
      background:
        "radial-gradient(ellipse at 50% 45%, rgba(22,32,28,0) 55%, rgba(22,32,28,0.42) 100%)",
    }}
  />
);

const BeatContent: React.FC<{ beat: RenderBeat }> = ({ beat }) => {
  if (beat.title) {
    return (
      <WipeReveal>
        <TitleCard text={beat.text} durationInFrames={beat.durationFrames} />
      </WipeReveal>
    );
  }

  const dim = beat.style === "statement" || Boolean(beat.stat);

  return (
    <WipeReveal>
      {beat.broll ? (
        <BrollBackground
          src={beat.broll}
          durationInFrames={beat.durationFrames}
          beatIndex={beat.index}
          dim={dim}
        />
      ) : (
        <AbsoluteFill style={{ backgroundColor: BRAND.colors.tealDeep }} />
      )}
      {!dim ? (
        <AbsoluteFill
          style={{
            background:
              "linear-gradient(to bottom, rgba(22,32,28,0) 55%, rgba(22,32,28,0.78) 100%)",
          }}
        />
      ) : null}
      <KaryaOverlay asset={beat.karya} />
      {beat.badge ? <Badge label={beat.badge} /> : null}
      {beat.stat ? (
        <StatCard stat={beat.stat} durationInFrames={beat.durationFrames} />
      ) : beat.style === "statement" ? (
        <Statement words={beat.words} durationInFrames={beat.durationFrames} />
      ) : (
        <Caption words={beat.words} durationInFrames={beat.durationFrames} />
      )}
    </WipeReveal>
  );
};

const ProgressBar: React.FC<{ durationFrames: number }> = ({ durationFrames }) => {
  const frame = useCurrentFrame();
  const progress = Math.min(1, frame / durationFrames);
  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        height: 6,
        backgroundColor: "rgba(255,255,255,0.18)",
      }}
    >
      <div
        style={{ width: `${progress * 100}%`, height: "100%", backgroundColor: BRAND.colors.amber }}
      />
    </div>
  );
};

const MUSIC_VOLUME = 0.09;

export const Video: React.FC<RenderTimeline> = ({
  audioSrc,
  musicSrc,
  beats,
  durationFrames,
  grainFrames,
}) => {
  return (
    <AbsoluteFill style={{ backgroundColor: BRAND.colors.ink }}>
      {beats.map((beat) => (
        <Sequence key={beat.index} from={beat.startFrame} durationInFrames={beat.durationFrames}>
          <BeatContent beat={beat} />
        </Sequence>
      ))}
      <Vignette />
      <GrainOverlay frames={grainFrames} />
      <ProgressBar durationFrames={durationFrames} />
      {audioSrc ? <Audio src={resolveSrc(audioSrc)} /> : null}
      {musicSrc ? (
        <Audio
          src={resolveSrc(musicSrc)}
          loop
          volume={(f) =>
            MUSIC_VOLUME *
            interpolate(f, [0, 15, durationFrames - 30, durationFrames], [0, 1, 1, 0], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            })
          }
        />
      ) : null}
    </AbsoluteFill>
  );
};
