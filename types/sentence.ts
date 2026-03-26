export type SentenceDebugItem = {
  index: number;
  text: string;
  wordCount: number;
};

export type SentenceSplitRequest = {
  text: string;
};

export type SentenceSplitResponse = {
  normalizedText: string;
  sentenceCount: number;
  sentences: SentenceDebugItem[];
};
