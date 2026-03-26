import { DEFAULT_WORDS_PER_MINUTE } from "@/modules/scene-splitter/constants";
import { countWords, estimateDurationSeconds } from "@/modules/scene-splitter/timing-utils";
import type { PackableTimedUnit } from "@/types/scene";
import type { SentenceDebugItem } from "@/types/sentence";

export const MIN_FALLBACK_FRAGMENT_WORDS = 4;

export function isOversizedSentence(
  sentence: SentenceDebugItem,
  maxSceneDurationSeconds: number,
): boolean {
  return sentence.estimatedDurationSeconds > maxSceneDurationSeconds;
}

function normalizeFragments(fragments: string[]): string[] {
  return fragments.map((fragment) => fragment.trim()).filter((fragment) => fragment.length > 0);
}

export function cleanupAndMergeTinyFragments(
  fragments: string[],
  minWords = MIN_FALLBACK_FRAGMENT_WORDS,
): string[] {
  const normalized = normalizeFragments(fragments);

  if (normalized.length <= 1) {
    return normalized;
  }

  const merged: string[] = [];

  for (const fragment of normalized) {
    if (merged.length === 0) {
      merged.push(fragment);
      continue;
    }

    if (countWords(fragment) < minWords) {
      merged[merged.length - 1] = `${merged[merged.length - 1]} ${fragment}`.trim();
      continue;
    }

    merged.push(fragment);
  }

  if (merged.length > 1 && countWords(merged[merged.length - 1]) < minWords) {
    merged[merged.length - 2] = `${merged[merged.length - 2]} ${merged[merged.length - 1]}`.trim();
    merged.pop();
  }

  return merged;
}

function splitByCapturedBoundary(text: string, boundaryPattern: RegExp): string[] {
  const tokens = text.split(boundaryPattern);

  if (tokens.length <= 1) {
    return [text];
  }

  const fragments: string[] = [];

  for (let index = 0; index < tokens.length; index += 2) {
    const body = tokens[index] ?? "";
    const boundary = tokens[index + 1] ?? "";
    const fragment = `${body}${boundary}`.trim();

    if (fragment) {
      fragments.push(fragment);
    }
  }

  return fragments.length > 0 ? fragments : [text];
}

function splitByConjunctions(text: string): string[] {
  const pieces = text
    .split(/\s+(?=(?:and|but|while|because|so|which)\b)/gi)
    .map((piece) => piece.trim())
    .filter((piece) => piece.length > 0);

  return pieces.length > 0 ? pieces : [text];
}

function chunkByWordCount(
  text: string,
  maxSceneDurationSeconds: number,
  wordsPerMinute: number,
  minWords = MIN_FALLBACK_FRAGMENT_WORDS,
): string[] {
  const words = text.trim().split(/\s+/).filter((word) => word.length > 0);

  if (words.length === 0) {
    return [];
  }

  const maxWordsPerChunk = Math.max(
    minWords,
    Math.floor((maxSceneDurationSeconds / 60) * wordsPerMinute),
  );

  if (words.length <= maxWordsPerChunk) {
    return [text.trim()];
  }

  const chunks: string[] = [];

  for (let cursor = 0; cursor < words.length; cursor += maxWordsPerChunk) {
    chunks.push(words.slice(cursor, cursor + maxWordsPerChunk).join(" "));
  }

  return cleanupAndMergeTinyFragments(chunks, minWords);
}

export function splitOversizedSentence(
  text: string,
  maxSceneDurationSeconds: number,
  wordsPerMinute = DEFAULT_WORDS_PER_MINUTE,
  minWords = MIN_FALLBACK_FRAGMENT_WORDS,
): string[] {
  let fragments = [text.trim()];

  const boundaryStrategies: Array<(value: string) => string[]> = [
    (value) => splitByCapturedBoundary(value, /(\s*;\s*)/g),
    (value) => splitByCapturedBoundary(value, /(\s*:\s*)/g),
    (value) => splitByCapturedBoundary(value, /(\s*[—-]\s*)/g),
    (value) => splitByCapturedBoundary(value, /(\s*,\s*)/g),
    (value) => splitByConjunctions(value),
  ];

  for (const strategy of boundaryStrategies) {
    const nextFragments: string[] = [];

    for (const fragment of fragments) {
      const fragmentDuration = estimateDurationSeconds(countWords(fragment), wordsPerMinute);

      if (fragmentDuration <= maxSceneDurationSeconds) {
        nextFragments.push(fragment);
        continue;
      }

      const splitAttempt = cleanupAndMergeTinyFragments(strategy(fragment), minWords);

      if (splitAttempt.length <= 1) {
        nextFragments.push(fragment);
        continue;
      }

      nextFragments.push(...splitAttempt);
    }

    fragments = cleanupAndMergeTinyFragments(nextFragments, minWords);
  }

  const wordChunkedFragments: string[] = [];

  for (const fragment of fragments) {
    const fragmentDuration = estimateDurationSeconds(countWords(fragment), wordsPerMinute);

    if (fragmentDuration <= maxSceneDurationSeconds) {
      wordChunkedFragments.push(fragment);
      continue;
    }

    wordChunkedFragments.push(
      ...chunkByWordCount(fragment, maxSceneDurationSeconds, wordsPerMinute, minWords),
    );
  }

  return cleanupAndMergeTinyFragments(wordChunkedFragments, minWords);
}

export function toPackableTimedUnits(
  sentences: SentenceDebugItem[],
  maxSceneDurationSeconds: number,
  wordsPerMinute = DEFAULT_WORDS_PER_MINUTE,
): PackableTimedUnit[] {
  const units: PackableTimedUnit[] = [];

  for (const sentence of sentences) {
    if (!isOversizedSentence(sentence, maxSceneDurationSeconds)) {
      units.push({
        sourceSentenceIndex: sentence.index,
        sourceType: "sentence",
        text: sentence.text,
        wordCount: sentence.wordCount,
        estimatedDurationSeconds: sentence.estimatedDurationSeconds,
      });
      continue;
    }

    const fragments = splitOversizedSentence(sentence.text, maxSceneDurationSeconds, wordsPerMinute);
    const sourceType = fragments.length > 1 ? "fallback-fragment" : "sentence";

    for (const fragment of fragments) {
      const wordCount = countWords(fragment);

      units.push({
        sourceSentenceIndex: sentence.index,
        sourceType,
        text: fragment,
        wordCount,
        estimatedDurationSeconds: estimateDurationSeconds(wordCount, wordsPerMinute),
      });
    }
  }

  return units;
}
