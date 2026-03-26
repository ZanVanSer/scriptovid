import { NextResponse } from "next/server";

import {
  countWords,
  estimateDurationSeconds,
  normalizeText,
} from "@/modules/scene-splitter/text-utils";
import { buildParagraphSentenceItems } from "@/modules/scene-splitter/paragraph-utils";
import type { SentenceSplitRequest, SentenceSplitResponse } from "@/types/sentence";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let body: SentenceSplitRequest;

  try {
    body = (await request.json()) as SentenceSplitRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const rawText = typeof body.text === "string" ? body.text : "";
  const normalizedText = normalizeText(rawText);
  const sentenceItems = buildParagraphSentenceItems(normalizedText);
  const sentences = sentenceItems.map((item, index) => {
    const text = item.text;
    const wordCount = countWords(text);

    return {
      index: index + 1,
      text,
      wordCount,
      estimatedDurationSeconds: estimateDurationSeconds(wordCount),
      paragraphIndex: item.paragraphIndex,
      startsNewParagraph: item.startsNewParagraph,
    };
  });

  const totalWordCount = sentences.reduce((sum, sentence) => sum + sentence.wordCount, 0);
  const totalEstimatedDurationSeconds = sentences.reduce(
    (sum, sentence) => sum + sentence.estimatedDurationSeconds,
    0,
  );

  const response: SentenceSplitResponse = {
    normalizedText,
    sentenceCount: sentences.length,
    totalWordCount,
    totalEstimatedDurationSeconds,
    sentences,
  };

  return NextResponse.json(response);
}
