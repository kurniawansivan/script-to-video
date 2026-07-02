import { AbsoluteFill, Audio, OffthreadVideo, Sequence, interpolate, useCurrentFrame } from "remotion";
import { Caption, CaptionWord } from "./components/Caption";
import { KaryaOverlay, KaryaAsset } from "./components/KaryaOverlay";
import { BRAND } from "./brand";
import { resolveSrc } from "./resolveSrc";

export type RenderBeat = {
  index: number;
  text: string;
  words: CaptionWord[];
  startFrame: number;
  durationFrames: number;
  broll: string | null;
  karya: KaryaAsset | null;
};

export type RenderTimeline = {
  slug: string;
  fps: number;
  width: number;
  height: number;
  audioSrc: string | null;
  durationFrames: number;
  beats: RenderBeat[];
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
  const frame = useCurrentFrame();
  // Quick punch-in on every beat cut -- a pattern-interrupt pulse so scene
  // changes read as deliberate cuts, not just content swaps.
  const punch = interpolate(frame, [0, 6], [1.06, 1], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ transform: `scale(${punch})` }}>
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
      <Caption words={beat.words} durationInFrames={beat.durationFrames} />
    </AbsoluteFill>
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

export const Video: React.FC<RenderTimeline> = ({ audioSrc, beats, durationFrames }) => {
  return (
    <AbsoluteFill style={{ backgroundColor: BRAND.colors.ink }}>
      {beats.map((beat) => (
        <Sequence key={beat.index} from={beat.startFrame} durationInFrames={beat.durationFrames}>
          <BeatContent beat={beat} />
        </Sequence>
      ))}
      <ProgressBar durationFrames={durationFrames} />
      {audioSrc ? <Audio src={resolveSrc(audioSrc)} /> : null}
    </AbsoluteFill>
  );
};
