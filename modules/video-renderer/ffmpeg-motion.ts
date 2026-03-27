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

function getSpeedTuning(motionSpeed: 0.5 | 0.75 | 1) {
  if (motionSpeed === 0.5) {
    return { zoomDelta: 0.05, panOverscan: 0.1, panMinTravelPx: 36 };
  }
  if (motionSpeed === 1) {
    return { zoomDelta: 0.1, panOverscan: 0.22, panMinTravelPx: 96 };
  }
  return { zoomDelta: 0.075, panOverscan: 0.16, panMinTravelPx: 68 };
}

function getSceneFrames(duration: number, fps: number) {
  const normalizedDuration = Number.isFinite(duration) && duration > 0 ? duration : 0.001;
  return Math.max(2, Math.round(normalizedDuration * fps));
}

function buildPrepFilter(width: number, height: number, overscanScale: number) {
  const sourceWidth = toEven(width * overscanScale);
  const sourceHeight = toEven(height * overscanScale);
  return {
    filter: `scale=${sourceWidth}:${sourceHeight}:force_original_aspect_ratio=increase,crop=${sourceWidth}:${sourceHeight}`,
    sourceWidth,
    sourceHeight,
  };
}

function buildZoompanExpressions(
  preset: MotionPresetId | undefined,
  sourceWidth: number,
  sourceHeight: number,
  outputWidth: number,
  outputHeight: number,
  frames: number,
  zoomDelta: number,
  panMinTravelPx: number,
  motionEnabled: boolean,
) {
  const denominator = frames - 1;
  const progress = `on/${denominator}`;
  const eased = `(${progress})*(${progress})*(3-2*(${progress}))`;
  const maxPanX = Math.max(sourceWidth - outputWidth, 0);
  const maxPanY = Math.max(sourceHeight - outputHeight, 0);
  const centerX = maxPanX / 2;
  const centerY = maxPanY / 2;
  const travelX = Math.max(0, Math.min(maxPanX * 0.92, Math.max(panMinTravelPx, maxPanX * 0.6)));
  const travelY = Math.max(0, Math.min(maxPanY * 0.92, Math.max(panMinTravelPx, maxPanY * 0.6)));

  if (!motionEnabled || !preset) {
    return {
      z: "1",
      x: `${centerX}`,
      y: `${centerY}`,
    };
  }

  if (preset === "zoom-in") {
    return {
      z: `1+${zoomDelta.toFixed(4)}*(${eased})`,
      x: "(iw/2)-(iw/zoom/2)",
      y: "(ih/2)-(ih/zoom/2)",
    };
  }

  if (preset === "zoom-out") {
    return {
      z: `1+${zoomDelta.toFixed(4)}*(1-(${eased}))`,
      x: "(iw/2)-(iw/zoom/2)",
      y: "(ih/2)-(ih/zoom/2)",
    };
  }

  if (preset === "pan-left") {
    const startX = centerX + travelX / 2;
    return {
      z: "1",
      x: `${startX}-${travelX}*(${eased})`,
      y: `${centerY}`,
    };
  }

  if (preset === "pan-right") {
    const startX = centerX - travelX / 2;
    return {
      z: "1",
      x: `${startX}+${travelX}*(${eased})`,
      y: `${centerY}`,
    };
  }

  if (preset === "pan-up") {
    const startY = centerY + travelY / 2;
    return {
      z: "1",
      x: `${centerX}`,
      y: `${startY}-${travelY}*(${eased})`,
    };
  }

  if (preset === "pan-down") {
    const startY = centerY - travelY / 2;
    return {
      z: "1",
      x: `${centerX}`,
      y: `${startY}+${travelY}*(${eased})`,
    };
  }

  return {
    z: "1",
    x: `${centerX}`,
    y: `${centerY}`,
  };
}

export function buildSceneMotionFilter(input: BuildSceneMotionFilterInput) {
  const { scene, width, height, fps, motionEnabled, motionSpeed } = input;
  const { zoomDelta, panOverscan, panMinTravelPx } = getSpeedTuning(motionSpeed);
  const hasPanPreset =
    scene.motionPreset === "pan-left" ||
    scene.motionPreset === "pan-right" ||
    scene.motionPreset === "pan-up" ||
    scene.motionPreset === "pan-down";

  // Use larger source area for pan so movement stays smooth with non-trivial travel.
  const overscanScale = hasPanPreset ? 1 + panOverscan : 1 + zoomDelta + 0.04;
  const prep = buildPrepFilter(width, height, overscanScale);
  const frames = getSceneFrames(scene.finalDuration, fps);
  const expressions = buildZoompanExpressions(
    scene.motionPreset,
    prep.sourceWidth,
    prep.sourceHeight,
    width,
    height,
    frames,
    zoomDelta,
    panMinTravelPx,
    motionEnabled,
  );

  return [
    prep.filter,
    `zoompan=z='${expressions.z}':x='${expressions.x}':y='${expressions.y}':d=${frames}:s=${width}x${height}:fps=${fps}`,
    "format=yuv420p",
    "setsar=1",
  ].join(",");
}
