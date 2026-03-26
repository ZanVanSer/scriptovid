import { DEFAULT_WORDS_PER_MINUTE } from "@/modules/scene-splitter/constants";

export function countWords(sentence: string): number {
  const trimmed = sentence.trim();

  if (!trimmed) {
    return 0;
  }

  return trimmed.split(/\s+/).length;
}

export function estimateDurationSeconds(
  wordCount: number,
  wordsPerMinute = DEFAULT_WORDS_PER_MINUTE,
): number {
  if (wordCount <= 0 || wordsPerMinute <= 0) {
    return 0;
  }

  return (wordCount / wordsPerMinute) * 60;
}
