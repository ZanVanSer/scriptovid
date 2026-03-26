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

export function packSentencesIntoScenes(
  sentences: ScenePackInput,
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

  while (cursor < sentences.length) {
    const startSentence = sentences[cursor];
    const sentenceIndexes = [startSentence.index];
    const sentenceTexts = [startSentence.text];
    let sceneDuration = startSentence.estimatedDurationSeconds;
    let sceneWordCount = startSentence.wordCount;

    cursor += 1;

    // Keep long standalone sentences as one scene for this phase.
    if (startSentence.estimatedDurationSeconds <= maxSceneDurationSeconds) {
      while (cursor < sentences.length) {
        const nextSentence = sentences[cursor];
        const proposedDuration = sceneDuration + nextSentence.estimatedDurationSeconds;
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

        sentenceIndexes.push(nextSentence.index);
        sentenceTexts.push(nextSentence.text);
        sceneDuration = proposedDuration;
        sceneWordCount += nextSentence.wordCount;
        cursor += 1;
      }
    }

    scenes.push({
      index: scenes.length + 1,
      text: sentenceTexts.join(" "),
      estimatedDurationSeconds: sceneDuration,
      totalWordCount: sceneWordCount,
      sentenceCount: sentenceIndexes.length,
      sentenceIndexes,
      sentenceIndexRange: buildSentenceIndexRange(sentenceIndexes),
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
