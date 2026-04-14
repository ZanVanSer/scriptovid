import { mkdir, readFile, stat } from "node:fs/promises";
import path from "node:path";

import { validateRenderProject } from "@/modules/video-renderer/render-project";
import type {
  RenderBackgroundMusic,
  RenderNarration,
  RenderProject,
  RenderScene,
} from "@/types/render-project";
import { normalizeMotionStrength } from "@/types/render-project";
import { resolveSceneMotionPreset } from "@/remotion/lib/motionPresets";

import type { RemotionRenderProps } from "@/remotion/VideoComposition";

const OUTPUT_DIRECTORY = path.join(/* turbopackIgnore: true */ process.cwd(), "public", "generated", "renders");
const REMOTION_ENTRY = path.join(/* turbopackIgnore: true */ process.cwd(), "remotion", "Root.tsx");
const REMOTION_RENDER_PROJECT_COMPOSITION_ID = "remotion-render-project";
const PUBLIC_DIRECTORY = path.join(/* turbopackIgnore: true */ process.cwd(), "public");

export class RenderPipelineError extends Error {
  readonly stage: "validation" | "media-resolution" | "remotion-render";
  readonly errorCode: string;

  constructor(stage: "validation" | "media-resolution" | "remotion-render", errorCode: string, message: string) {
    super(message);
    this.name = "RenderPipelineError";
    this.stage = stage;
    this.errorCode = errorCode;
  }
}

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

function filePathToPublicUrl(filePath: string) {
  const normalizedPath = path.normalize(filePath);
  const relativeToPublic = path.relative(PUBLIC_DIRECTORY, normalizedPath);
  if (relativeToPublic && !relativeToPublic.startsWith("..") && !path.isAbsolute(relativeToPublic)) {
    return `/${relativeToPublic.replace(/\\/g, "/")}`;
  }
  return undefined;
}

async function resolveSceneImageUrl(scene: RenderScene) {
  const mediaRef = scene.image.mediaRef;
  if (mediaRef.kind === "url") {
    const normalizedUrl = mediaRef.value.trim();
    if (!normalizedUrl) {
      throw new RenderPipelineError(
        "media-resolution",
        "SCENE_IMAGE_URL_EMPTY",
        `Scene ${scene.order} image mediaRef(kind=url) is empty.`,
      );
    }
    if (normalizedUrl.startsWith("data:image/")) {
      return normalizedUrl;
    }
    if (normalizedUrl.startsWith("http://") || normalizedUrl.startsWith("https://")) {
      return normalizedUrl;
    }
    if (normalizedUrl.startsWith("/")) {
      const publicFilePath = path.join(PUBLIC_DIRECTORY, normalizedUrl.slice(1));
      try {
        return await localFileToDataUrl(publicFilePath);
      } catch (error) {
        throw new RenderPipelineError(
          "media-resolution",
          "SCENE_IMAGE_PUBLIC_FILE_READ_FAILED",
          `Scene ${scene.order} image mediaRef(kind=url) could not be read from "${normalizedUrl}": ${
            error instanceof Error ? error.message : "unknown error"
          }`,
        );
      }
    }
    throw new RenderPipelineError(
      "media-resolution",
      "SCENE_IMAGE_URL_INVALID",
      `Scene ${scene.order} image mediaRef(kind=url) must be data:image, /public URL, http://, or https://.`,
    );
  }

  const normalizedFilePath = path.normalize(mediaRef.value);
  try {
    return await localFileToDataUrl(normalizedFilePath);
  } catch (error) {
    const fallbackPublicUrl = filePathToPublicUrl(normalizedFilePath);
    if (fallbackPublicUrl) {
      const fallbackPublicFilePath = path.join(PUBLIC_DIRECTORY, fallbackPublicUrl.slice(1));
      try {
        return await localFileToDataUrl(fallbackPublicFilePath);
      } catch (fallbackError) {
        throw new RenderPipelineError(
          "media-resolution",
          "SCENE_IMAGE_FILE_PATH_READ_FAILED",
          `Scene ${scene.order} image mediaRef(kind=file-path) failed at "${normalizedFilePath}" and fallback "${fallbackPublicUrl}": ${
            fallbackError instanceof Error ? fallbackError.message : "unknown error"
          }`,
        );
      }
    }

    throw new RenderPipelineError(
      "media-resolution",
      "SCENE_IMAGE_FILE_PATH_READ_FAILED",
      `Scene ${scene.order} image mediaRef(kind=file-path) could not be read from "${normalizedFilePath}": ${
        error instanceof Error ? error.message : "unknown error"
      }`,
    );
  }
}

async function resolveNarrationAudioUrl(narration: RenderNarration) {
  const mediaRef = narration.mediaRef;
  if (mediaRef.kind === "url") {
    const normalizedUrl = mediaRef.value.trim();
    if (!normalizedUrl) {
      throw new RenderPipelineError(
        "media-resolution",
        "NARRATION_URL_EMPTY",
        "Narration mediaRef(kind=url) is empty.",
      );
    }
    if (normalizedUrl.startsWith("data:audio/")) {
      return normalizedUrl;
    }
    if (normalizedUrl.startsWith("http://") || normalizedUrl.startsWith("https://")) {
      return normalizedUrl;
    }
    if (normalizedUrl.startsWith("/")) {
      const publicFilePath = path.join(PUBLIC_DIRECTORY, normalizedUrl.slice(1));
      try {
        return await localFileToDataUrl(publicFilePath, narration.mimeType);
      } catch (error) {
        throw new RenderPipelineError(
          "media-resolution",
          "NARRATION_PUBLIC_FILE_READ_FAILED",
          `Narration mediaRef(kind=url) could not be read from "${normalizedUrl}": ${
            error instanceof Error ? error.message : "unknown error"
          }`,
        );
      }
    }
    throw new RenderPipelineError(
      "media-resolution",
      "NARRATION_URL_INVALID",
      "Narration mediaRef(kind=url) must be data:audio, /public URL, http://, or https://.",
    );
  }

  const normalizedFilePath = path.normalize(mediaRef.value);
  try {
    return await localFileToDataUrl(normalizedFilePath, narration.mimeType);
  } catch (error) {
    const fallbackPublicUrl = filePathToPublicUrl(normalizedFilePath);
    if (fallbackPublicUrl) {
      const fallbackPublicFilePath = path.join(PUBLIC_DIRECTORY, fallbackPublicUrl.slice(1));
      try {
        return await localFileToDataUrl(fallbackPublicFilePath, narration.mimeType);
      } catch (fallbackError) {
        throw new RenderPipelineError(
          "media-resolution",
          "NARRATION_FILE_PATH_READ_FAILED",
          `Narration mediaRef(kind=file-path) failed at "${normalizedFilePath}" and fallback "${fallbackPublicUrl}": ${
            fallbackError instanceof Error ? fallbackError.message : "unknown error"
          }`,
        );
      }
    }

    throw new RenderPipelineError(
      "media-resolution",
      "NARRATION_FILE_PATH_READ_FAILED",
      `Narration mediaRef(kind=file-path) could not be read from "${normalizedFilePath}": ${
        error instanceof Error ? error.message : "unknown error"
      }`,
    );
  }
}

async function resolveBackgroundMusicAudioUrl(backgroundMusic: RenderBackgroundMusic) {
  const rawUrl = backgroundMusic.audioUrl;
  if (!rawUrl || !rawUrl.trim()) {
    return null;
  }

  const normalizedUrl = rawUrl.trim();
  if (normalizedUrl.startsWith("data:audio/")) {
    return normalizedUrl;
  }
  if (normalizedUrl.startsWith("http://") || normalizedUrl.startsWith("https://")) {
    return normalizedUrl;
  }
  if (normalizedUrl.startsWith("/")) {
    try {
      const publicFilePath = path.join(PUBLIC_DIRECTORY, normalizedUrl.slice(1));
      return await localFileToDataUrl(publicFilePath);
    } catch (error) {
      console.warn(
        `[remotion-render] background music file could not be loaded and will be skipped: ${
          error instanceof Error ? error.message : "unknown error"
        }`,
      );
      return null;
    }
  }

  console.warn("[remotion-render] background music URL is invalid and will be skipped.");
  return null;
}

function normalizeBackgroundMusicForRemotion(
  backgroundMusic?: RenderBackgroundMusic,
): RemotionRenderProps["backgroundMusic"] {
  const rawVolume = backgroundMusic?.volume;
  const volume = Number.isFinite(rawVolume)
    ? Math.min(100, Math.max(0, Math.round(rawVolume as number)))
    : 25;

  return {
    enabled: Boolean(backgroundMusic?.enabled),
    audioUrl:
      typeof backgroundMusic?.audioUrl === "string" && backgroundMusic.audioUrl.trim()
        ? backgroundMusic.audioUrl.trim()
        : null,
    fileName:
      typeof backgroundMusic?.fileName === "string" && backgroundMusic.fileName.trim()
        ? backgroundMusic.fileName.trim()
        : null,
    duration:
      typeof backgroundMusic?.duration === "number" &&
      Number.isFinite(backgroundMusic.duration) &&
      backgroundMusic.duration > 0
        ? backgroundMusic.duration
        : null,
    loop: Boolean(backgroundMusic?.loop),
    volume,
  };
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
      transitionType: scene.transitionType,
      transitionDurationMs: scene.transitionDurationMs,
      motionPreset: resolveSceneMotionPreset(scene, sceneIndex, renderProject.settings.motion),
    })),
  );
  const narration = renderProject.narration
    ? {
        audioUrl: await resolveNarrationAudioUrl(renderProject.narration),
      }
    : undefined;
  const normalizedBackgroundMusic = normalizeBackgroundMusicForRemotion(renderProject.backgroundMusic);
  const backgroundMusicAudioUrl =
    normalizedBackgroundMusic.enabled && normalizedBackgroundMusic.audioUrl
      ? await resolveBackgroundMusicAudioUrl(normalizedBackgroundMusic)
      : null;

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
    motionStrength: normalizeMotionStrength(renderProject.settings.motion.strength),
    transitions: {
      enabled: renderProject.settings.transitions.enabled,
      durationMs: renderProject.settings.transitions.durationMs,
    },
    scenes,
    narration,
    backgroundMusic: {
      ...normalizedBackgroundMusic,
      audioUrl: backgroundMusicAudioUrl,
    },
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
  let bundle: typeof import("@remotion/bundler").bundle;
  let renderMedia: typeof import("@remotion/renderer").renderMedia;
  let selectComposition: typeof import("@remotion/renderer").selectComposition;
  try {
    const [bundler, renderer] = await Promise.all([
      import("@remotion/bundler"),
      import("@remotion/renderer"),
    ]);
    bundle = bundler.bundle;
    renderMedia = renderer.renderMedia;
    selectComposition = renderer.selectComposition;
  } catch (error) {
    throw new RenderPipelineError(
      "remotion-render",
      "REMOTION_MODULE_LOAD_FAILED",
      `Failed to load Remotion modules: ${error instanceof Error ? error.message : "unknown error"}`,
    );
  }

  const validatedProject = validateRenderProject(renderProject);
  if (!validatedProject.isReady) {
    const firstError = validatedProject.issues.find((issue) => issue.level === "error");
    throw new RenderPipelineError(
      "validation",
      firstError?.code || "RENDER_PROJECT_NOT_READY",
      firstError?.message || "Render project is not ready.",
    );
  }

  let remotionProps: RemotionRenderProps;
  try {
    remotionProps = await convertRenderProjectToRemotionProps(validatedProject);
  } catch (error) {
    if (error instanceof RenderPipelineError) {
      throw error;
    }
    throw new RenderPipelineError(
      "media-resolution",
      "REMOTION_PROPS_BUILD_FAILED",
      `Failed to prepare render media: ${error instanceof Error ? error.message : "unknown error"}`,
    );
  }

  await mkdir(OUTPUT_DIRECTORY, { recursive: true });

  const fileName = outputPath ? path.basename(outputPath) : createRemotionRenderFileName();
  const resolvedOutputPath = outputPath || path.join(OUTPUT_DIRECTORY, fileName);
  const outputUrl = `/generated/renders/${path.basename(resolvedOutputPath)}`;

  let bundledServeUrl: string;
  try {
    bundledServeUrl = await bundle({
      entryPoint: REMOTION_ENTRY,
      publicDir: PUBLIC_DIRECTORY,
      webpackOverride: (webpackConfig) => ({
        ...webpackConfig,
        resolve: {
          ...webpackConfig.resolve,
          alias: {
            ...webpackConfig.resolve?.alias,
            "@": path.resolve(process.cwd()),
          },
        },
      }),
    });
  } catch (error) {
    throw new RenderPipelineError(
      "remotion-render",
      "REMOTION_BUNDLE_FAILED",
      `Failed to bundle Remotion composition: ${error instanceof Error ? error.message : "unknown error"}`,
    );
  }

  let composition: Awaited<ReturnType<typeof selectComposition>>;
  try {
    composition = await selectComposition({
      serveUrl: bundledServeUrl,
      id: REMOTION_RENDER_PROJECT_COMPOSITION_ID,
      inputProps: remotionProps,
    });
  } catch (error) {
    throw new RenderPipelineError(
      "remotion-render",
      "REMOTION_COMPOSITION_SELECT_FAILED",
      `Failed to select Remotion composition: ${error instanceof Error ? error.message : "unknown error"}`,
    );
  }

  try {
    await renderMedia({
      serveUrl: bundledServeUrl,
      composition,
      codec: "h264",
      outputLocation: resolvedOutputPath,
      inputProps: remotionProps,
    });
  } catch (error) {
    throw new RenderPipelineError(
      "remotion-render",
      "REMOTION_RENDER_FAILED",
      `Failed during Remotion render: ${error instanceof Error ? error.message : "unknown error"}`,
    );
  }

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
