import { NextResponse } from "next/server";

import { saveUploadedMedia } from "@/modules/media-storage/local-media";

export const runtime = "nodejs";

const ACCEPTED_IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);
const ACCEPTED_IMAGE_EXTENSIONS = [".png", ".jpg", ".jpeg", ".webp"];

type UploadImageSuccessResponse = {
  success: true;
  fileName: string;
  filePath: string;
  publicUrl: string;
  mimeType: string;
  fileSize: number;
};

type UploadImageErrorResponse = {
  success: false;
  errorCode: string;
  message: string;
};

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      const response: UploadImageErrorResponse = {
        success: false,
        errorCode: "INVALID_REQUEST",
        message: "Image file is required.",
      };
      return NextResponse.json(response, { status: 400 });
    }

    const lowerName = file.name.toLowerCase();
    const isAllowedImage =
      ACCEPTED_IMAGE_TYPES.has(file.type) ||
      ACCEPTED_IMAGE_EXTENSIONS.some((extension) => lowerName.endsWith(extension));

    if (!isAllowedImage) {
      const response: UploadImageErrorResponse = {
        success: false,
        errorCode: "UNSUPPORTED_IMAGE_TYPE",
        message: "Only PNG, JPG, and WEBP images are supported.",
      };
      return NextResponse.json(response, { status: 400 });
    }

    const saved = await saveUploadedMedia(file, "image");
    const response: UploadImageSuccessResponse = {
      success: true,
      fileName: saved.fileName,
      filePath: saved.filePath,
      publicUrl: saved.publicUrl,
      mimeType: saved.mimeType,
      fileSize: saved.fileSize,
    };
    return NextResponse.json(response);
  } catch {
    const response: UploadImageErrorResponse = {
      success: false,
      errorCode: "FILE_SAVE_FAILED",
      message: "Image could not be saved locally.",
    };
    return NextResponse.json(response, { status: 500 });
  }
}
