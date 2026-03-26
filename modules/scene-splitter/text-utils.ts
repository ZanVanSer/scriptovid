import { textToSentences } from "blingfire";
import { DEFAULT_WORDS_PER_MINUTE } from "@/modules/scene-splitter/constants";

export function normalizeText(raw: string): string {
  const normalizedLineEndings = raw.replace(/\r\n?/g, "\n").trim();

  if (!normalizedLineEndings) {
    return "";
  }

  const collapsedLineSpaces = normalizedLineEndings
    .split("\n")
    .map((line) => line.replace(/[ \t]{2,}/g, " ").trim())
    .join("\n");

  const collapsedBlankLines = collapsedLineSpaces.replace(/\n{3,}/g, "\n\n");

  return collapsedBlankLines;
}

export function splitSentences(normalizedText: string): string[] {
  if (!normalizedText) {
    return [];
  }

  const sentenceBlob = textToSentences(normalizedText);

  return sentenceBlob
    .split("\n")
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 0);
}

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
