import type { MotionPresetId } from "@/types/render-project";

export type MotionPreset = {
  id: MotionPresetId;
  label: string;
  description?: string;
};

export const MOTION_PRESETS: MotionPreset[] = [
  { id: "zoom-in", label: "Zoom In", description: "Gradual scale up." },
  { id: "zoom-out", label: "Zoom Out", description: "Gradual scale down." },
  { id: "pan-left", label: "Pan Left", description: "Horizontal move toward left." },
  { id: "pan-right", label: "Pan Right", description: "Horizontal move toward right." },
  { id: "pan-up", label: "Pan Up", description: "Vertical move upward." },
  { id: "pan-down", label: "Pan Down", description: "Vertical move downward." },
];

export const MOTION_PRESET_IDS: MotionPresetId[] = MOTION_PRESETS.map((preset) => preset.id);

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

function hashToUint32(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function assignDeterministicMotionPreset(
  sceneId: string,
  sceneOrder: number,
  allowedPresetIds: MotionPresetId[],
) {
  if (allowedPresetIds.length === 0) {
    return undefined;
  }

  const seed = `${sceneId}::${sceneOrder}::${allowedPresetIds.join("|")}`;
  const hash = hashToUint32(seed);
  const index = hash % allowedPresetIds.length;
  return allowedPresetIds[index];
}
