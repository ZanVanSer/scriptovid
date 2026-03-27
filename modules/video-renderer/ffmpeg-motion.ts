import { getMotionPresetById, type MotionPreset } from "@/lib/motion/motionPresets";
import { computeMotionFromPreset } from "@/lib/render/motionPlanner";
import type { MotionPresetId, RenderScene } from "@/types/render-project";

type BuildSceneMotionFilterInput = {
  scene: RenderScene;
  width: number;
  height: number;
  fps: number;
  motionEnabled: boolean;
  motionSpeed: 0.5 | 0.75 | 1;
};

export type SceneMotionDebugInfo = {
  sceneIndex: number;
  presetId: MotionPresetId | "static";
  workingWidth: number;
  workingHeight: number;
  startCropX: number;
  endCropX: number;
  startCropY: number;
  endCropY: number;
  duration: number;
};

type SceneMotionFilterResult = {
  filter: string;
  debug: SceneMotionDebugInfo;
};

function toEvenFloor(value: number) {
  const floored = Math.floor(value);
  return floored % 2 === 0 ? floored : floored - 1;
}

function getSafeDuration(duration: number) {
  if (!Number.isFinite(duration) || duration <= 0) {
    return 0.001;
  }
  return duration;
}

function getStaticPreset(): MotionPreset {
  return {
    id: "slow-zoom-in",
    name: "Static",
    startScale: 1,
    endScale: 1,
    startX: 0,
    endX: 0,
    startY: 0,
    endY: 0,
    easing: "linear",
  };
}

function toFixed(value: number, precision = 3) {
  return Number.isFinite(value) ? value.toFixed(precision) : "0.000";
}

function escapeFilterExpression(value: string) {
  return value.replaceAll(",", "\\,");
}

function buildProgressExpression(duration: number, fps: number) {
  const totalFrames = Math.max(1, Math.round(duration * fps));
  return `min(max(n/${toFixed(totalFrames, 0)},0),1)`;
}

function buildNormalizedCoordinateExpression(startNorm: number, endNorm: number, progress: string, axis: "x" | "y") {
  const startValue = Number.isFinite(startNorm) ? startNorm : 0;
  const endValue = Number.isFinite(endNorm) ? endNorm : 0;
  const delta = endValue - startValue;
  const dimension = axis === "x" ? "iw" : "ih";
  const output = axis === "x" ? "ow" : "oh";
  const travel = `(${dimension}-${output})`;
  const normalized = `${toFixed(startValue, 6)}+(${toFixed(delta, 6)})*(${progress})`;
  return escapeFilterExpression(`min(max(((${normalized})+0.5)*${travel},0),${travel})`);
}

function buildScaleExpression(startScale: number, endScale: number, progress: string) {
  const start = Number.isFinite(startScale) ? Math.max(1, startScale) : 1;
  const end = Number.isFinite(endScale) ? Math.max(1, endScale) : 1;
  const delta = end - start;
  return `${toFixed(start, 6)}+(${toFixed(delta, 6)})*(${progress})`;
}

export function buildSceneMotionFilter(input: BuildSceneMotionFilterInput): SceneMotionFilterResult {
  const { scene, width, height, fps, motionEnabled, motionSpeed } = input;
  void motionSpeed;
  const outputWidth = Math.max(2, toEvenFloor(width));
  const outputHeight = Math.max(2, toEvenFloor(height));
  const duration = getSafeDuration(scene.finalDuration);
  const preset = motionEnabled ? getMotionPresetById(scene.motionPreset) || getStaticPreset() : getStaticPreset();
  const computed = computeMotionFromPreset({
    outputWidth,
    outputHeight,
    preset,
  });
  const progressExpr = buildProgressExpression(duration, fps);
  const xExpr = buildNormalizedCoordinateExpression(preset.startX, preset.endX, progressExpr, "x");
  const yExpr = buildNormalizedCoordinateExpression(preset.startY, preset.endY, progressExpr, "y");
  const scaleExpr = buildScaleExpression(preset.startScale, preset.endScale, progressExpr);

  const filter = [
    `scale=${outputWidth}:${outputHeight}:force_original_aspect_ratio=increase`,
    `crop=${outputWidth}:${outputHeight}`,
    `scale=w='trunc(${outputWidth}*(${scaleExpr})/2)*2':h='trunc(${outputHeight}*(${scaleExpr})/2)*2':eval=frame`,
    `crop=${outputWidth}:${outputHeight}:${xExpr}:${yExpr}`,
    `fps=${fps}`,
    "format=yuv420p",
    "setsar=1",
  ].join(",");

  return {
    filter,
    debug: {
      sceneIndex: Math.max(0, scene.order - 1),
      presetId: motionEnabled && scene.motionPreset ? scene.motionPreset : "static",
      workingWidth: computed.workingWidth,
      workingHeight: computed.workingHeight,
      startCropX: computed.startCropX,
      endCropX: computed.endCropX,
      startCropY: computed.startCropY,
      endCropY: computed.endCropY,
      duration,
    },
  };
}
