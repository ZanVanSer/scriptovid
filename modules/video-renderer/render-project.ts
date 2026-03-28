import { CINEMATIC_TRANSITION_PRESET_IDS } from "@/lib/render/transition-types";
import { pickTransitionSequence } from "@/modules/video-renderer/transition-assignment";
import type { NarrationState } from "@/types/narration";
import {
  DEFAULT_RENDER_SETTINGS,
  type MotionSettings,
  type RenderImageAsset,
  type RenderMediaRef,
  type RenderNarration,
  type RenderProject,
  type RenderSettings,
  type TransitionSettings,
  type TransitionType,
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
  motionAssignmentSalt?: string;
};

function isPositiveDuration(value: number) {
  return Number.isFinite(value) && value > 0;
}

function isValidTransitionType(value: unknown): value is TransitionType {
  return (
    value === "cut" ||
    value === "crossfade" ||
    value === "slide-left" ||
    value === "slide-right" ||
    value === "zoom-transition"
  );
}

function normalizeTransitionDurationMs(value: number | undefined) {
  if (!Number.isFinite(value)) {
    return DEFAULT_RENDER_SETTINGS.transitions.durationMs;
  }

  if ((value as number) < 0) {
    return 0;
  }

  return Math.round(value as number);
}

function normalizeTransitionPool(value: TransitionType[] | undefined) {
  const presetPool = Array.isArray(value) ? value.filter((preset) => isValidTransitionType(preset)) : [];
  const uniquePool = [...new Set(presetPool)];
  return uniquePool.filter((preset) => preset !== "cut");
}

function resolveTransitionSettings(appState: RenderProjectAppState): TransitionSettings {
  const rawSettings = appState.settings as
    | (Partial<RenderSettings> & {
        defaultTransitionType?: TransitionType;
        defaultTransitionDuration?: number;
      })
    | undefined;

  const legacyType = rawSettings?.defaultTransitionType;
  const legacyDuration = rawSettings?.defaultTransitionDuration;

  const merged = {
    ...DEFAULT_RENDER_SETTINGS.transitions,
    ...(rawSettings?.transitions || {}),
  };

  const hasLegacyType = isValidTransitionType(legacyType);
  const resolvedPool = normalizeTransitionPool(
    merged.presetPool && merged.presetPool.length > 0
      ? merged.presetPool
      : hasLegacyType && legacyType !== "cut"
        ? [legacyType]
        : CINEMATIC_TRANSITION_PRESET_IDS,
  );

  const durationMs = normalizeTransitionDurationMs(
    typeof merged.durationMs === "number" ? merged.durationMs : legacyDuration,
  );

  return {
    enabled: Boolean(merged.enabled),
    presetPool: resolvedPool,
    durationMs,
    renderSessionSeed:
      typeof merged.renderSessionSeed === "string" && merged.renderSessionSeed.trim()
        ? merged.renderSessionSeed.trim()
        : undefined,
  };
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

  const normalizedAllowedPresetIds = Array.isArray(mergedMotion.allowedPresetIds)
    ? ([...new Set(mergedMotion.allowedPresetIds)] as MotionSettings["allowedPresetIds"])
    : [];

  return {
    enabled: Boolean(mergedMotion.enabled),
    allowedPresetIds: normalizedAllowedPresetIds,
    assignmentMode: "deterministic-by-scene-index",
    speed: mergedMotion.speed === 0.5 || mergedMotion.speed === 1 ? mergedMotion.speed : 0.75,
    strength: mergedMotion.strength === "weak" || mergedMotion.strength === "strong" ? mergedMotion.strength : "medium",
  };
}

function assignMotionPresetBySceneIndex(
  sceneIndex: number,
  allowedPresetIds: MotionSettings["allowedPresetIds"],
  assignmentSalt?: string,
) {
  if (allowedPresetIds.length === 0) {
    return undefined;
  }

  const normalizedSceneIndex = Number.isFinite(sceneIndex) && sceneIndex >= 0 ? Math.floor(sceneIndex) : 0;
  if (!assignmentSalt) {
    const presetIndex = normalizedSceneIndex % allowedPresetIds.length;
    return allowedPresetIds[presetIndex];
  }

  let hash = 2166136261;
  const seed = `${normalizedSceneIndex}:${assignmentSalt}`;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  const presetIndex = (hash >>> 0) % allowedPresetIds.length;
  return allowedPresetIds[presetIndex];
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

    if (scene.transitionType !== undefined && !isValidTransitionType(scene.transitionType)) {
      issues.push(
        createIssue(
          "INVALID_TRANSITION_TYPE",
          `Scene ${scene.order} has an invalid transition type.`,
          "error",
        ),
      );
    }

    if (
      scene.transitionDurationMs !== undefined &&
      (!Number.isFinite(scene.transitionDurationMs) || scene.transitionDurationMs < 0)
    ) {
      issues.push(
        createIssue(
          "INVALID_TRANSITION_DURATION",
          `Scene ${scene.order} has an invalid transition duration.`,
          "error",
        ),
      );
    }
  });

  if (!renderProject.settings.transitions || typeof renderProject.settings.transitions !== "object") {
    issues.push(createIssue("INVALID_TRANSITION_SETTINGS", "Transition settings are missing.", "error"));
  } else {
    if (
      !Number.isFinite(renderProject.settings.transitions.durationMs) ||
      renderProject.settings.transitions.durationMs < 0
    ) {
      issues.push(
        createIssue("INVALID_TRANSITION_DURATION", "Default transition duration is invalid.", "error"),
      );
    }

    const hasInvalidPreset = (renderProject.settings.transitions.presetPool || []).some(
      (preset) => !isValidTransitionType(preset),
    );
    if (hasInvalidPreset) {
      issues.push(createIssue("INVALID_TRANSITION_TYPE", "Transition preset pool is invalid.", "error"));
    }
  }

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
  const transitionSettings = resolveTransitionSettings(appState);
  const settings: RenderSettings = {
    ...DEFAULT_RENDER_SETTINGS,
    ...appState.settings,
    transitions: transitionSettings,
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

  const transitionSequence = transitionSettings.enabled
    ? pickTransitionSequence({
        boundaryCount: Math.max(0, timingAdjustedScenes.length - 1),
        presetPool: transitionSettings.presetPool,
        renderSessionSeed: transitionSettings.renderSessionSeed || "transition-seed-default",
      })
    : [];

  const scenes = timingAdjustedScenes.map((scene, sceneIndex) => {
    const isLastScene = sceneIndex === timingAdjustedScenes.length - 1;
    const boundaryTransitionType = !isLastScene
      ? transitionSequence[sceneIndex] || "crossfade"
      : "cut";

    return {
      ...scene,
      transitionType: transitionSettings.enabled ? boundaryTransitionType : "cut",
      transitionDurationMs:
        transitionSettings.enabled && !isLastScene && boundaryTransitionType !== "cut"
          ? transitionSettings.durationMs
          : 0,
      motionPreset:
        motionSettings.enabled && motionSettings.allowedPresetIds.length > 0
          ? assignMotionPresetBySceneIndex(
              sceneIndex,
              motionSettings.allowedPresetIds,
              appState.motionAssignmentSalt,
            )
          : undefined,
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
