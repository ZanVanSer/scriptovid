import { Composition, registerRoot } from "remotion";

import {
  DEFAULT_REMOTION_RENDER_PROPS,
  type RemotionRenderProps,
  VideoComposition,
} from "./VideoComposition";

const REMOTION_RENDER_PROJECT_COMPOSITION_ID = "remotion-render-project";

function getTotalDurationInFrames(scenes: RemotionRenderProps["scenes"]) {
  const total = scenes.reduce((sum, scene) => sum + scene.durationFrames, 0);
  return Math.max(1, total);
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
        return {
          durationInFrames: getTotalDurationInFrames(typedProps.scenes),
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
