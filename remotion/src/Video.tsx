import { AbsoluteFill, Audio, OffthreadVideo, Sequence, interpolate, useCurrentFrame } from "remotion";
import { Caption, CaptionWord } from "./components/Caption";
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
};

export type RenderTimeline = {
  slug: string;
  fps: number;
  width: number;
  height: number;
  audioSrc: string | null;
  durationFrames: number;
  beats: RenderBeat[];
  grainFrames: string[];
};

// Slow constant zoom on b-roll so nothing on screen is ever fully static --
// a static frame is what makes a talking-points reel feel flat.
const BrollBackground: React.FC<{ src: string; durationInFrames: number }> = ({
  src,
  durationInFrames,
}) => {
  const frame = useCurrentFrame();
  const scale = interpolate(frame, [0, durationInFrames], [1, 1.08]);
  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      <OffthreadVideo
        src={resolveSrc(src)}
        muted
        delayRenderTimeoutInMilliseconds={30000}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          transform: `scale(${scale})`,
        }}
      />
    </AbsoluteFill>
  );
};

const BeatContent: React.FC<{ beat: RenderBeat }> = ({ beat }) => {
  if (beat.title) {
    return (
      <WipeReveal>
        <TitleCard text={beat.text} durationInFrames={beat.durationFrames} />
      </WipeReveal>
    );
  }

  return (
    <WipeReveal>
      {beat.broll ? (
        <BrollBackground src={beat.broll} durationInFrames={beat.durationFrames} />
      ) : (
        <AbsoluteFill style={{ backgroundColor: BRAND.colors.tealDeep }} />
      )}
      <AbsoluteFill
        style={{
          background:
            "linear-gradient(to bottom, rgba(22,32,28,0) 55%, rgba(22,32,28,0.78) 100%)",
        }}
      />
      <KaryaOverlay asset={beat.karya} />
      {beat.badge ? <Badge label={beat.badge} /> : null}
      <Caption words={beat.words} durationInFrames={beat.durationFrames} />
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

export const Video: React.FC<RenderTimeline> = ({ audioSrc, beats, durationFrames, grainFrames }) => {
  return (
    <AbsoluteFill style={{ backgroundColor: BRAND.colors.ink }}>
      {beats.map((beat) => (
        <Sequence key={beat.index} from={beat.startFrame} durationInFrames={beat.durationFrames}>
          <BeatContent beat={beat} />
        </Sequence>
      ))}
      <GrainOverlay frames={grainFrames} />
      <ProgressBar durationFrames={durationFrames} />
      {audioSrc ? <Audio src={resolveSrc(audioSrc)} /> : null}
    </AbsoluteFill>
  );
};
