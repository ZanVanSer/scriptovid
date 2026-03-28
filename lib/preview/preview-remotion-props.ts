import type { RenderMediaRef, RenderProject } from "@/types/render-project";
import type { RemotionRenderProps } from "@/remotion/VideoComposition";
import { resolveSceneMotionPreset } from "@/remotion/lib/motionPresets";

type PreviewPropsResult =
  | {
      ok: true;
      props: RemotionRenderProps;
    }
  | {
      ok: false;
      message: string;
    };

function secondsToFrames(seconds: number, fps: number) {
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return 1;
  }

  return Math.max(1, Math.round(seconds * fps));
}

function filePathToPublicUrl(filePath: string) {
  const normalizedPath = filePath.replace(/\\/g, "/");
  const publicMarker = "/public/";
  const markerIndex = normalizedPath.lastIndexOf(publicMarker);
  if (markerIndex < 0) {
    return undefined;
  }

  const relativePath = normalizedPath.slice(markerIndex + publicMarker.length);
  if (!relativePath) {
    return undefined;
  }

  return `/${relativePath}`;
}

function resolveMediaRefToBrowserUrl(
  mediaRef: RenderMediaRef,
  fallbackUrl?: string | null,
): string | undefined {
  if (mediaRef.kind === "url") {
    const value = mediaRef.value.trim();
    if (!value) {
      return undefined;
    }

    if (
      value.startsWith("/") ||
      value.startsWith("http://") ||
      value.startsWith("https://") ||
      value.startsWith("data:")
    ) {
      return value;
    }

    return undefined;
  }

  const fromFilePath = filePathToPublicUrl(mediaRef.value);
  if (fromFilePath) {
    return fromFilePath;
  }

  if (typeof fallbackUrl === "string" && fallbackUrl.trim()) {
    return fallbackUrl.trim();
  }

  return undefined;
}

export function convertRenderProjectToPreviewRemotionProps(renderProject: RenderProject): PreviewPropsResult {
  const fps = renderProject.settings.fps;
  const width = renderProject.settings.width;
  const height = renderProject.settings.height;

  if (!Array.isArray(renderProject.scenes) || renderProject.scenes.length === 0) {
    return {
      ok: false,
      message: "Preview data has no scenes.",
    };
  }

  const scenes: RemotionRenderProps["scenes"] = [];
  for (let sceneIndex = 0; sceneIndex < renderProject.scenes.length; sceneIndex += 1) {
    const scene = renderProject.scenes[sceneIndex];
    const imageUrl = resolveMediaRefToBrowserUrl(scene.image.mediaRef);
    if (!imageUrl) {
      return {
        ok: false,
        message: `Scene ${scene.order} image is not previewable in the browser.`,
      };
    }

    scenes.push({
      id: scene.id || String(scene.order),
      imageUrl,
      durationFrames: secondsToFrames(scene.finalDuration, fps),
      transitionType: scene.transitionType,
      transitionDurationMs: scene.transitionDurationMs,
      motionPreset: resolveSceneMotionPreset(scene, sceneIndex, renderProject.settings.motion),
    });
  }

  let narration: RemotionRenderProps["narration"] | undefined;
  if (renderProject.narration) {
    const narrationAudioUrl = resolveMediaRefToBrowserUrl(renderProject.narration.mediaRef);
    if (!narrationAudioUrl) {
      return {
        ok: false,
        message: "Narration audio is not previewable in the browser.",
      };
    }
    narration = { audioUrl: narrationAudioUrl };
  }

  const backgroundMusic = {
    enabled: Boolean(renderProject.backgroundMusic?.enabled),
    audioUrl:
      typeof renderProject.backgroundMusic?.audioUrl === "string" && renderProject.backgroundMusic.audioUrl.trim()
        ? renderProject.backgroundMusic.audioUrl.trim()
        : null,
    fileName:
      typeof renderProject.backgroundMusic?.fileName === "string" && renderProject.backgroundMusic.fileName.trim()
        ? renderProject.backgroundMusic.fileName.trim()
        : null,
    duration:
      typeof renderProject.backgroundMusic?.duration === "number" &&
      Number.isFinite(renderProject.backgroundMusic.duration) &&
      renderProject.backgroundMusic.duration > 0
        ? renderProject.backgroundMusic.duration
        : null,
    loop: Boolean(renderProject.backgroundMusic?.loop),
    volume: Number.isFinite(renderProject.backgroundMusic?.volume)
      ? Math.min(100, Math.max(0, Math.round(renderProject.backgroundMusic?.volume as number)))
      : 25,
  } satisfies RemotionRenderProps["backgroundMusic"];

  return {
    ok: true,
    props: {
      width,
      height,
      fps,
      motionStrength: renderProject.settings.motion.strength,
      transitions: {
        enabled: renderProject.settings.transitions.enabled,
        durationMs: renderProject.settings.transitions.durationMs,
      },
      scenes,
      narration,
      backgroundMusic,
    },
  };
}
