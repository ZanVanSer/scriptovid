import { NextResponse } from "next/server";

import {
  ElevenLabsConnectorError,
  fetchElevenLabsNarrationOptions,
} from "@/modules/voice-generator/elevenlabs";

export const runtime = "nodejs";

type OptionsSuccessResponse = {
  success: true;
  voices: Array<{ id: string; name: string }>;
  models: Array<{ id: string; name: string }>;
};

type OptionsErrorResponse = {
  success: false;
  errorCode: string;
  message: string;
  details?: string;
};

export async function GET() {
  try {
    const options = await fetchElevenLabsNarrationOptions();

    const response: OptionsSuccessResponse = {
      success: true,
      voices: options.voices,
      models: options.models,
    };
    return NextResponse.json(response);
  } catch (error) {
    if (error instanceof ElevenLabsConnectorError) {
      const response: OptionsErrorResponse = {
        success: false,
        errorCode: error.code,
        message: error.message,
        details: error.details,
      };
      return NextResponse.json(response, { status: error.statusCode });
    }

    const response: OptionsErrorResponse = {
      success: false,
      errorCode: "UNKNOWN",
      message: "Unexpected error while loading ElevenLabs options.",
    };
    return NextResponse.json(response, { status: 500 });
  }
}
