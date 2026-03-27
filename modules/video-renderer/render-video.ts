import { access, mkdir, stat } from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";

import { buildFfmpegPrototypeArgs } from "@/modules/video-renderer/ffmpeg-command";
import { validateRenderProject } from "@/modules/video-renderer/render-project";
import type { RenderProject } from "@/types/render-project";

export type RenderVideoSuccessResult = {
  success: true;
  outputPath: string;
  outputUrl: string;
  fileName: string;
  mimeType: "video/mp4";
  fileSize: number;
};

export type RenderVideoErrorResult = {
  success: false;
  errorCode: string;
  message: string;
};

export class RenderVideoError extends Error {
  readonly errorCode: string;

  constructor(errorCode: string, message: string) {
    super(message);
    this.name = "RenderVideoError";
    this.errorCode = errorCode;
  }
}

const OUTPUT_DIRECTORY = path.join(process.cwd(), "public", "generated", "renders");

function ensureFilePathMediaRef(kind: string, value: string, label: string) {
  if (kind !== "file-path") {
    throw new RenderVideoError("UNSUPPORTED_MEDIA_REF", `${label} must use file-path media reference.`);
  }

  if (!value || !value.trim()) {
    throw new RenderVideoError("MEDIA_NOT_RENDERABLE", `${label} media reference is empty.`);
  }
}

function createRenderFileName() {
  const timestamp = new Date().toISOString().replace(/[-:.TZ]/g, "");
  const nonce = Math.random().toString(36).slice(2, 8);
  return `render-${timestamp}-${nonce}.mp4`;
}

async function ensureExistingReadableFile(filePath: string, label: string) {
  try {
    await access(filePath);
  } catch {
    throw new RenderVideoError("MEDIA_NOT_FOUND", `${label} file does not exist or cannot be read.`);
  }
}

function runFfmpeg(args: string[]) {
  return new Promise<void>((resolve, reject) => {
    const command = spawn("ffmpeg", args, { stdio: ["ignore", "pipe", "pipe"] });
    let stderr = "";

    command.stderr.on("data", (chunk) => {
      stderr += String(chunk);
      if (stderr.length > 8000) {
        stderr = stderr.slice(-8000);
      }
    });

    command.on("error", (error) => {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        reject(new RenderVideoError("FFMPEG_NOT_AVAILABLE", "FFmpeg is not installed or not in PATH."));
        return;
      }
      reject(new RenderVideoError("FFMPEG_EXECUTION_FAILED", "FFmpeg process could not be started."));
    });

    command.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      const details = stderr.trim().split("\n").slice(-4).join(" ").slice(0, 300);
      reject(
        new RenderVideoError(
          "FFMPEG_COMMAND_FAILED",
          details ? `FFmpeg rendering failed. ${details}` : "FFmpeg rendering failed.",
        ),
      );
    });
  });
}

export async function renderVideoFromProject(
  renderProject: RenderProject,
): Promise<RenderVideoSuccessResult> {
  const validatedProject = validateRenderProject(renderProject);
  if (!validatedProject.isReady) {
    throw new RenderVideoError("RENDER_PROJECT_NOT_READY", "Render project is not ready.");
  }

  if (validatedProject.scenes.length === 0) {
    throw new RenderVideoError("MISSING_SCENES", "At least one scene is required for rendering.");
  }

  if (!validatedProject.narration) {
    throw new RenderVideoError("MISSING_NARRATION", "Narration is required for rendering.");
  }

  validatedProject.scenes.forEach((scene) => {
    ensureFilePathMediaRef(scene.image.mediaRef.kind, scene.image.mediaRef.value, `Scene ${scene.order} image`);
  });
  ensureFilePathMediaRef(
    validatedProject.narration.mediaRef.kind,
    validatedProject.narration.mediaRef.value,
    "Narration",
  );

  await Promise.all([
    ...validatedProject.scenes.map((scene) =>
      ensureExistingReadableFile(scene.image.mediaRef.value, `Scene ${scene.order} image`),
    ),
    ensureExistingReadableFile(validatedProject.narration.mediaRef.value, "Narration"),
  ]);

  await mkdir(OUTPUT_DIRECTORY, { recursive: true });

  const outputFileName = createRenderFileName();
  const outputPath = path.join(OUTPUT_DIRECTORY, outputFileName);
  const outputUrl = `/generated/renders/${outputFileName}`;
  const ffmpegArgs = buildFfmpegPrototypeArgs({
    renderProject: validatedProject,
    narrationPath: validatedProject.narration.mediaRef.value,
    outputPath,
  });

  await runFfmpeg(ffmpegArgs);
  const outputStats = await stat(outputPath);

  return {
    success: true,
    outputPath,
    outputUrl,
    fileName: outputFileName,
    mimeType: "video/mp4",
    fileSize: outputStats.size,
  };
}
