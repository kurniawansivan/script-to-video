import { AbsoluteFill, Audio, OffthreadVideo, Sequence } from "remotion";
import { Caption } from "./components/Caption";
import { KaryaOverlay, KaryaAsset } from "./components/KaryaOverlay";
import { BRAND } from "./brand";
import { resolveSrc } from "./resolveSrc";

export type RenderBeat = {
  index: number;
  text: string;
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

export const Video: React.FC<RenderTimeline> = ({ audioSrc, beats }) => {
  return (
    <AbsoluteFill style={{ backgroundColor: BRAND.colors.ink }}>
      {beats.map((beat) => (
        <Sequence key={beat.index} from={beat.startFrame} durationInFrames={beat.durationFrames}>
          {beat.broll ? (
            <OffthreadVideo
              src={resolveSrc(beat.broll)}
              muted
              delayRenderTimeoutInMilliseconds={30000}
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          ) : (
            <AbsoluteFill style={{ backgroundColor: BRAND.colors.tealDeep }} />
          )}
          <KaryaOverlay asset={beat.karya} />
          <Caption text={beat.text} durationInFrames={beat.durationFrames} />
        </Sequence>
      ))}
      {audioSrc ? <Audio src={resolveSrc(audioSrc)} /> : null}
    </AbsoluteFill>
  );
};
