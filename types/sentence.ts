export type SentenceDebugItem = {
  index: number;
  text: string;
  wordCount: number;
  estimatedDurationSeconds: number;
};

export type SentenceSplitRequest = {
  text: string;
};

export type SentenceSplitResponse = {
  normalizedText: string;
  sentenceCount: number;
  totalWordCount: number;
  totalEstimatedDurationSeconds: number;
  sentences: SentenceDebugItem[];
};
