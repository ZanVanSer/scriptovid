import type { MotionPresetId, MotionSettings, RenderScene } from "@/types/render-project";

export type RemotionMotionPresetName =
  | "zoom-in"
  | "zoom-out"
  | "pan-left"
  | "pan-right"
  | "pan-up"
  | "pan-down"
  | "drift-left"
  | "drift-right"
  | "zoom-pan-left"
  | "zoom-pan-right";

export type RemotionMotionPreset = {
  name: RemotionMotionPresetName;
  startScale: number;
  endScale: number;
  startX: number;
  endX: number;
  startY: number;
  endY: number;
};

export const REMOTION_MOTION_PRESETS: Record<RemotionMotionPresetName, RemotionMotionPreset> = {
  "zoom-in": {
    name: "zoom-in",
    startScale: 1.08,
    endScale: 1.16,
    startX: 0,
    endX: 0,
    startY: 0,
    endY: 0,
  },
  "zoom-out": {
    name: "zoom-out",
    startScale: 1.16,
    endScale: 1.08,
    startX: 0,
    endX: 0,
    startY: 0,
    endY: 0,
  },
  "pan-left": {
    name: "pan-left",
    startScale: 1.15,
    endScale: 1.15,
    startX: 0.03,
    endX: -0.03,
    startY: 0,
    endY: 0,
  },
  "pan-right": {
    name: "pan-right",
    startScale: 1.15,
    endScale: 1.15,
    startX: -0.03,
    endX: 0.03,
    startY: 0,
    endY: 0,
  },
  "pan-up": {
    name: "pan-up",
    startScale: 1.15,
    endScale: 1.15,
    startX: 0,
    endX: 0,
    startY: 0.03,
    endY: -0.03,
  },
  "pan-down": {
    name: "pan-down",
    startScale: 1.15,
    endScale: 1.15,
    startX: 0,
    endX: 0,
    startY: -0.03,
    endY: 0.03,
  },
  "drift-left": {
    name: "drift-left",
    startScale: 1.12,
    endScale: 1.2,
    startX: 0.025,
    endX: -0.025,
    startY: 0.01,
    endY: -0.01,
  },
  "drift-right": {
    name: "drift-right",
    startScale: 1.12,
    endScale: 1.2,
    startX: -0.025,
    endX: 0.025,
    startY: -0.01,
    endY: 0.01,
  },
  "zoom-pan-left": {
    name: "zoom-pan-left",
    startScale: 1.08,
    endScale: 1.24,
    startX: 0.04,
    endX: -0.04,
    startY: -0.03,
    endY: 0.03,
  },
  "zoom-pan-right": {
    name: "zoom-pan-right",
    startScale: 1.08,
    endScale: 1.24,
    startX: -0.04,
    endX: 0.04,
    startY: 0.03,
    endY: -0.03,
  },
};

function getZoomPanPresetBySceneIndex(sceneIndex: number) {
  return sceneIndex % 2 === 0 ? "zoom-pan-left" : "zoom-pan-right";
}

function mapLegacyPresetIdToRemotionPreset(
  presetId: MotionPresetId | undefined,
  sceneIndex: number,
): RemotionMotionPresetName | undefined {
  if (!presetId) {
    return undefined;
  }

  switch (presetId) {
    case "slow-zoom-in":
      return "zoom-in";
    case "slow-zoom-out":
      return "zoom-out";
    case "pan-left-subtle":
      return "pan-left";
    case "pan-right-subtle":
      return "pan-right";
    case "pan-up-subtle":
      return "pan-up";
    case "pan-down-subtle":
      return "pan-down";
    case "drift-left-zoom-in":
      return "drift-left";
    case "drift-right-zoom-in":
      return "drift-right";
    case "zoom-pan":
      return getZoomPanPresetBySceneIndex(sceneIndex);
    default:
      return undefined;
  }
}

function mapAllowedLegacyPresetIds(allowedPresetIds: MotionPresetId[], sceneIndex: number) {
  const mapped = allowedPresetIds
    .map((presetId) => mapLegacyPresetIdToRemotionPreset(presetId, sceneIndex))
    .filter((preset): preset is RemotionMotionPresetName => Boolean(preset));

  return [...new Set(mapped)];
}

export function resolveSceneMotionPreset(
  scene: RenderScene,
  sceneIndex: number,
  motionSettings: MotionSettings,
): RemotionMotionPresetName | undefined {
  if (!motionSettings.enabled) {
    return undefined;
  }

  const normalizedSceneIndex = Number.isFinite(sceneIndex) && sceneIndex >= 0 ? Math.floor(sceneIndex) : 0;
  const explicitPreset = mapLegacyPresetIdToRemotionPreset(scene.motionPreset, normalizedSceneIndex);
  if (explicitPreset) {
    return explicitPreset;
  }

  const allowedPresets = mapAllowedLegacyPresetIds(motionSettings.allowedPresetIds, normalizedSceneIndex);
  if (allowedPresets.length === 0) {
    return undefined;
  }

  const presetIndex = normalizedSceneIndex % allowedPresets.length;
  return allowedPresets[presetIndex];
}
