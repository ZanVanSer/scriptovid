import { NextResponse } from "next/server";

import { saveUploadedMedia } from "@/modules/media-storage/local-media";

export const runtime = "nodejs";

const ACCEPTED_AUDIO_TYPES = new Set([
  "audio/mpeg",
  "audio/wav",
  "audio/x-wav",
  "audio/mp4",
  "audio/aac",
  "audio/ogg",
]);
const ACCEPTED_AUDIO_EXTENSIONS = [".mp3", ".wav", ".m4a", ".aac", ".ogg"];

type UploadAudioSuccessResponse = {
  success: true;
  fileName: string;
  filePath: string;
  audioUrl: string;
  mimeType: string;
  fileSize: number;
};

type UploadAudioErrorResponse = {
  success: false;
  errorCode: string;
  message: string;
};

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      const response: UploadAudioErrorResponse = {
        success: false,
        errorCode: "INVALID_REQUEST",
        message: "Audio file is required.",
      };
      return NextResponse.json(response, { status: 400 });
    }

    const lowerName = file.name.toLowerCase();
    const isAllowedAudio =
      ACCEPTED_AUDIO_TYPES.has(file.type) ||
      ACCEPTED_AUDIO_EXTENSIONS.some((extension) => lowerName.endsWith(extension));

    if (!isAllowedAudio) {
      const response: UploadAudioErrorResponse = {
        success: false,
        errorCode: "UNSUPPORTED_AUDIO_TYPE",
        message: "Only MP3, WAV, M4A, AAC, and OGG files are supported.",
      };
      return NextResponse.json(response, { status: 400 });
    }

    const saved = await saveUploadedMedia(file, "audio");
    const response: UploadAudioSuccessResponse = {
      success: true,
      fileName: saved.fileName,
      filePath: saved.filePath,
      audioUrl: saved.publicUrl,
      mimeType: saved.mimeType,
      fileSize: saved.fileSize,
    };
    return NextResponse.json(response);
  } catch {
    const response: UploadAudioErrorResponse = {
      success: false,
      errorCode: "FILE_SAVE_FAILED",
      message: "Audio could not be saved locally.",
    };
    return NextResponse.json(response, { status: 500 });
  }
}
