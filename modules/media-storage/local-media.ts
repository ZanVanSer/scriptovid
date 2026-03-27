import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

type MediaKind = "image" | "audio";

export type SaveLocalMediaResult = {
  fileName: string;
  filePath: string;
  publicUrl: string;
  mimeType: string;
  fileSize: number;
};

const MEDIA_DIR_BY_KIND: Record<MediaKind, { absoluteDir: string; publicDir: string; prefix: string }> = {
  image: {
    absoluteDir: path.join(process.cwd(), "public", "generated", "images"),
    publicDir: "/generated/images",
    prefix: "scene-image",
  },
  audio: {
    absoluteDir: path.join(process.cwd(), "public", "generated", "narration"),
    publicDir: "/generated/narration",
    prefix: "narration-manual",
  },
};

const FALLBACK_EXTENSION_BY_KIND: Record<MediaKind, string> = {
  image: ".png",
  audio: ".mp3",
};

const MIME_TO_EXTENSION: Record<string, string> = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/webp": ".webp",
  "audio/mpeg": ".mp3",
  "audio/wav": ".wav",
  "audio/x-wav": ".wav",
  "audio/mp4": ".m4a",
  "audio/aac": ".aac",
  "audio/ogg": ".ogg",
};

function sanitizeBaseName(value: string) {
  const base = value.trim().replace(/\.[^.]+$/, "");
  return base.replace(/[^a-zA-Z0-9_-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "").slice(0, 48);
}

function normalizeExtension(fileName: string, mimeType: string, kind: MediaKind) {
  const fromMime = MIME_TO_EXTENSION[mimeType];
  if (fromMime) {
    return fromMime;
  }

  const nameExtension = path.extname(fileName || "").toLowerCase();
  if (/^\.[a-z0-9]{2,5}$/.test(nameExtension)) {
    return nameExtension;
  }

  return FALLBACK_EXTENSION_BY_KIND[kind];
}

function buildUniqueFileName(kind: MediaKind, sourceFileName: string, mimeType: string) {
  const timestamp = new Date().toISOString().replace(/[-:.TZ]/g, "");
  const nonce = Math.random().toString(36).slice(2, 8);
  const base = sanitizeBaseName(sourceFileName) || MEDIA_DIR_BY_KIND[kind].prefix;
  const extension = normalizeExtension(sourceFileName, mimeType, kind);
  return `${MEDIA_DIR_BY_KIND[kind].prefix}-${timestamp}-${base}-${nonce}${extension}`;
}

export async function saveUploadedMedia(file: File, kind: MediaKind): Promise<SaveLocalMediaResult> {
  const directory = MEDIA_DIR_BY_KIND[kind];
  const mimeType = file.type || "application/octet-stream";
  const fileName = buildUniqueFileName(kind, file.name || directory.prefix, mimeType);
  const filePath = path.join(directory.absoluteDir, fileName);
  const publicUrl = `${directory.publicDir}/${fileName}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  await mkdir(directory.absoluteDir, { recursive: true });
  await writeFile(filePath, buffer);

  return {
    fileName,
    filePath,
    publicUrl,
    mimeType,
    fileSize: buffer.byteLength,
  };
}
