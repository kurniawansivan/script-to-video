import { Composition } from "remotion";
import { Video, RenderTimeline } from "./Video";

// Timeline data is passed in wholesale via --props=<path-to-render.json>
// (Remotion's CLI accepts a JSON file path there, not just inline JSON) --
// no fs reads inside the bundle, so nothing browser/Node scheme issues.
const emptyTimeline: RenderTimeline = {
  slug: "empty",
  fps: 30,
  width: 1080,
  height: 1920,
  audioSrc: null,
  durationFrames: 30,
  beats: [],
};

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="Video"
      component={Video}
      durationInFrames={emptyTimeline.durationFrames}
      fps={emptyTimeline.fps}
      width={emptyTimeline.width}
      height={emptyTimeline.height}
      defaultProps={emptyTimeline}
      calculateMetadata={async ({ props }) => ({
        durationInFrames: props.durationFrames,
        fps: props.fps,
        width: props.width,
        height: props.height,
      })}
    />
  );
};
