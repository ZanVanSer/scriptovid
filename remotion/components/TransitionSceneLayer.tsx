import { AbsoluteFill, useCurrentFrame } from "remotion";

import type { SceneTimelineEntry } from "../lib/timeline-planner";
import { resolveSceneTransitionStyle } from "../lib/transition-utils";
import { SceneFrame } from "./SceneFrame";

type TransitionSceneLayerProps = {
  entry: SceneTimelineEntry;
  width: number;
  height: number;
  motionStrength: "weak" | "medium" | "strong";
};

export function TransitionSceneLayer({ entry, width, height, motionStrength }: TransitionSceneLayerProps) {
  const frame = useCurrentFrame();
  const transition = resolveSceneTransitionStyle({
    frameInSequence: frame,
    sceneDurationFrames: entry.sceneDurationFrames,
    incomingTransitionType: entry.incomingTransitionType,
    incomingTransitionFrames: entry.incomingTransitionFrames,
    outgoingTransitionType: entry.outgoingTransitionType,
    outgoingTransitionFrames: entry.outgoingTransitionFrames,
    width,
  });

  return (
    <AbsoluteFill
      style={{
        opacity: transition.opacity,
        transform: `translateX(${transition.translateX}px) scale(${transition.scale})`,
      }}
    >
      <SceneFrame
        imageUrl={entry.scene.imageUrl}
        width={width}
        height={height}
        durationInFrames={entry.sceneDurationFrames}
        frameOffsetFrames={entry.incomingTransitionFrames}
        motionPreset={entry.scene.motionPreset}
        motionStrength={motionStrength}
      />
    </AbsoluteFill>
  );
}
