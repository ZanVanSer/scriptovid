export type ScenePackSettings = {
  minSceneDurationSeconds: number;
  maxSceneDurationSeconds: number;
  maxOvershootSeconds?: number;
};

export type TimedUnitSourceType = "sentence" | "fallback-fragment";

export type PackableTimedUnit = {
  sourceSentenceIndex: number;
  sourceType: TimedUnitSourceType;
  text: string;
  wordCount: number;
  estimatedDurationSeconds: number;
};

export type PackedScene = {
  index: number;
  text: string;
  estimatedDurationSeconds: number;
  totalWordCount: number;
  sentenceCount: number;
  sentenceIndexes: number[];
  sentenceIndexRange: string;
  unitSourceTypes: TimedUnitSourceType[];
};

export type ScenePackResult = {
  scenes: PackedScene[];
  totalSceneCount: number;
  totalEstimatedDurationSeconds: number;
};

export type ScenePackInput = PackableTimedUnit[];
