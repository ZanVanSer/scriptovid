import { CINEMATIC_TRANSITION_PRESET_IDS } from "@/lib/render/transition-types";
import type { TransitionType } from "@/types/render-project";

type TransitionPickerInput = {
  boundaryCount: number;
  presetPool: TransitionType[];
  renderSessionSeed: string;
};

function hashStringToUint32(seed: string) {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function createSeededGenerator(seed: string) {
  let state = hashStringToUint32(seed) || 1;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function normalizePresetPool(presetPool: TransitionType[]) {
  const cinematic = presetPool.filter((preset) => CINEMATIC_TRANSITION_PRESET_IDS.includes(preset));
  const unique = [...new Set(cinematic)];
  return unique.length > 0 ? unique : (["crossfade"] as TransitionType[]);
}

export function pickTransitionSequence(input: TransitionPickerInput): TransitionType[] {
  const boundaryCount = Math.max(0, Math.floor(input.boundaryCount));
  if (boundaryCount === 0) {
    return [];
  }

  const allowedPool = normalizePresetPool(input.presetPool);
  const nextRandom = createSeededGenerator(input.renderSessionSeed || "transition-seed-default");
  const sequence: TransitionType[] = [];
  let previous: TransitionType | undefined;

  for (let boundaryIndex = 0; boundaryIndex < boundaryCount; boundaryIndex += 1) {
    const candidatePool =
      allowedPool.length > 1 && previous
        ? allowedPool.filter((candidate) => candidate !== previous)
        : allowedPool;
    const selectedIndex = Math.floor(nextRandom() * candidatePool.length);
    const selected = candidatePool[selectedIndex] || candidatePool[0];
    sequence.push(selected);
    previous = selected;
  }

  return sequence;
}
