import {
  assignDeterministicMotionPreset,
  normalizeAllowedMotionPresetIds,
} from "@/modules/video-renderer/motion-presets";
import type { NarrationState } from "@/types/narration";
import {
  DEFAULT_RENDER_SETTINGS,
  type MotionSettings,
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
  timingStrategy?: "estimated" | "scale-to-narration" | "auto";
  motionSettings?: Partial<MotionSettings>;
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

function resolveMotionSettings(appState: RenderProjectAppState): MotionSettings {
  const mergedMotion = {
    ...DEFAULT_RENDER_SETTINGS.motion,
    ...(appState.settings?.motion || {}),
    ...(appState.motionSettings || {}),
  };

  return {
    enabled: Boolean(mergedMotion.enabled),
    allowedPresetIds: normalizeAllowedMotionPresetIds(mergedMotion.allowedPresetIds || []),
    assignmentMode: "deterministic-random",
  };
}

function isFinitePositiveNumber(value: number | undefined) {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function getLargeDurationMismatchIssue(
  finalDuration: number,
  narrationDuration?: number,
): RenderValidationIssue | undefined {
  if (!isFinitePositiveNumber(narrationDuration) || !isFinitePositiveNumber(finalDuration)) {
    return undefined;
  }

  const normalizedNarrationDuration = narrationDuration as number;
  const delta = Math.abs(finalDuration - normalizedNarrationDuration);
  const mismatchRatio = delta / normalizedNarrationDuration;
  if (mismatchRatio < 0.12) {
    return undefined;
  }

  return createIssue(
    "LARGE_DURATION_MISMATCH",
    `Final video timing differs from narration by ${delta.toFixed(1)}s.`,
    "warning",
  );
}

export function validateRenderProject(
  renderProject: RenderProject,
  initialIssues: RenderValidationIssue[] = [],
): RenderProject {
  const issues: RenderValidationIssue[] = [...initialIssues];

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
    renderProject.totalEstimatedSceneDuration <= 0 ||
    !Number.isFinite(renderProject.totalFinalSceneDuration) ||
    renderProject.totalFinalSceneDuration <= 0
  ) {
    issues.push(createIssue("INVALID_DURATION", "Render project total durations are invalid.", "error"));
  }

  if (
    renderProject.timingStrategy === "scale-to-narration" &&
    (!isFinitePositiveNumber(renderProject.narrationDuration) ||
      !isFinitePositiveNumber(renderProject.totalEstimatedSceneDuration) ||
      !isFinitePositiveNumber(renderProject.scaleFactor))
  ) {
    issues.push(
      createIssue(
        "TIMING_RECONCILIATION_UNAVAILABLE",
        "Scale-to-narration timing was requested but required duration values are missing or invalid.",
        "warning",
      ),
    );
  }

  if (renderProject.settings.motion.enabled && renderProject.settings.motion.allowedPresetIds.length === 0) {
    issues.push(
      createIssue(
        "MOTION_PRESET_POOL_EMPTY",
        "Motion effects are enabled, but no motion presets are selected.",
        "warning",
      ),
    );
  }

  const largeMismatchIssue = getLargeDurationMismatchIssue(
    renderProject.totalFinalSceneDuration,
    renderProject.narrationDuration,
  );
  if (largeMismatchIssue) {
    issues.push(largeMismatchIssue);
  }

  return {
    ...renderProject,
    issues,
    isReady: !issues.some((issue) => issue.level === "error"),
  };
}

export function buildRenderProject(appState: RenderProjectAppState): RenderProject {
  const estimatedScenes = (appState.scenePackResult?.scenes || []).map((scene, index) => ({
    id: String(scene.index),
    order: index + 1,
    text: scene.text,
    estimatedDuration: scene.estimatedDurationSeconds,
    finalDuration: scene.estimatedDurationSeconds,
    image: normalizeSceneImage(appState.sceneImages[scene.index]),
  }));

  const narration = normalizeNarrationAsset(appState.narration);
  const motionSettings = resolveMotionSettings(appState);
  const settings: RenderSettings = {
    ...DEFAULT_RENDER_SETTINGS,
    ...appState.settings,
    motion: motionSettings,
  };

  const totalEstimatedSceneDuration = estimatedScenes.reduce((sum, scene) => sum + scene.estimatedDuration, 0);
  const narrationDuration = narration?.duration;
  const timingPreference = appState.timingStrategy || "auto";
  const timingWarnings: RenderValidationIssue[] = [];

  const canScaleToNarration =
    isFinitePositiveNumber(narrationDuration) && isFinitePositiveNumber(totalEstimatedSceneDuration);

  const resolvedTimingStrategy: "estimated" | "scale-to-narration" =
    timingPreference === "estimated"
      ? "estimated"
      : timingPreference === "scale-to-narration"
        ? canScaleToNarration
          ? "scale-to-narration"
          : "estimated"
        : canScaleToNarration
          ? "scale-to-narration"
          : "estimated";

  if (timingPreference === "scale-to-narration" && !canScaleToNarration) {
    timingWarnings.push(
      createIssue(
        "TIMING_RECONCILIATION_UNAVAILABLE",
        "Scale-to-narration timing was requested but narration or estimated duration is unavailable.",
        "warning",
      ),
    );
  }

  const scaleFactor =
    resolvedTimingStrategy === "scale-to-narration" && canScaleToNarration
      ? (narrationDuration as number) / totalEstimatedSceneDuration
      : undefined;

  const timingAdjustedScenes =
    scaleFactor !== undefined
      ? estimatedScenes.map((scene) => ({
          ...scene,
          finalDuration: scene.estimatedDuration * scaleFactor,
        }))
      : estimatedScenes;

  const scenes = timingAdjustedScenes.map((scene) => {
    const motionPreset =
      motionSettings.enabled && motionSettings.allowedPresetIds.length > 0
        ? assignDeterministicMotionPreset(scene.id, scene.order, motionSettings.allowedPresetIds)
        : undefined;

    return {
      ...scene,
      motionPreset,
    };
  });

  const totalFinalSceneDuration = scenes.reduce((sum, scene) => sum + scene.finalDuration, 0);

  const derivedProject: RenderProject = {
    scenes,
    narration,
    settings,
    timingStrategy: resolvedTimingStrategy,
    scaleFactor,
    totalEstimatedSceneDuration,
    totalFinalSceneDuration,
    narrationDuration,
    isReady: false,
    issues: [],
  };

  return validateRenderProject(derivedProject, timingWarnings);
}
