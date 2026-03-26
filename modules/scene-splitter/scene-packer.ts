import type { PackedScene, ScenePackInput, ScenePackResult, ScenePackSettings } from "@/types/scene";

export const DEFAULT_MIN_SCENE_DURATION_SECONDS = 6;
export const DEFAULT_MAX_SCENE_DURATION_SECONDS = 12;
export const DEFAULT_MAX_OVERSHOOT_SECONDS = 1.5;

function buildSentenceIndexRange(indexes: number[]): string {
  if (indexes.length === 0) {
    return "";
  }

  const first = indexes[0];
  const last = indexes[indexes.length - 1];

  return first === last ? `${first}` : `${first}-${last}`;
}

function uniqueSorted(values: number[]): number[] {
  return [...new Set(values)].sort((left, right) => left - right);
}

export function packSentencesIntoScenes(
  units: ScenePackInput,
  settings: ScenePackSettings,
): ScenePackResult {
  const minSceneDurationSeconds = Math.max(0, settings.minSceneDurationSeconds);
  const maxSceneDurationSeconds = Math.max(
    minSceneDurationSeconds,
    settings.maxSceneDurationSeconds,
  );
  const maxOvershootSeconds = Math.max(0, settings.maxOvershootSeconds ?? DEFAULT_MAX_OVERSHOOT_SECONDS);

  const scenes: PackedScene[] = [];
  let cursor = 0;

  while (cursor < units.length) {
    const startUnit = units[cursor];
    const sourceSentenceIndexes = [startUnit.sourceSentenceIndex];
    const sourceTypes = [startUnit.sourceType];
    const sentenceTexts = [startUnit.text];
    let sceneDuration = startUnit.estimatedDurationSeconds;
    let sceneWordCount = startUnit.wordCount;

    cursor += 1;

    while (cursor < units.length) {
      const nextUnit = units[cursor];
      const proposedDuration = sceneDuration + nextUnit.estimatedDurationSeconds;
      const overshoot = proposedDuration - maxSceneDurationSeconds;
      const canAddWithinOrNearMax =
        proposedDuration <= maxSceneDurationSeconds || overshoot <= maxOvershootSeconds;

      if (sceneDuration < minSceneDurationSeconds) {
        if (!canAddWithinOrNearMax) {
          break;
        }
      } else if (!canAddWithinOrNearMax) {
        break;
      }

      sourceSentenceIndexes.push(nextUnit.sourceSentenceIndex);
      sourceTypes.push(nextUnit.sourceType);
      sentenceTexts.push(nextUnit.text);
      sceneDuration = proposedDuration;
      sceneWordCount += nextUnit.wordCount;
      cursor += 1;
    }

    const uniqueSentenceIndexes = uniqueSorted(sourceSentenceIndexes);
    const uniqueSourceTypes = [...new Set(sourceTypes)];

    scenes.push({
      index: scenes.length + 1,
      text: sentenceTexts.join(" "),
      estimatedDurationSeconds: sceneDuration,
      totalWordCount: sceneWordCount,
      sentenceCount: uniqueSentenceIndexes.length,
      sentenceIndexes: uniqueSentenceIndexes,
      sentenceIndexRange: buildSentenceIndexRange(uniqueSentenceIndexes),
      unitSourceTypes: uniqueSourceTypes,
    });
  }

  const totalEstimatedDurationSeconds = scenes.reduce(
    (sum, scene) => sum + scene.estimatedDurationSeconds,
    0,
  );

  return {
    scenes,
    totalSceneCount: scenes.length,
    totalEstimatedDurationSeconds,
  };
}
