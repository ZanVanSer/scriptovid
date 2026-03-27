import { NextResponse } from "next/server";

import {
  ElevenLabsConnectorError,
  generateElevenLabsNarration,
  normalizeElevenLabsNarrationRequest,
  type GenerateElevenLabsNarrationRequest,
} from "@/modules/voice-generator/elevenlabs";

export const runtime = "nodejs";

type NarrationGenerateSuccessResponse = {
  success: true;
  audioUrl: string;
  audioPath: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  provider: "elevenlabs";
  voiceId: string;
  modelId: string;
};

type NarrationGenerateErrorResponse = {
  success: false;
  errorCode: string;
  message: string;
  details?: string;
};

function parseRequestBody(body: unknown): GenerateElevenLabsNarrationRequest {
  if (!body || typeof body !== "object") {
    throw new ElevenLabsConnectorError("INVALID_REQUEST", "Request body must be a JSON object.", 400);
  }

  const candidate = body as Record<string, unknown>;
  return {
    text: candidate.text as string,
    voiceId: candidate.voiceId as string,
    modelId: candidate.modelId as string,
    stability: candidate.stability as number | undefined,
    similarityBoost: candidate.similarityBoost as number | undefined,
    style: candidate.style as number | undefined,
    useSpeakerBoost: candidate.useSpeakerBoost as boolean | undefined,
  };
}

export async function POST(request: Request) {
  let rawBody: unknown;

  try {
    rawBody = await request.json();
  } catch {
    const invalidJsonResponse: NarrationGenerateErrorResponse = {
      success: false,
      errorCode: "INVALID_REQUEST",
      message: "Invalid JSON body.",
    };
    return NextResponse.json(invalidJsonResponse, { status: 400 });
  }

  try {
    const parsedBody = parseRequestBody(rawBody);
    const normalizedInput = normalizeElevenLabsNarrationRequest(parsedBody);
    const generated = await generateElevenLabsNarration(normalizedInput);

    const successResponse: NarrationGenerateSuccessResponse = {
      success: true,
      audioUrl: generated.audioUrl,
      audioPath: generated.audioPath,
      fileName: generated.fileName,
      mimeType: generated.mimeType,
      fileSize: generated.fileSize,
      provider: generated.provider,
      voiceId: generated.voiceId,
      modelId: generated.modelId,
    };

    return NextResponse.json(successResponse);
  } catch (error) {
    if (error instanceof ElevenLabsConnectorError) {
      const normalizedError: NarrationGenerateErrorResponse = {
        success: false,
        errorCode: error.code,
        message: error.message,
        details: error.details,
      };

      return NextResponse.json(normalizedError, { status: error.statusCode });
    }

    const unknownError: NarrationGenerateErrorResponse = {
      success: false,
      errorCode: "UNKNOWN",
      message: "Unexpected narration generation error.",
    };
    return NextResponse.json(unknownError, { status: 500 });
  }
}
