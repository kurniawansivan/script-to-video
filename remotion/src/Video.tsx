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
import { MotionAccents } from "./components/MotionAccents";
import { KaryaOverlay, KaryaAsset } from "./components/KaryaOverlay";
import { GrainOverlay } from "./components/GrainOverlay";
import { Badge } from "./components/Badge";
import { TitleCard } from "./components/TitleCard";
import { EndCard } from "./components/EndCard";
import { BRAND } from "./brand";
import { resolveSrc } from "./resolveSrc";

const WIPE_FRAMES = 12;

// CSS fallback wipe: a growing clip-path circle. Used only when no real
// transition assets exist in public/fx/transitions (see MatteWipe below).
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

// The real Envato punch-hole transition: 4K fill + luma matte from the
// pack's FCP Media folders, pre-merged into a 1080x1920 alpha-channel webm
// by ffmpeg (alphamerge) -- see README. The clip starts fully opaque
// (crumpled-paper texture with an amber light leak) and a circular hole
// grows until the frame is clear, so overlaying it at the start of each
// beat hides the hard cut and "punches" the new shot in. The webms are
// trimmed at encode time (first ~0.4s of the source is a fully-opaque
// hold before the hole starts moving -- dead cover that ate the sentence's
// first words) so the clip is ~0.83s of pure hole-opening action; played
// at 1.5x it fits inside the 0.4s pre-word lead buildTimeline gives each
// cut: mostly clear right as the first caption word lands.
const MATTE_WIPE_RATE = 1.5;
const MATTE_WIPE_FRAMES = Math.ceil((0.834 * 30) / MATTE_WIPE_RATE);

const MatteWipe: React.FC<{ src: string }> = ({ src }) => {
  return (
    <Sequence from={0} durationInFrames={MATTE_WIPE_FRAMES} layout="none">
      <AbsoluteFill style={{ pointerEvents: "none" }}>
        <OffthreadVideo
          src={resolveSrc(src)}
          muted
          transparent
          playbackRate={MATTE_WIPE_RATE}
          delayRenderTimeoutInMilliseconds={30000}
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      </AbsoluteFill>
    </Sequence>
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
  karyaSize?: "big" | null;
  badge: string | null;
  title: boolean;
  style: "statement" | null;
  stat: StatData | null;
  endCard?: boolean;
};

export type RenderTimeline = {
  slug: string;
  fps: number;
  width: number;
  height: number;
  audioSrc: string | null;
  musicSrc?: string | null;
  whooshSrcs?: string[];
  durationFrames: number;
  beats: RenderBeat[];
  grainFrames: string[];
  transitionSrcs?: string[];
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
  // Uniform grade so back-to-back Pexels clips (mixed color temperatures,
  // exposure) read as one edited piece instead of a stock-footage collage:
  // slight desaturate + contrast on everything, plus the soft-light teal
  // wash applied globally in Video. Dim variant stays readable (a heavier
  // brightness cut turned statement backgrounds into black mush).
  const grade = dim
    ? "brightness(0.5) blur(2.5px) saturate(0.8) contrast(1.05)"
    : "contrast(1.06) saturate(0.88) brightness(0.97)";
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
          filter: grade,
        }}
      />
    </AbsoluteFill>
  );
};

// Global color wash (teal shadows, warm-neutral highlights untouched) --
// the poor man's LUT that makes mixed stock footage feel graded as one.
const GradeWash: React.FC = () => (
  <AbsoluteFill
    style={{
      pointerEvents: "none",
      background: `linear-gradient(180deg, ${BRAND.colors.teal}30 0%, ${BRAND.colors.tealDeep}44 100%)`,
      mixBlendMode: "soft-light",
    }}
  />
);

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

// When a real matte transition asset is available it plays on top of the
// beat's first frames (content fully rendered underneath, hard cut hidden
// by the opaque paper frame) -- the CSS WipeReveal is only the fallback
// for when public/fx/transitions is empty.
const BeatContent: React.FC<{ beat: RenderBeat; transitionSrc: string | null }> = ({
  beat,
  transitionSrc,
}) => {
  const Shell: React.FC<{ children: React.ReactNode }> = transitionSrc
    ? ({ children }) => (
        <AbsoluteFill>
          {children}
          <MatteWipe src={transitionSrc} />
        </AbsoluteFill>
      )
    : beat.index === 0
      ? AbsoluteFill
      : WipeReveal;

  if (beat.endCard) {
    return (
      <Shell>
        <EndCard text={beat.text} karya={beat.karya} />
      </Shell>
    );
  }

  if (beat.title) {
    return (
      <Shell>
        <MotionAccents />
        <TitleCard text={beat.text} durationInFrames={beat.durationFrames} />
      </Shell>
    );
  }

  const dim = beat.style === "statement" || Boolean(beat.stat);

  return (
    <Shell>
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
      ) : (
        <MotionAccents />
      )}
      <KaryaOverlay asset={beat.karya} size={beat.karyaSize} />
      {beat.badge ? <Badge label={beat.badge} /> : null}
      {beat.stat ? (
        <StatCard stat={beat.stat} durationInFrames={beat.durationFrames} />
      ) : beat.style === "statement" ? (
        <Statement words={beat.words} durationInFrames={beat.durationFrames} />
      ) : (
        <Caption words={beat.words} durationInFrames={beat.durationFrames} />
      )}
    </Shell>
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

const WHOOSH_VOLUME = 0.4;

export const Video: React.FC<RenderTimeline> = ({
  audioSrc,
  musicSrc,
  whooshSrcs,
  beats,
  durationFrames,
  grainFrames,
  transitionSrcs,
}) => {
  // Beat 0 gets neither transition nor whoosh: the first frames are the
  // hook, and opening on 0.4s of paper texture kills the 3-second
  // retention window. Cuts after that cycle through the transition and
  // whoosh variants so no two consecutive cuts sound/look identical.
  const transitionFor = (index: number) =>
    index > 0 && transitionSrcs && transitionSrcs.length > 0
      ? transitionSrcs[(index - 1) % transitionSrcs.length]
      : null;
  const whooshFor = (index: number) =>
    index > 0 && whooshSrcs && whooshSrcs.length > 0
      ? whooshSrcs[(index - 1) % whooshSrcs.length]
      : null;

  return (
    <AbsoluteFill style={{ backgroundColor: BRAND.colors.ink }}>
      {beats.map((beat) => {
        const whoosh = whooshFor(beat.index);
        return (
          <Sequence key={beat.index} from={beat.startFrame} durationInFrames={beat.durationFrames}>
            <BeatContent beat={beat} transitionSrc={transitionFor(beat.index)} />
            {whoosh ? <Audio src={resolveSrc(whoosh)} volume={WHOOSH_VOLUME} /> : null}
          </Sequence>
        );
      })}
      <GradeWash />
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
