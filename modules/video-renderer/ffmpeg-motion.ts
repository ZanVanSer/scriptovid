import type { MotionPresetId, RenderScene } from "@/types/render-project";

type BuildSceneMotionFilterInput = {
  scene: RenderScene;
  width: number;
  height: number;
  fps: number;
  motionEnabled: boolean;
  motionSpeed: 0.5 | 0.75 | 1;
};

function toEven(value: number) {
  const rounded = Math.round(value);
  return rounded % 2 === 0 ? rounded : rounded + 1;
}

function buildStaticFilter(width: number, height: number, fps: number) {
  return [
    `scale=${width}:${height}:force_original_aspect_ratio=increase`,
    `crop=${width}:${height}`,
    `fps=${fps}`,
    "format=yuv420p",
    "setsar=1",
  ].join(",");
}

function getSafeDuration(duration: number) {
  return Math.max(duration, 0.001);
}

function buildPanCropExpressions(preset: MotionPresetId, xRange: number, yRange: number, progress: string) {
  const centerX = xRange / 2;
  const centerY = yRange / 2;

  if (preset === "pan-left") {
    return { x: `${xRange}*(1-${progress})`, y: `${centerY}` };
  }
  if (preset === "pan-right") {
    return { x: `${xRange}*${progress}`, y: `${centerY}` };
  }
  if (preset === "pan-up") {
    return { x: `${centerX}`, y: `${yRange}*(1-${progress})` };
  }
  if (preset === "pan-down") {
    return { x: `${centerX}`, y: `${yRange}*${progress}` };
  }

  return undefined;
}

function buildMotionFilter(
  preset: MotionPresetId,
  duration: number,
  width: number,
  height: number,
  fps: number,
  motionSpeed: 0.5 | 0.75 | 1,
) {
  const overscanWidth = toEven(width * 1.12);
  const overscanHeight = toEven(height * 1.12);
  const xRange = Math.max(overscanWidth - width, 0);
  const yRange = Math.max(overscanHeight - height, 0);
  const durationSafe = getSafeDuration(duration) + 0.001;
  // Keep the expression comma-free to avoid FFmpeg filter parser conflicts.
  const progress = `(t/${durationSafe.toFixed(6)})`;

  const panExpressions = buildPanCropExpressions(preset, xRange, yRange, progress);
  if (panExpressions) {
    const speedRangeX = xRange * motionSpeed;
    const speedRangeY = yRange * motionSpeed;
    const panSpeedExpressions = buildPanCropExpressions(preset, speedRangeX, speedRangeY, progress);
    const activePanExpressions = panSpeedExpressions || panExpressions;

    return [
      `scale=${overscanWidth}:${overscanHeight}:force_original_aspect_ratio=increase`,
      `crop=${overscanWidth}:${overscanHeight}`,
      `crop=${width}:${height}:${activePanExpressions.x}:${activePanExpressions.y}`,
      `fps=${fps}`,
      "format=yuv420p",
      "setsar=1",
    ].join(",");
  }

  if (preset === "zoom-in" || preset === "zoom-out") {
    const zoomDelta = (0.08 * motionSpeed).toFixed(4);
    const zoomExpression =
      preset === "zoom-in" ? `1.00+${zoomDelta}*${progress}` : `1.00+${zoomDelta}*(1-${progress})`;

    return [
      `scale=${overscanWidth}:${overscanHeight}:force_original_aspect_ratio=increase`,
      `crop=${overscanWidth}:${overscanHeight}`,
      `scale=iw*(${zoomExpression}):ih*(${zoomExpression}):eval=frame`,
      `crop=${width}:${height}:(in_w-out_w)/2:(in_h-out_h)/2`,
      `fps=${fps}`,
      "format=yuv420p",
      "setsar=1",
    ].join(",");
  }

  return buildStaticFilter(width, height, fps);
}

export function buildSceneMotionFilter(input: BuildSceneMotionFilterInput) {
  const { scene, width, height, fps, motionEnabled, motionSpeed } = input;

  if (!motionEnabled || !scene.motionPreset) {
    return buildStaticFilter(width, height, fps);
  }

  return buildMotionFilter(scene.motionPreset, scene.finalDuration, width, height, fps, motionSpeed);
}
