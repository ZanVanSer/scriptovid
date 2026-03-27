import type { NarrationState } from "@/types/narration";
import {
  DEFAULT_RENDER_SETTINGS,
  type RenderImageAsset,
  type RenderMediaRef,
  type RenderNarration,
  type RenderProject,
  type RenderSettings,
  type RenderValidationIssue,
} from "@/types/render-project";
import type { ScenePackResult } from "@/types/scene";

export type RenderProjectSceneImageInput = {
  label?: string;
  objectUrl?: string;
  filePath?: string;
  source: "manual" | "nanobanana";
  mimeType?: string;
  width?: number;
  height?: number;
};

export type RenderProjectAppState = {
  scenePackResult: ScenePackResult | null;
  sceneImages: Record<number, RenderProjectSceneImageInput | undefined>;
  narration: NarrationState;
  settings?: Partial<RenderSettings>;
};

function isPositiveDuration(value: number) {
  return Number.isFinite(value) && value > 0;
}

function normalizeMediaRef(value?: string, kind: RenderMediaRef["kind"] = "url") {
  if (!value) {
    return undefined;
  }

  const normalized = value.trim();
  if (!normalized) {
    return undefined;
  }

  return {
    kind,
    value: normalized,
  } satisfies RenderMediaRef;
}

function normalizeNarrationAsset(narration: NarrationState): RenderNarration | undefined {
  if (!narration.asset) {
    return undefined;
  }

  const mediaRef =
    normalizeMediaRef(narration.asset.filePath, "file-path") || normalizeMediaRef(narration.asset.audioUrl, "url");

  if (!mediaRef) {
    return {
      provider: narration.asset.provider,
      mediaRef: {
        kind: "url",
        value: "",
      },
      fileName: narration.asset.fileName,
      mimeType: narration.asset.mimeType,
      fileSize: narration.asset.fileSize,
      duration: narration.asset.duration,
      voiceId: narration.asset.voiceId,
      modelId: narration.asset.modelId,
    };
  }

  return {
    provider: narration.asset.provider,
    mediaRef,
    fileName: narration.asset.fileName,
    mimeType: narration.asset.mimeType,
    fileSize: narration.asset.fileSize,
    duration: narration.asset.duration,
    voiceId: narration.asset.voiceId,
    modelId: narration.asset.modelId,
  };
}

function normalizeSceneImage(image?: RenderProjectSceneImageInput): RenderImageAsset {
  const mediaRef =
    normalizeMediaRef(image?.filePath, "file-path") || normalizeMediaRef(image?.objectUrl, "url");

  return {
    source: image?.source === "manual" ? "manual" : "generated",
    mediaRef: mediaRef || {
      kind: "url",
      value: "",
    },
    fileName: image?.label,
    mimeType: image?.mimeType,
    width: image?.width,
    height: image?.height,
  };
}

function getMediaRefRenderabilityStatus(mediaRef: RenderMediaRef): "ok" | "error" {
  const kind = (mediaRef as { kind?: string } | undefined)?.kind;
  const value = (mediaRef as { value?: string } | undefined)?.value?.trim() || "";

  if (kind !== "file-path" && kind !== "url") {
    return "error";
  }

  if (!value) {
    return "error";
  }

  if (kind === "file-path") {
    if (value.startsWith("/") || /^[A-Za-z]:\\/.test(value)) {
      return "ok";
    }
    return "error";
  }

  if (value.startsWith("/") || value.startsWith("http://") || value.startsWith("https://")) {
    return "ok";
  }

  return "error";
}

function createIssue(code: string, message: string, level: RenderValidationIssue["level"]): RenderValidationIssue {
  return { code, message, level };
}

export function validateRenderProject(renderProject: RenderProject): RenderProject {
  const issues: RenderValidationIssue[] = [];

  if (renderProject.scenes.length === 0) {
    issues.push(createIssue("MISSING_SCENES", "Render project has no scenes.", "error"));
  }

  renderProject.scenes.forEach((scene) => {
    if (!isPositiveDuration(scene.estimatedDuration) || !isPositiveDuration(scene.finalDuration)) {
      issues.push(
        createIssue("INVALID_DURATION", `Scene ${scene.order} has invalid duration values.`, "error"),
      );
    }

    const hasImageMediaRef =
      scene.image &&
      scene.image.mediaRef &&
      typeof scene.image.mediaRef.kind === "string" &&
      typeof scene.image.mediaRef.value === "string";

    if (!hasImageMediaRef) {
      issues.push(
        createIssue(
          "SCENE_IMAGE_MISSING",
          `Scene ${scene.order} image media reference is missing.`,
          "error",
        ),
      );
    } else {
      const mediaRefStatus = getMediaRefRenderabilityStatus(scene.image.mediaRef);
      if (mediaRefStatus !== "ok") {
        issues.push(
          createIssue(
            "MEDIA_NOT_RENDERABLE",
            `Scene ${scene.order} image media reference is invalid for renderer input.`,
            "error",
          ),
        );
      }
    }
  });

  if (!renderProject.narration) {
    issues.push(createIssue("MISSING_NARRATION", "Narration track is missing.", "error"));
  } else {
    const hasNarrationMediaRef =
      renderProject.narration.mediaRef &&
      typeof renderProject.narration.mediaRef.kind === "string" &&
      typeof renderProject.narration.mediaRef.value === "string";

    if (!hasNarrationMediaRef) {
      issues.push(createIssue("NARRATION_MEDIA_MISSING", "Narration media reference is missing.", "error"));
    } else {
      const mediaRefStatus = getMediaRefRenderabilityStatus(renderProject.narration.mediaRef);
      if (mediaRefStatus !== "ok") {
        issues.push(
          createIssue(
            "MEDIA_NOT_RENDERABLE",
            "Narration media reference is invalid for renderer input.",
            "error",
          ),
        );
      }
    }

    if (
      renderProject.narration.duration !== undefined &&
      !isPositiveDuration(renderProject.narration.duration)
    ) {
      issues.push(createIssue("INVALID_DURATION", "Narration duration is invalid.", "error"));
    }
  }

  if (
    !Number.isFinite(renderProject.totalEstimatedSceneDuration) ||
    renderProject.totalEstimatedSceneDuration < 0 ||
    !Number.isFinite(renderProject.totalFinalSceneDuration) ||
    renderProject.totalFinalSceneDuration < 0
  ) {
    issues.push(createIssue("INVALID_DURATION", "Render project total durations are invalid.", "error"));
  }

  return {
    ...renderProject,
    issues,
    isReady: !issues.some((issue) => issue.level === "error"),
  };
}

export function buildRenderProject(appState: RenderProjectAppState): RenderProject {
  const scenes = (appState.scenePackResult?.scenes || []).map((scene, index) => ({
    id: String(scene.index),
    order: index + 1,
    text: scene.text,
    estimatedDuration: scene.estimatedDurationSeconds,
    finalDuration: scene.estimatedDurationSeconds,
    image: normalizeSceneImage(appState.sceneImages[scene.index]),
  }));

  const narration = normalizeNarrationAsset(appState.narration);
  const settings: RenderSettings = {
    ...DEFAULT_RENDER_SETTINGS,
    ...appState.settings,
  };

  const totalEstimatedSceneDuration = scenes.reduce((sum, scene) => sum + scene.estimatedDuration, 0);
  const totalFinalSceneDuration = scenes.reduce((sum, scene) => sum + scene.finalDuration, 0);

  const derivedProject: RenderProject = {
    scenes,
    narration,
    settings,
    timingStrategy: "estimated",
    totalEstimatedSceneDuration,
    totalFinalSceneDuration,
    narrationDuration: narration?.duration,
    isReady: false,
    issues: [],
  };

  return validateRenderProject(derivedProject);
}
