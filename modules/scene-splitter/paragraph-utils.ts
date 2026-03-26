import { splitSentences } from "@/modules/scene-splitter/text-utils";

export type ParagraphSentenceItem = {
  text: string;
  paragraphIndex: number;
  startsNewParagraph: boolean;
};

export function splitNormalizedTextIntoParagraphs(normalizedText: string): string[] {
  const paragraphs = normalizedText
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => paragraph.length > 0);

  return paragraphs.length > 0 ? paragraphs : [];
}

export function buildParagraphSentenceItems(normalizedText: string): ParagraphSentenceItem[] {
  const paragraphs = splitNormalizedTextIntoParagraphs(normalizedText);
  const items: ParagraphSentenceItem[] = [];

  paragraphs.forEach((paragraph, paragraphOffset) => {
    const paragraphIndex = paragraphOffset + 1;
    const paragraphSentences = splitSentences(paragraph);

    paragraphSentences.forEach((sentenceText, sentenceOffset) => {
      items.push({
        text: sentenceText,
        paragraphIndex,
        startsNewParagraph: sentenceOffset === 0,
      });
    });
  });

  return items;
}
