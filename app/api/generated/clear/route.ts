import { mkdir, rm } from "node:fs/promises";
import path from "node:path";

import { NextResponse } from "next/server";

export const runtime = "nodejs";

type ClearGeneratedSuccessResponse = {
  success: true;
  message: string;
};

type ClearGeneratedErrorResponse = {
  success: false;
  errorCode: string;
  message: string;
};

const GENERATED_ROOT_DIR = path.join(process.cwd(), "public", "generated");

export async function POST() {
  try {
    await rm(GENERATED_ROOT_DIR, { recursive: true, force: true });
    await mkdir(GENERATED_ROOT_DIR, { recursive: true });

    const response: ClearGeneratedSuccessResponse = {
      success: true,
      message: "Generated files were cleared.",
    };
    return NextResponse.json(response);
  } catch {
    const response: ClearGeneratedErrorResponse = {
      success: false,
      errorCode: "CLEAR_FAILED",
      message: "Could not clear generated files.",
    };
    return NextResponse.json(response, { status: 500 });
  }
}
