import { Easing, interpolate } from "remotion";

import { REMOTION_MOTION_PRESETS, type RemotionMotionPresetName } from "./motionPresets";

export type SceneMotionValues = {
  scale: number;
  translateX: number;
  translateY: number;
};

const STRENGTH_MULTIPLIER = {
  weak: 0.6,
  medium: 1,
  strong: 1.6,
} as const;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function toProgress(frame: number, durationInFrames: number) {
  const totalFrames = Math.max(1, durationInFrames - 1);
  return clamp(frame / totalFrames, 0, 1);
}

export function getSceneMotion(
  presetName: RemotionMotionPresetName | undefined,
  frame: number,
  durationInFrames: number,
  width: number,
  height: number,
  motionStrength: "weak" | "medium" | "strong",
): SceneMotionValues {
  if (!presetName) {
    return {
      scale: 1,
      translateX: 0,
      translateY: 0,
    };
  }

  const preset = REMOTION_MOTION_PRESETS[presetName];
  const strengthMultiplier = STRENGTH_MULTIPLIER[motionStrength];
  const progress = toProgress(frame, durationInFrames);

  const easedProgress = interpolate(progress, [0, 1], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.inOut(Easing.cubic),
  });

  const baseScale = interpolate(easedProgress, [0, 1], [preset.startScale, preset.endScale], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const scale = 1 + (baseScale - 1) * strengthMultiplier;

  const normalizedX = interpolate(easedProgress, [0, 1], [preset.startX, preset.endX], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  }) * strengthMultiplier;
  const normalizedY = interpolate(easedProgress, [0, 1], [preset.startY, preset.endY], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  }) * strengthMultiplier;

  const safeScale = clamp(scale, 1.04, 1.32);
  const safeX = clamp(normalizedX, -0.05, 0.05);
  const safeY = clamp(normalizedY, -0.05, 0.05);

  return {
    scale: safeScale,
    translateX: safeX * width,
    translateY: safeY * height,
  };
}
