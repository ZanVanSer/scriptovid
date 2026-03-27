import { NextResponse } from "next/server";

import {
  RenderVideoError,
  renderVideoFromProject,
  type RenderVideoErrorResult,
  type RenderVideoSuccessResult,
} from "@/modules/video-renderer/render-video";
import type { RenderProject } from "@/types/render-project";

export const runtime = "nodejs";

type RenderPrototypeRequest = {
  renderProject?: RenderProject;
};

export async function POST(request: Request) {
  let requestBody: RenderPrototypeRequest;

  try {
    requestBody = (await request.json()) as RenderPrototypeRequest;
  } catch {
    const response: RenderVideoErrorResult = {
      success: false,
      errorCode: "INVALID_REQUEST",
      message: "Invalid JSON body.",
    };
    return NextResponse.json(response, { status: 400 });
  }

  if (!requestBody || typeof requestBody !== "object" || !requestBody.renderProject) {
    const response: RenderVideoErrorResult = {
      success: false,
      errorCode: "INVALID_REQUEST",
      message: "renderProject is required.",
    };
    return NextResponse.json(response, { status: 400 });
  }

  try {
    const result = await renderVideoFromProject(requestBody.renderProject);
    const response: RenderVideoSuccessResult = result;
    return NextResponse.json(response);
  } catch (error) {
    if (error instanceof RenderVideoError) {
      const response: RenderVideoErrorResult = {
        success: false,
        errorCode: error.errorCode,
        message: error.message,
      };
      return NextResponse.json(response, { status: 400 });
    }

    const response: RenderVideoErrorResult = {
      success: false,
      errorCode: "UNKNOWN_RENDER_ERROR",
      message: "Unexpected rendering error.",
    };
    return NextResponse.json(response, { status: 500 });
  }
}
