export type ScriptInputValidation = {
  blockingError: string | null;
  advisory: string | null;
};

function countWords(text: string): number {
  const trimmed = text.trim();

  if (!trimmed) {
    return 0;
  }

  return trimmed.split(/\s+/).length;
}

export function validateScriptInput(text: string): ScriptInputValidation {
  if (text.length === 0) {
    return {
      blockingError: "Please paste script text before splitting.",
      advisory: null,
    };
  }

  if (text.trim().length === 0) {
    return {
      blockingError: "Input contains only whitespace. Please add script text.",
      advisory: null,
    };
  }

  const wordCount = countWords(text);

  if (wordCount > 0 && wordCount < 6) {
    return {
      blockingError: null,
      advisory: "Very short input detected; output may result in one scene.",
    };
  }

  return {
    blockingError: null,
    advisory: null,
  };
}

function hasDuplicateParagraphs(normalizedText: string): boolean {
  const paragraphs = normalizedText
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.replace(/\s+/g, " ").trim().toLowerCase())
    .filter((paragraph) => paragraph.length > 0);

  const counts = new Map<string, number>();

  for (const paragraph of paragraphs) {
    const words = countWords(paragraph);

    if (words < 8) {
      continue;
    }

    const nextCount = (counts.get(paragraph) ?? 0) + 1;
    counts.set(paragraph, nextCount);

    if (nextCount > 1) {
      return true;
    }
  }

  return false;
}

function hasLowPunctuation(normalizedText: string): boolean {
  const wordCount = countWords(normalizedText);

  if (wordCount < 20) {
    return false;
  }

  const punctuationCount = (normalizedText.match(/[.!?;:,]/g) ?? []).length;
  const punctuationRatio = punctuationCount / Math.max(wordCount, 1);

  return punctuationRatio < 0.01;
}

export function detectSplitWarnings(normalizedText: string): string[] {
  const warnings: string[] = [];

  if (!normalizedText.trim()) {
    return warnings;
  }

  if (hasDuplicateParagraphs(normalizedText)) {
    warnings.push("Possible duplicated text detected.");
  }

  if (hasLowPunctuation(normalizedText)) {
    warnings.push("Low punctuation detected; scene splitting may be less accurate.");
  }

  return warnings;
}
