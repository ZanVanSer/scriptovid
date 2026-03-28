import type { TransitionType } from "@/types/render-project";
import type { RemotionMotionPresetName } from "./motionPresets";

export type TimelineSceneInput = {
  id: string;
  imageUrl: string;
  durationFrames: number;
  transitionType?: TransitionType;
  transitionDurationMs?: number;
  motionPreset?: RemotionMotionPresetName;
};

export type TimelinePlannerInput = {
  fps: number;
  transitions: {
    enabled: boolean;
    durationMs: number;
  };
  scenes: TimelineSceneInput[];
};

export type SceneTimelineEntry = {
  id: string;
  scene: TimelineSceneInput;
  sceneDurationFrames: number;
  sceneStartFrame: number;
  renderFromFrame: number;
  sequenceDurationFrames: number;
  incomingTransitionType: TransitionType;
  incomingTransitionFrames: number;
  outgoingTransitionType: TransitionType;
  outgoingTransitionFrames: number;
};

export type SceneTimelinePlan = {
  entries: SceneTimelineEntry[];
  totalCompositionFrames: number;
};

function normalizeTransitionType(value: string | undefined, fallback: TransitionType): TransitionType {
  if (
    value === "cut" ||
    value === "crossfade" ||
    value === "slide-left" ||
    value === "slide-right" ||
    value === "zoom-transition"
  ) {
    return value;
  }

  return fallback;
}

function transitionMsToFrames(transitionType: TransitionType, durationMs: number, fps: number) {
  if (transitionType === "cut") {
    return 0;
  }

  const safeDurationMs = Number.isFinite(durationMs) ? Math.max(0, durationMs) : 0;
  if (safeDurationMs <= 0) {
    return 0;
  }

  return Math.max(1, Math.round((safeDurationMs / 1000) * fps));
}

export function timelinePlanner(props: TimelinePlannerInput): SceneTimelinePlan {
  const sceneDurations = props.scenes.map((scene) => Math.max(1, Math.round(scene.durationFrames)));
  const sceneStartFrames: number[] = [];
  let timelineCursor = 0;
  for (let index = 0; index < sceneDurations.length; index += 1) {
    sceneStartFrames.push(timelineCursor);
    timelineCursor += sceneDurations[index];
  }

  const boundaryTransitions = props.scenes.slice(0, -1).map((scene, index) => {
    if (!props.transitions.enabled) {
      return {
        type: "cut" as const,
        frames: 0,
      };
    }

    const type = normalizeTransitionType(scene.transitionType, "crossfade");
    const durationMs = scene.transitionDurationMs ?? props.transitions.durationMs;
    const transitionDurationFrames = transitionMsToFrames(type, durationMs, props.fps);
    const cappedFrames = Math.min(
      transitionDurationFrames,
      sceneDurations[index],
      sceneDurations[index + 1],
    );

    return {
      type,
      frames: cappedFrames,
    };
  });

  const entries = props.scenes.map((scene, index) => {
    const incomingTransition = index === 0 ? { type: "cut" as const, frames: 0 } : boundaryTransitions[index - 1];
    const outgoingTransition =
      index === props.scenes.length - 1 ? { type: "cut" as const, frames: 0 } : boundaryTransitions[index];
    const sceneDurationFrames = sceneDurations[index];
    const sceneStartFrame = sceneStartFrames[index];
    const renderFromFrame = Math.max(0, sceneStartFrame - incomingTransition.frames);
    const sequenceDurationFrames = sceneDurationFrames + incomingTransition.frames;

    return {
      id: scene.id,
      scene,
      sceneDurationFrames,
      sceneStartFrame,
      renderFromFrame,
      sequenceDurationFrames,
      incomingTransitionType: incomingTransition.type,
      incomingTransitionFrames: incomingTransition.frames,
      outgoingTransitionType: outgoingTransition.type,
      outgoingTransitionFrames: outgoingTransition.frames,
    } satisfies SceneTimelineEntry;
  });

  return {
    entries,
    totalCompositionFrames: Math.max(1, timelineCursor),
  };
}
