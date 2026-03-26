import type { SentenceDebugItem } from "@/types/sentence";

export type ScenePackSettings = {
  minSceneDurationSeconds: number;
  maxSceneDurationSeconds: number;
  maxOvershootSeconds?: number;
};

export type PackedScene = {
  index: number;
  text: string;
  estimatedDurationSeconds: number;
  totalWordCount: number;
  sentenceCount: number;
  sentenceIndexes: number[];
  sentenceIndexRange: string;
};

export type ScenePackResult = {
  scenes: PackedScene[];
  totalSceneCount: number;
  totalEstimatedDurationSeconds: number;
};

export type ScenePackInput = SentenceDebugItem[];
