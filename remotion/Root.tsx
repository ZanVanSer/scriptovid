import { Composition, registerRoot } from "remotion";

import {
  DEFAULT_REMOTION_RENDER_PROPS,
  type RemotionRenderProps,
  VideoComposition,
} from "./VideoComposition";
import { timelinePlanner } from "./lib/timeline-planner";

const REMOTION_RENDER_PROJECT_COMPOSITION_ID = "remotion-render-project";

function getTotalDurationInFrames(scenes: RemotionRenderProps["scenes"]) {
  const timeline = timelinePlanner({
    fps: DEFAULT_REMOTION_RENDER_PROPS.fps,
    transitions: DEFAULT_REMOTION_RENDER_PROPS.transitions,
    scenes,
  });
  return timeline.totalCompositionFrames;
}

export function RemotionRoot() {
  return (
    <Composition
      id={REMOTION_RENDER_PROJECT_COMPOSITION_ID}
      component={VideoComposition}
      durationInFrames={getTotalDurationInFrames(DEFAULT_REMOTION_RENDER_PROPS.scenes)}
      fps={DEFAULT_REMOTION_RENDER_PROPS.fps}
      width={DEFAULT_REMOTION_RENDER_PROPS.width}
      height={DEFAULT_REMOTION_RENDER_PROPS.height}
      defaultProps={DEFAULT_REMOTION_RENDER_PROPS}
      calculateMetadata={({ props }) => {
        const typedProps = props as RemotionRenderProps;
        const timeline = timelinePlanner({
          fps: typedProps.fps,
          transitions: typedProps.transitions,
          scenes: typedProps.scenes,
        });
        return {
          durationInFrames: timeline.totalCompositionFrames,
          fps: typedProps.fps,
          width: typedProps.width,
          height: typedProps.height,
        };
      }}
    />
  );
}

registerRoot(RemotionRoot);

export { REMOTION_RENDER_PROJECT_COMPOSITION_ID };
