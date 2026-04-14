import { NextResponse } from "next/server";

import { RenderPipelineError, renderVideoWithRemotion } from "@/lib/render/remotionRenderer";
import type { RenderProject } from "@/types/render-project";

export const runtime = "nodejs";

type RenderPrototypeRequest = {
  renderProject?: RenderProject;
};

type RenderPrototypeSuccessResult = {
  success: true;
  outputPath: string;
  outputUrl: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
};

type RenderPrototypeErrorResult = {
  success: false;
  errorCode: string;
  message: string;
};

export async function POST(request: Request) {
  let requestBody: RenderPrototypeRequest;

  try {
    requestBody = (await request.json()) as RenderPrototypeRequest;
  } catch {
    const response: RenderPrototypeErrorResult = {
      success: false,
      errorCode: "INVALID_REQUEST",
      message: "Invalid JSON body.",
    };
    return NextResponse.json(response, { status: 400 });
  }

  if (!requestBody || typeof requestBody !== "object") {
    const response: RenderPrototypeErrorResult = {
      success: false,
      errorCode: "INVALID_REQUEST",
      message: "Request body is required.",
    };
    return NextResponse.json(response, { status: 400 });
  }

  if (!requestBody.renderProject) {
    const response: RenderPrototypeErrorResult = {
      success: false,
      errorCode: "INVALID_REQUEST",
      message: "renderProject is required.",
    };
    return NextResponse.json(response, { status: 400 });
  }

  try {
    const result = await renderVideoWithRemotion(requestBody.renderProject);
    const response: RenderPrototypeSuccessResult = result;
    return NextResponse.json(response);
  } catch (error) {
    if (error instanceof RenderPipelineError) {
      const response: RenderPrototypeErrorResult = {
        success: false,
        errorCode: error.errorCode,
        message: `[${error.stage}] ${error.message}`,
      };
      return NextResponse.json(response, { status: 400 });
    }

    const response: RenderPrototypeErrorResult = {
      success: false,
      errorCode: "REMOTION_RENDER_ERROR",
      message: error instanceof Error ? error.message : "Unexpected rendering error.",
    };
    return NextResponse.json(response, { status: 400 });
  }
}
