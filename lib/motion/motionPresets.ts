import type { MotionPresetId } from "@/types/render-project";

export type MotionEasing = "linear" | "easeInOutCubic";

export type MotionPreset = {
  id: MotionPresetId;
  name: string;
  startScale: number;
  endScale: number;
  startX: number;
  endX: number;
  startY: number;
  endY: number;
  easing: MotionEasing;
};

export const MOTION_PRESETS: MotionPreset[] = [
  {
    id: "slow-zoom-in",
    name: "Slow Zoom In",
    startScale: 1,
    endScale: 1.12,
    startX: 0,
    endX: 0,
    startY: 0,
    endY: 0,
    easing: "linear",
  },
  {
    id: "slow-zoom-out",
    name: "Slow Zoom Out",
    startScale: 1.12,
    endScale: 1,
    startX: 0,
    endX: 0,
    startY: 0,
    endY: 0,
    easing: "linear",
  },
  {
    id: "pan-left-subtle",
    name: "Pan Left (Subtle)",
    startScale: 1.1,
    endScale: 1.1,
    startX: 0.12,
    endX: -0.12,
    startY: 0,
    endY: 0,
    easing: "linear",
  },
  {
    id: "pan-right-subtle",
    name: "Pan Right (Subtle)",
    startScale: 1.1,
    endScale: 1.1,
    startX: -0.12,
    endX: 0.12,
    startY: 0,
    endY: 0,
    easing: "linear",
  },
  {
    id: "pan-up-subtle",
    name: "Pan Up (Subtle)",
    startScale: 1.1,
    endScale: 1.1,
    startX: 0,
    endX: 0,
    startY: 0.1,
    endY: -0.1,
    easing: "linear",
  },
  {
    id: "pan-down-subtle",
    name: "Pan Down (Subtle)",
    startScale: 1.1,
    endScale: 1.1,
    startX: 0,
    endX: 0,
    startY: -0.1,
    endY: 0.1,
    easing: "linear",
  },
  {
    id: "drift-left-zoom-in",
    name: "Drift Left + Zoom In",
    startScale: 1.03,
    endScale: 1.15,
    startX: 0.08,
    endX: -0.08,
    startY: 0.02,
    endY: -0.02,
    easing: "linear",
  },
  {
    id: "drift-right-zoom-in",
    name: "Drift Right + Zoom In",
    startScale: 1.03,
    endScale: 1.15,
    startX: -0.08,
    endX: 0.08,
    startY: -0.02,
    endY: 0.02,
    easing: "linear",
  },
];

export const MOTION_PRESET_IDS: MotionPresetId[] = MOTION_PRESETS.map((preset) => preset.id);

const PRESET_BY_ID = new Map<MotionPresetId, MotionPreset>(
  MOTION_PRESETS.map((preset) => [preset.id, preset]),
);

export function getMotionPresetById(presetId?: MotionPresetId) {
  if (!presetId) {
    return undefined;
  }
  return PRESET_BY_ID.get(presetId);
}

export function normalizeAllowedMotionPresetIds(presetIds: MotionPresetId[]) {
  const allowedSet = new Set(MOTION_PRESET_IDS);
  const deduped: MotionPresetId[] = [];
  const seen = new Set<MotionPresetId>();

  presetIds.forEach((presetId) => {
    if (!allowedSet.has(presetId) || seen.has(presetId)) {
      return;
    }
    seen.add(presetId);
    deduped.push(presetId);
  });

  return deduped;
}

export function assignDeterministicMotionPresetBySceneIndex(
  sceneIndex: number,
  allowedPresetIds: MotionPresetId[],
  assignmentSalt?: string,
) {
  if (allowedPresetIds.length === 0) {
    return undefined;
  }

  const normalizedSceneIndex = Number.isFinite(sceneIndex) && sceneIndex >= 0 ? Math.floor(sceneIndex) : 0;
  if (!assignmentSalt) {
    const presetIndex = normalizedSceneIndex % allowedPresetIds.length;
    return allowedPresetIds[presetIndex];
  }

  let hash = 2166136261;
  const seed = `${normalizedSceneIndex}:${assignmentSalt}`;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  const presetIndex = (hash >>> 0) % allowedPresetIds.length;
  return allowedPresetIds[presetIndex];
}
