import { mkdir, readFile, stat } from "node:fs/promises";
import path from "node:path";

import { validateRenderProject } from "@/modules/video-renderer/render-project";
import type { RenderNarration, RenderProject, RenderScene } from "@/types/render-project";
import { resolveSceneMotionPreset } from "@/remotion/lib/motionPresets";

import type { RemotionRenderProps } from "@/remotion/VideoComposition";

const OUTPUT_DIRECTORY = path.join(/* turbopackIgnore: true */ process.cwd(), "public", "generated", "renders");
const REMOTION_ENTRY = path.join(/* turbopackIgnore: true */ process.cwd(), "remotion", "Root.tsx");
const REMOTION_RENDER_PROJECT_COMPOSITION_ID = "remotion-render-project";
const PUBLIC_DIRECTORY = path.join(/* turbopackIgnore: true */ process.cwd(), "public");

function createRemotionRenderFileName() {
  const timestamp = new Date().toISOString().replace(/[-:.TZ]/g, "");
  const nonce = Math.random().toString(36).slice(2, 8);
  return `render-${timestamp}-${nonce}.mp4`;
}

function secondsToFrames(seconds: number, fps: number) {
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return 1;
  }

  return Math.max(1, Math.round(seconds * fps));
}

function inferMimeTypeFromFilePath(filePath: string) {
  const extension = path.extname(filePath).toLowerCase();
  if (extension === ".jpg" || extension === ".jpeg") {
    return "image/jpeg";
  }
  if (extension === ".webp") {
    return "image/webp";
  }
  if (extension === ".gif") {
    return "image/gif";
  }
  if (extension === ".svg") {
    return "image/svg+xml";
  }
  if (extension === ".mp3") {
    return "audio/mpeg";
  }
  if (extension === ".wav") {
    return "audio/wav";
  }
  if (extension === ".m4a") {
    return "audio/mp4";
  }
  if (extension === ".aac") {
    return "audio/aac";
  }
  if (extension === ".ogg") {
    return "audio/ogg";
  }
  return "image/png";
}

async function localFileToDataUrl(filePath: string, explicitMimeType?: string) {
  const fileBuffer = await readFile(filePath);
  const mimeType = explicitMimeType || inferMimeTypeFromFilePath(filePath);
  return `data:${mimeType};base64,${fileBuffer.toString("base64")}`;
}

async function resolveSceneImageUrl(scene: RenderScene) {
  const mediaRef = scene.image.mediaRef;
  if (mediaRef.kind === "url") {
    const normalizedUrl = mediaRef.value.trim();
    if (!normalizedUrl) {
      throw new Error(`Scene ${scene.order} image URL is empty.`);
    }
    if (normalizedUrl.startsWith("data:image/")) {
      return normalizedUrl;
    }
    if (normalizedUrl.startsWith("http://") || normalizedUrl.startsWith("https://")) {
      return normalizedUrl;
    }
    if (normalizedUrl.startsWith("/")) {
      const publicFilePath = path.join(PUBLIC_DIRECTORY, normalizedUrl.slice(1));
      return localFileToDataUrl(publicFilePath);
    }
    throw new Error(`Scene ${scene.order} image URL must be absolute (/, http://, or https://).`);
  }

  const normalizedFilePath = path.normalize(mediaRef.value);
  return localFileToDataUrl(normalizedFilePath);
}

async function resolveNarrationAudioUrl(narration: RenderNarration) {
  const mediaRef = narration.mediaRef;
  if (mediaRef.kind === "url") {
    const normalizedUrl = mediaRef.value.trim();
    if (!normalizedUrl) {
      throw new Error("Narration URL is empty.");
    }
    if (normalizedUrl.startsWith("data:audio/")) {
      return normalizedUrl;
    }
    if (normalizedUrl.startsWith("http://") || normalizedUrl.startsWith("https://")) {
      return normalizedUrl;
    }
    if (normalizedUrl.startsWith("/")) {
      const publicFilePath = path.join(PUBLIC_DIRECTORY, normalizedUrl.slice(1));
      return localFileToDataUrl(publicFilePath, narration.mimeType);
    }
    throw new Error("Narration URL must be absolute (/, http://, or https://).");
  }

  const normalizedFilePath = path.normalize(mediaRef.value);
  return localFileToDataUrl(normalizedFilePath, narration.mimeType);
}

export async function convertRenderProjectToRemotionProps(
  renderProject: RenderProject,
): Promise<RemotionRenderProps> {
  const fps = renderProject.settings.fps;
  const width = renderProject.settings.width;
  const height = renderProject.settings.height;
  const scenes = await Promise.all(
    renderProject.scenes.map(async (scene, sceneIndex) => ({
      id: scene.id || String(scene.order),
      imageUrl: await resolveSceneImageUrl(scene),
      durationFrames: secondsToFrames(scene.finalDuration, fps),
      motionPreset: resolveSceneMotionPreset(scene, sceneIndex, renderProject.settings.motion),
    })),
  );
  const narration = renderProject.narration
    ? {
        audioUrl: await resolveNarrationAudioUrl(renderProject.narration),
      }
    : undefined;

  const totalSceneFrames = scenes.reduce((sum, scene) => sum + scene.durationFrames, 0);
  if (
    renderProject.narrationDuration !== undefined &&
    Number.isFinite(renderProject.narrationDuration) &&
    renderProject.narrationDuration > 0
  ) {
    const narrationDurationFrames = secondsToFrames(renderProject.narrationDuration, fps);
    if (Math.abs(totalSceneFrames - narrationDurationFrames) > 1) {
      console.warn(
        `[remotion-render] timeline/narration frame delta=${Math.abs(totalSceneFrames - narrationDurationFrames)}`,
      );
    }
  }

  return {
    width,
    height,
    fps,
    motionStrength: renderProject.settings.motion.strength,
    scenes,
    narration,
  };
}

export type RemotionRenderSuccessResult = {
  success: true;
  outputPath: string;
  outputUrl: string;
  fileName: string;
  fileSize: number;
  mimeType: "video/mp4";
};

export async function renderVideoWithRemotion(
  renderProject: RenderProject,
  outputPath?: string,
): Promise<RemotionRenderSuccessResult> {
  const [{ bundle }, { renderMedia, selectComposition }] = await Promise.all([
    import("@remotion/bundler"),
    import("@remotion/renderer"),
  ]);

  const validatedProject = validateRenderProject(renderProject);
  if (!validatedProject.isReady) {
    throw new Error("Render project is not ready.");
  }

  const remotionProps = await convertRenderProjectToRemotionProps(validatedProject);

  await mkdir(OUTPUT_DIRECTORY, { recursive: true });

  const fileName = outputPath ? path.basename(outputPath) : createRemotionRenderFileName();
  const resolvedOutputPath = outputPath || path.join(OUTPUT_DIRECTORY, fileName);
  const outputUrl = `/generated/renders/${path.basename(resolvedOutputPath)}`;

  const bundledServeUrl = await bundle({
    entryPoint: REMOTION_ENTRY,
    publicDir: PUBLIC_DIRECTORY,
  });

  const composition = await selectComposition({
    serveUrl: bundledServeUrl,
    id: REMOTION_RENDER_PROJECT_COMPOSITION_ID,
    inputProps: remotionProps,
  });

  await renderMedia({
    serveUrl: bundledServeUrl,
    composition,
    codec: "h264",
    outputLocation: resolvedOutputPath,
    inputProps: remotionProps,
  });

  const outputStats = await stat(resolvedOutputPath);

  return {
    success: true,
    outputPath: resolvedOutputPath,
    outputUrl,
    fileName: path.basename(resolvedOutputPath),
    fileSize: outputStats.size,
    mimeType: "video/mp4",
  };
}
