import { Audio, Sequence } from "remotion";

import type { TransitionType } from "@/types/render-project";

import { TransitionSceneLayer } from "./components/TransitionSceneLayer";
import { timelinePlanner } from "./lib/timeline-planner";
import type { RemotionMotionPresetName } from "./lib/motionPresets";

export type RemotionRenderScene = {
  id: string;
  imageUrl: string;
  durationFrames: number;
  transitionType?: TransitionType;
  transitionDurationMs?: number;
  motionPreset?: RemotionMotionPresetName;
};

export type RemotionRenderProps = {
  width: number;
  height: number;
  fps: number;
  motionStrength: "weak" | "medium" | "strong";
  transitions: {
    enabled: boolean;
    durationMs: number;
  };
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
  transitions: {
    enabled: true,
    durationMs: 500,
  },
  scenes: [
    {
      id: "placeholder",
      imageUrl: "/file.svg",
      durationFrames: 150,
      transitionType: "crossfade",
      transitionDurationMs: 500,
    },
  ],
  narration: undefined,
};

export function VideoComposition(props: RemotionRenderProps) {
  const timeline = timelinePlanner(props);

  return (
    <>
      {props.narration?.audioUrl ? <Audio src={props.narration.audioUrl} /> : null}
      {timeline.entries.map((entry) => {
        return (
          <Sequence key={entry.id} from={entry.renderFromFrame} durationInFrames={entry.sequenceDurationFrames}>
            <TransitionSceneLayer
              entry={entry}
              width={props.width}
              height={props.height}
              motionStrength={props.motionStrength}
            />
          </Sequence>
        );
      })}
    </>
  );
}
