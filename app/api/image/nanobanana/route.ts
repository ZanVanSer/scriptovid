import { NextResponse } from "next/server";

import {
  NANOBANANA_MODELS,
  NanobananaError,
  generateNanobananaImage,
  type NanobananaModel,
} from "@/modules/image-generation/nanobanana";

export const runtime = "nodejs";

type GenerateNanobananaRequest = {
  prompt?: string;
  model?: string;
  aspectRatio?: "16:9" | "9:16" | "1:1" | "4:3" | "3:4" | "3:2" | "2:3" | "21:9";
  apiKeyOverride?: string;
};

type GenerateNanobananaSuccessResponse = {
  success: true;
  imageUrl: string;
  mimeType: string;
};

type GenerateNanobananaErrorResponse = {
  success: false;
  errorCode: string;
  message: string;
};

function normalizeModel(value: string | undefined): NanobananaModel {
  const normalized = (value || "").trim();
  if (!NANOBANANA_MODELS.includes(normalized as NanobananaModel)) {
    throw new NanobananaError("Unsupported Nanobanana model.", 400);
  }

  return normalized as NanobananaModel;
}

function resolveApiKey(apiKeyOverride?: string) {
  const override = apiKeyOverride?.trim();
  if (override) {
    return override;
  }

  const serverApiKey = process.env.GEMINI_API_KEY?.trim();
  if (serverApiKey) {
    return serverApiKey;
  }

  throw new NanobananaError("Gemini API key is missing. Set GEMINI_API_KEY or provide a local override key.", 400);
}

export async function POST(request: Request) {
  let rawBody: GenerateNanobananaRequest;

  try {
    rawBody = (await request.json()) as GenerateNanobananaRequest;
  } catch {
    const response: GenerateNanobananaErrorResponse = {
      success: false,
      errorCode: "INVALID_REQUEST",
      message: "Invalid JSON body.",
    };
    return NextResponse.json(response, { status: 400 });
  }

  const prompt = (rawBody.prompt || "").trim();
  if (!prompt) {
    const response: GenerateNanobananaErrorResponse = {
      success: false,
      errorCode: "INVALID_REQUEST",
      message: "Image prompt cannot be empty.",
    };
    return NextResponse.json(response, { status: 400 });
  }

  try {
    const model = normalizeModel(rawBody.model);
    const apiKey = resolveApiKey(rawBody.apiKeyOverride);
    const generated = await generateNanobananaImage({
      prompt,
      model,
      apiKey,
      aspectRatio: rawBody.aspectRatio || "16:9",
    });

    const response: GenerateNanobananaSuccessResponse = {
      success: true,
      imageUrl: generated.imageUrl,
      mimeType: generated.mimeType,
    };
    return NextResponse.json(response);
  } catch (error) {
    if (error instanceof NanobananaError) {
      const response: GenerateNanobananaErrorResponse = {
        success: false,
        errorCode: "GENERATION_FAILED",
        message: error.message,
      };
      return NextResponse.json(response, { status: error.statusCode || 500 });
    }

    const response: GenerateNanobananaErrorResponse = {
      success: false,
      errorCode: "UNKNOWN",
      message: "Unexpected image generation error.",
    };
    return NextResponse.json(response, { status: 500 });
  }
}
