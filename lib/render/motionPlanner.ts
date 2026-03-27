import type { MotionPreset } from "@/lib/motion/motionPresets";

type BuildComputedMotionInput = {
  outputWidth: number;
  outputHeight: number;
  preset: MotionPreset;
};

export type ComputedMotion = {
  workingWidth: number;
  workingHeight: number;
  startCropX: number;
  endCropX: number;
  startCropY: number;
  endCropY: number;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function toEvenFloor(value: number) {
  const floored = Math.floor(value);
  return floored % 2 === 0 ? floored : floored - 1;
}

function normalizeScale(value: number) {
  if (!Number.isFinite(value)) {
    return 1;
  }
  return Math.max(1, value);
}

function toPixelPosition(norm: number, travel: number) {
  const normalized = Number.isFinite(norm) ? clamp(norm, -0.5, 0.5) : 0;
  return (normalized + 0.5) * travel;
}

export function computeMotionFromPreset(input: BuildComputedMotionInput): ComputedMotion {
  const outputWidth = Math.max(2, Math.round(input.outputWidth));
  const outputHeight = Math.max(2, Math.round(input.outputHeight));

  const maxScale = Math.max(normalizeScale(input.preset.startScale), normalizeScale(input.preset.endScale));
  const rawWorkingWidth = Math.max(outputWidth, outputWidth * maxScale);
  const rawWorkingHeight = Math.max(outputHeight, outputHeight * maxScale);

  const workingWidth = Math.max(outputWidth, toEvenFloor(rawWorkingWidth));
  const workingHeight = Math.max(outputHeight, toEvenFloor(rawWorkingHeight));

  const travelX = Math.max(0, workingWidth - outputWidth);
  const travelY = Math.max(0, workingHeight - outputHeight);

  const startCropX = clamp(toPixelPosition(input.preset.startX, travelX), 0, travelX);
  const endCropX = clamp(toPixelPosition(input.preset.endX, travelX), 0, travelX);
  const startCropY = clamp(toPixelPosition(input.preset.startY, travelY), 0, travelY);
  const endCropY = clamp(toPixelPosition(input.preset.endY, travelY), 0, travelY);

  return {
    workingWidth,
    workingHeight,
    startCropX,
    endCropX,
    startCropY,
    endCropY,
  };
}
