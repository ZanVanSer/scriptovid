import { Audio, Sequence } from "remotion";

import { SceneFrame } from "./components/SceneFrame";
import type { RemotionMotionPresetName } from "./lib/motionPresets";

export type RemotionRenderScene = {
  id: string;
  imageUrl: string;
  durationFrames: number;
  motionPreset?: RemotionMotionPresetName;
};

export type RemotionRenderProps = {
  width: number;
  height: number;
  fps: number;
  motionStrength: "weak" | "medium" | "strong";
  scenes: RemotionRenderScene[];
  narration?: {
    audioUrl: string;
  };
};

export const DEFAULT_REMOTION_RENDER_PROPS: RemotionRenderProps = {
  width: 1280,
  height: 720,
  fps: 30,
  motionStrength: "medium",
  scenes: [
    {
      id: "placeholder",
      imageUrl: "/file.svg",
      durationFrames: 150,
    },
  ],
  narration: undefined,
};

export function VideoComposition(props: RemotionRenderProps) {
  let timelineCursor = 0;

  return (
    <>
      {props.narration?.audioUrl ? <Audio src={props.narration.audioUrl} /> : null}
      {props.scenes.map((scene) => {
        const from = timelineCursor;
        timelineCursor += scene.durationFrames;

        return (
          <Sequence key={scene.id} from={from} durationInFrames={scene.durationFrames}>
            <SceneFrame
              imageUrl={scene.imageUrl}
              width={props.width}
              height={props.height}
              durationInFrames={scene.durationFrames}
              motionPreset={scene.motionPreset}
              motionStrength={props.motionStrength}
            />
          </Sequence>
        );
      })}
    </>
  );
}
