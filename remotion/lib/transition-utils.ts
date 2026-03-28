import { Easing, interpolate } from "remotion";

import type { TransitionType } from "@/types/render-project";

type TransitionStyleContext = {
  frameInSequence: number;
  sceneDurationFrames: number;
  incomingTransitionType: TransitionType;
  incomingTransitionFrames: number;
  outgoingTransitionType: TransitionType;
  outgoingTransitionFrames: number;
  width: number;
};

export type SceneTransitionStyle = {
  opacity: number;
  translateX: number;
  scale: number;
};

function easeProgress(value: number) {
  return interpolate(value, [0, 1], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.inOut(Easing.cubic),
  });
}

function progress(frame: number, totalFrames: number) {
  if (totalFrames <= 1) {
    return 1;
  }

  return Math.min(1, Math.max(0, frame / (totalFrames - 1)));
}

function applyTransition(
  transitionType: TransitionType,
  direction: "in" | "out",
  easedProgress: number,
  width: number,
  style: SceneTransitionStyle,
) {
  if (transitionType === "cut") {
    return;
  }

  if (transitionType === "crossfade") {
    style.opacity *= direction === "in" ? easedProgress : 1 - easedProgress;
    return;
  }

  if (transitionType === "slide-left") {
    if (direction === "in") {
      style.translateX += interpolate(easedProgress, [0, 1], [width, 0]);
    } else {
      style.translateX += interpolate(easedProgress, [0, 1], [0, -width]);
    }
    return;
  }

  if (transitionType === "slide-right") {
    if (direction === "in") {
      style.translateX += interpolate(easedProgress, [0, 1], [-width, 0]);
    } else {
      style.translateX += interpolate(easedProgress, [0, 1], [0, width]);
    }
    return;
  }

  if (transitionType === "zoom-transition") {
    style.opacity *= direction === "in" ? easedProgress : 1 - easedProgress;
    style.scale *=
      direction === "in"
        ? interpolate(easedProgress, [0, 1], [1.05, 1])
        : interpolate(easedProgress, [0, 1], [1, 1.05]);
  }
}

export function resolveSceneTransitionStyle(context: TransitionStyleContext): SceneTransitionStyle {
  const style: SceneTransitionStyle = {
    opacity: 1,
    translateX: 0,
    scale: 1,
  };

  if (context.incomingTransitionFrames > 0 && context.frameInSequence < context.incomingTransitionFrames) {
    const inProgress = progress(context.frameInSequence, context.incomingTransitionFrames);
    applyTransition(context.incomingTransitionType, "in", easeProgress(inProgress), context.width, style);
  }

  if (context.outgoingTransitionFrames > 0) {
    const sceneFrame = Math.min(
      context.sceneDurationFrames - 1,
      Math.max(0, context.frameInSequence - context.incomingTransitionFrames),
    );
    const outStart = context.sceneDurationFrames - context.outgoingTransitionFrames;

    if (sceneFrame >= outStart) {
      const outProgress = progress(sceneFrame - outStart, context.outgoingTransitionFrames);
      applyTransition(context.outgoingTransitionType, "out", easeProgress(outProgress), context.width, style);
    }
  }

  return style;
}

