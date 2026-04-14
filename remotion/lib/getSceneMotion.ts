import { Easing, interpolate } from "remotion";

import {
  MOTION_STRENGTH_DEFAULT,
  MOTION_STRENGTH_MAX,
  MOTION_STRENGTH_MIN,
  normalizeMotionStrength,
} from "@/types/render-project";
import { REMOTION_MOTION_PRESETS, type RemotionMotionPresetName } from "./motionPresets";

export type SceneMotionValues = {
  scale: number;
  translateX: number;
  translateY: number;
};

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
  motionStrength: number,
): SceneMotionValues {
  if (!presetName) {
    return {
      scale: 1,
      translateX: 0,
      translateY: 0,
    };
  }

  const preset = REMOTION_MOTION_PRESETS[presetName];
  const strengthMultiplier = normalizeMotionStrength(motionStrength, MOTION_STRENGTH_DEFAULT);
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

  const maxScale = 1 + 0.5 * (strengthMultiplier / MOTION_STRENGTH_MAX);
  const maxPan = 0.04 + 0.12 * ((strengthMultiplier - MOTION_STRENGTH_MIN) / (MOTION_STRENGTH_MAX - MOTION_STRENGTH_MIN));
  const safeScale = clamp(scale, 1.02, maxScale);
  const safeX = clamp(normalizedX, -maxPan, maxPan);
  const safeY = clamp(normalizedY, -maxPan, maxPan);

  return {
    scale: safeScale,
    translateX: safeX * width,
    translateY: safeY * height,
  };
}
