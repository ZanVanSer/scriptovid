"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";

import {
  DEFAULT_NANOBANANA_MODEL,
  type NanobananaModel,
} from "@/modules/image-generation/nanobanana";
import {
  DEFAULT_VISUAL_STYLE_PRESET_ID,
  buildSceneImagePrompt,
  type VisualStylePresetId,
} from "@/modules/image-generation/prompt-builder";
import { MOTION_PRESET_IDS } from "@/lib/motion/motionPresets";
import {
  buildPreviewSnapshot,
  createRenderSessionSeed,
  persistPreviewSnapshot,
} from "@/lib/preview/preview-snapshot";
import {
  CINEMATIC_TRANSITION_PRESET_IDS,
} from "@/lib/render/transition-types";
import { buildRenderProject } from "@/modules/video-renderer/render-project";
import { DEFAULT_WORDS_PER_MINUTE } from "@/modules/scene-splitter/constants";
import { toPackableTimedUnits } from "@/modules/scene-splitter/fallback-splitter";
import { detectSplitWarnings, validateScriptInput } from "@/modules/scene-splitter/input-quality";
import {
  DEFAULT_MAX_SCENE_DURATION_SECONDS,
  DEFAULT_MIN_SCENE_DURATION_SECONDS,
  packSentencesIntoScenes,
} from "@/modules/scene-splitter/scene-packer";
import { SAMPLE_SCRIPT } from "@/modules/scene-splitter/sample-script";
import {
  createDefaultNarrationState,
  isNarrationReadyForRender,
  type NarrationAsset,
  type NarrationState,
} from "@/types/narration";
import { createDefaultMusicState, type MusicState } from "@/types/music";
import {
  MOTION_STRENGTH_DEFAULT,
  type MotionPresetId,
  type MotionSettings,
  type TransitionType,
} from "@/types/render-project";
import type { ScenePackResult } from "@/types/scene";
import type { SentenceSplitResponse } from "@/types/sentence";

import {
  type SceneImageState,
  type ImageSourceMode,
  type SceneGenerationState,
  type BatchGenerationMode,
  type RenderStatus,
  type WizardState,
  type ElevenLabsOption,
  type SceneMotionDebugRow,
  type SceneTransitionDebugRow,
  type UploadImageSuccessResponse,
  type UploadImageErrorResponse,
  type UploadAudioSuccessResponse,
  type UploadAudioErrorResponse,
  type ElevenLabsNarrationSuccessResponse,
  type ElevenLabsNarrationErrorResponse,
  type ElevenLabsOptionsSuccessResponse,
  type ElevenLabsOptionsErrorResponse,
  type RenderPrototypeSuccessResponse,
  type RenderPrototypeErrorResponse,
  type NanobananaGenerateSuccessResponse,
  type NanobananaGenerateErrorResponse,
  type ClearGeneratedSuccessResponse,
  type ClearGeneratedErrorResponse,
  DEFAULT_ELEVENLABS_MODEL_ID,
  isAllowedImageFile,
  isAllowedAudioFile,
  extractAudioDurationFromAudioSource,
  revokeAudioObjectUrlIfNeeded,
  revokeImageObjectUrlIfNeeded,
  normalizeSceneDurationOverrideSeconds,
} from "@/types/api-responses";

export function useWizardState() {
  const [scriptText, setScriptText] = useState("");
  const [result, setResult] = useState<SentenceSplitResponse | null>(null);
  const [scenePackResult, setScenePackResult] = useState<ScenePackResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [inputFeedback, setInputFeedback] = useState<string | null>(null);
  const [splitWarnings, setSplitWarnings] = useState<string[]>([]);
  const [scenePackError, setScenePackError] = useState<string | null>(null);
  const [isSplitting, setIsSplitting] = useState(false);
  const [minSceneDurationSeconds, setMinSceneDurationSeconds] = useState(
    String(DEFAULT_MIN_SCENE_DURATION_SECONDS),
  );
  const [maxSceneDurationSeconds, setMaxSceneDurationSeconds] = useState(
    String(DEFAULT_MAX_SCENE_DURATION_SECONDS),
  );
  const [sceneImages, setSceneImages] = useState<Record<number, SceneImageState>>({});
  const [sceneImageErrors, setSceneImageErrors] = useState<Record<number, string>>({});
  const [activeDropSceneIndex, setActiveDropSceneIndex] = useState<number | null>(null);
  const sceneImagesRef = useRef<Record<number, SceneImageState>>({});
  const [imageSourceMode, setImageSourceMode] = useState<ImageSourceMode>("manual");
  const [nanobananaModel, setNanobananaModel] = useState<NanobananaModel>(DEFAULT_NANOBANANA_MODEL);
  const [selectedVisualStyle, setSelectedVisualStyle] = useState<VisualStylePresetId>(
    DEFAULT_VISUAL_STYLE_PRESET_ID,
  );
  const [nanobananaApiKeyOverride, setNanobananaApiKeyOverride] = useState("");
  const [sceneGenerationStates, setSceneGenerationStates] = useState<Record<number, SceneGenerationState>>(
    {},
  );
  const [narration, setNarration] = useState<NarrationState>(createDefaultNarrationState);
  const [isNarrationDropActive, setIsNarrationDropActive] = useState(false);
  const narrationAudioUrlRef = useRef<string | undefined>(undefined);
  const narrationUploadRequestRef = useRef(0);
  const narrationGenerationRequestRef = useRef(0);
  const [music, setMusic] = useState<MusicState>(createDefaultMusicState);
  const [isMusicUploading, setIsMusicUploading] = useState(false);
  const [musicError, setMusicError] = useState<string | null>(null);
  const musicUploadRequestRef = useRef(0);
  const [elevenLabsVoices, setElevenLabsVoices] = useState<ElevenLabsOption[]>([]);
  const [elevenLabsModels, setElevenLabsModels] = useState<ElevenLabsOption[]>([]);
  const [isLoadingElevenLabsOptions, setIsLoadingElevenLabsOptions] = useState(false);
  const [elevenLabsOptionsError, setElevenLabsOptionsError] = useState<string | null>(null);
  const [isBatchGenerating, setIsBatchGenerating] = useState(false);
  const [batchProgress, setBatchProgress] = useState<{
    completed: number;
    total: number;
    mode: BatchGenerationMode;
  } | null>(null);
  const [renderStatus, setRenderStatus] = useState<RenderStatus>("idle");
  const [renderResult, setRenderResult] = useState<RenderPrototypeSuccessResponse | null>(null);
  const [renderError, setRenderError] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [sceneDurationOverrideInputs, setSceneDurationOverrideInputs] = useState<Record<number, string>>({});
  const [lastRenderMotionAssignments, setLastRenderMotionAssignments] = useState<SceneMotionDebugRow[]>([]);
  const [lastRenderTransitionAssignments, setLastRenderTransitionAssignments] = useState<
    SceneTransitionDebugRow[]
  >([]);
  const [isClearingGenerated, setIsClearingGenerated] = useState(false);
  const [clearGeneratedMessage, setClearGeneratedMessage] = useState<string | null>(null);
  const [motionEnabled, setMotionEnabled] = useState(true);
  const [allowedMotionPresetIds, setAllowedMotionPresetIds] = useState<MotionPresetId[]>(MOTION_PRESET_IDS);
  const [motionStrength, setMotionStrength] = useState<MotionSettings["strength"]>(MOTION_STRENGTH_DEFAULT);
  const [transitionsEnabled, setTransitionsEnabled] = useState(true);
  const [allowedTransitionPresetIds, setAllowedTransitionPresetIds] = useState<TransitionType[]>(
    CINEMATIC_TRANSITION_PRESET_IDS,
  );
  const [transitionDurationMs, setTransitionDurationMs] = useState<number>(500);

  useEffect(() => {
    sceneImagesRef.current = sceneImages;
  }, [sceneImages]);

  useEffect(() => {
    return () => {
      Object.values(sceneImagesRef.current).forEach((entry) => {
        revokeImageObjectUrlIfNeeded(entry.objectUrl);
      });
    };
  }, []);

  useEffect(() => {
    narrationAudioUrlRef.current = narration.asset?.audioUrl;
  }, [narration.asset?.audioUrl]);

  useEffect(() => {
    return () => {
      revokeAudioObjectUrlIfNeeded(narrationAudioUrlRef.current);
    };
  }, []);

  const clearNarrationAsset = useCallback(() => {
    narrationUploadRequestRef.current += 1;
    narrationGenerationRequestRef.current += 1;
    setNarration((current) => {
      revokeAudioObjectUrlIfNeeded(current.asset?.audioUrl);

      return {
        ...current,
        status: "idle",
        asset: undefined,
        error: undefined,
      };
    });
  }, []);

  const clearSceneDurationOverrides = useCallback(() => {
    setSceneDurationOverrideInputs({});
  }, []);

  const clearMusicFile = useCallback(() => {
    musicUploadRequestRef.current += 1;
    setMusic((current) => ({
      ...current,
      audioUrl: null,
      filePath: null,
      fileName: null,
      duration: null,
    }));
    setIsMusicUploading(false);
    setMusicError(null);
  }, []);

  const uploadImageToLocalStorage = useCallback(async (file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    const response = await fetch("/api/media/image", {
      method: "POST",
      body: formData,
    });

    const payload = (await response.json().catch(() => null)) as
      | UploadImageSuccessResponse
      | UploadImageErrorResponse
      | null;

    if (!response.ok || !payload || !payload.success) {
      const errorPayload = payload as UploadImageErrorResponse | null;
      throw new Error(errorPayload?.message || "Image file could not be saved.");
    }

    return payload;
  }, []);

  const uploadAudioToLocalStorage = useCallback(async (file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    const response = await fetch("/api/media/audio", {
      method: "POST",
      body: formData,
    });

    const payload = (await response.json().catch(() => null)) as
      | UploadAudioSuccessResponse
      | UploadAudioErrorResponse
      | null;

    if (!response.ok || !payload || !payload.success) {
      const errorPayload = payload as UploadAudioErrorResponse | null;
      throw new Error(errorPayload?.message || "Audio file could not be saved.");
    }

    return payload;
  }, []);

  const applyManualNarrationFile = useCallback(async (file: File) => {
    if (!isAllowedAudioFile(file)) {
      setNarration((current) => ({
        ...current,
        status: "error",
        error: "Please upload an MP3, WAV, M4A, AAC, or OGG audio file.",
      }));
      return;
    }

    const requestId = narrationUploadRequestRef.current + 1;
    narrationUploadRequestRef.current = requestId;
    setNarration((current) => ({
      ...current,
      mode: "manual",
      status: "loading",
      error: undefined,
    }));

    let uploaded: UploadAudioSuccessResponse;
    try {
      uploaded = await uploadAudioToLocalStorage(file);
    } catch (uploadError) {
      if (narrationUploadRequestRef.current !== requestId) {
        return;
      }

      const message = uploadError instanceof Error ? uploadError.message : "Audio file could not be saved.";
      setNarration((current) => ({
        ...current,
        mode: "manual",
        status: "error",
        error: message,
      }));
      return;
    }

    const duration = await extractAudioDurationFromAudioSource(uploaded.audioUrl);

    if (narrationUploadRequestRef.current !== requestId) {
      return;
    }

    setNarration((current) => {
      revokeAudioObjectUrlIfNeeded(current.asset?.audioUrl);

      return {
        ...current,
        mode: "manual",
        status: "done",
        asset: {
          provider: "manual",
          audioUrl: uploaded.audioUrl,
          filePath: uploaded.filePath,
          fileName: uploaded.fileName,
          mimeType: uploaded.mimeType || undefined,
          fileSize: uploaded.fileSize,
          duration,
        },
        error: undefined,
      };
    });
  }, [uploadAudioToLocalStorage]);

  const applyMusicFile = useCallback(async (file: File) => {
    if (!isAllowedAudioFile(file)) {
      setMusicError("Please upload an MP3, WAV, M4A, AAC, or OGG audio file.");
      return;
    }

    const requestId = musicUploadRequestRef.current + 1;
    musicUploadRequestRef.current = requestId;
    setIsMusicUploading(true);
    setMusicError(null);

    let uploaded: UploadAudioSuccessResponse;
    try {
      uploaded = await uploadAudioToLocalStorage(file);
    } catch (uploadError) {
      if (musicUploadRequestRef.current !== requestId) {
        return;
      }

      const message = uploadError instanceof Error ? uploadError.message : "Audio file could not be saved.";
      setMusicError(message);
      setIsMusicUploading(false);
      return;
    }

    const duration = await extractAudioDurationFromAudioSource(uploaded.audioUrl);

    if (musicUploadRequestRef.current !== requestId) {
      return;
    }

    setMusic((current) => ({
      ...current,
      audioUrl: uploaded.audioUrl,
      filePath: uploaded.filePath,
      fileName: uploaded.fileName,
      duration: duration ?? null,
    }));
    setIsMusicUploading(false);
    setMusicError(null);
  }, [uploadAudioToLocalStorage]);

  const openNarrationFilePicker = useCallback(() => {
    const input = document.getElementById("narration-upload") as HTMLInputElement | null;
    input?.click();
  }, []);

  const openMusicFilePicker = useCallback(() => {
    const input = document.getElementById("music-upload") as HTMLInputElement | null;
    input?.click();
  }, []);

  const updateElevenLabsSettings = useCallback((
    field: "voiceId" | "modelId" | "stability" | "similarityBoost" | "style" | "useSpeakerBoost",
    value: string | number | boolean,
  ) => {
    setNarration((current) => ({
      ...current,
      elevenLabs: {
        ...current.elevenLabs,
        [field]: value,
      },
    }));
  }, []);

  const loadElevenLabsOptions = useCallback(async () => {
    setIsLoadingElevenLabsOptions(true);
    setElevenLabsOptionsError(null);

    try {
      const response = await fetch("/api/narration/elevenlabs/options");
      const payload = (await response.json().catch(() => null)) as
        | ElevenLabsOptionsSuccessResponse
        | ElevenLabsOptionsErrorResponse
        | null;

      if (!response.ok || !payload || !payload.success) {
        const errorPayload = payload as ElevenLabsOptionsErrorResponse | null;
        setElevenLabsOptionsError(errorPayload?.message || "Could not load ElevenLabs options.");
        setIsLoadingElevenLabsOptions(false);
        return;
      }

      setElevenLabsVoices(payload.voices);
      setElevenLabsModels(payload.models);
      setNarration((current) => ({
        ...current,
        elevenLabs: {
          ...current.elevenLabs,
          voiceId: current.elevenLabs.voiceId || payload.voices[0]?.id,
          modelId: current.elevenLabs.modelId || payload.models[0]?.id || DEFAULT_ELEVENLABS_MODEL_ID,
        },
      }));
    } catch {
      setElevenLabsOptionsError("Could not load ElevenLabs options.");
    } finally {
      setIsLoadingElevenLabsOptions(false);
    }
  }, []);

  useEffect(() => {
    if (narration.mode !== "elevenlabs") {
      return;
    }

    if (elevenLabsVoices.length > 0 && elevenLabsModels.length > 0) {
      return;
    }

    void loadElevenLabsOptions();
  }, [narration.mode, elevenLabsVoices.length, elevenLabsModels.length, loadElevenLabsOptions]);

  const generateElevenLabsNarration = useCallback(async () => {
    const text = scriptText.trim();
    const voiceId = narration.elevenLabs.voiceId?.trim() || "";
    const modelId = narration.elevenLabs.modelId?.trim() || "";
    const { stability, similarityBoost, style, useSpeakerBoost } = narration.elevenLabs;

    if (!text) {
      setNarration((current) => ({
        ...current,
        mode: "elevenlabs",
        status: "error",
        error: "Script text is required before generating narration.",
      }));
      return;
    }

    if (!voiceId) {
      setNarration((current) => ({
        ...current,
        mode: "elevenlabs",
        status: "error",
        error: "voiceId is required for ElevenLabs narration.",
      }));
      return;
    }

    if (!modelId) {
      setNarration((current) => ({
        ...current,
        mode: "elevenlabs",
        status: "error",
        error: "modelId is required for ElevenLabs narration.",
      }));
      return;
    }

    const hasInvalidTuning =
      !Number.isFinite(stability) ||
      stability < 0 ||
      stability > 1 ||
      !Number.isFinite(similarityBoost) ||
      similarityBoost < 0 ||
      similarityBoost > 1 ||
      !Number.isFinite(style) ||
      style < 0 ||
      style > 1;

    if (hasInvalidTuning) {
      setNarration((current) => ({
        ...current,
        mode: "elevenlabs",
        status: "error",
        error: "Advanced voice settings must be numbers between 0 and 1.",
      }));
      return;
    }

    const requestId = narrationGenerationRequestRef.current + 1;
    narrationGenerationRequestRef.current = requestId;

    setNarration((current) => ({
      ...current,
      mode: "elevenlabs",
      status: "loading",
      error: undefined,
      elevenLabs: {
        ...current.elevenLabs,
        voiceId,
        modelId,
      },
    }));

    let response: Response;
    try {
      response = await fetch("/api/narration/elevenlabs", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text,
          voiceId,
          modelId,
          stability,
          similarityBoost,
          style,
          useSpeakerBoost,
        }),
      });
    } catch {
      if (narrationGenerationRequestRef.current !== requestId) {
        return;
      }

      setNarration((current) => ({
        ...current,
        mode: "elevenlabs",
        status: "error",
        error: "Could not reach the narration server route.",
      }));
      return;
    }

    const payload = (await response.json().catch(() => null)) as
      | ElevenLabsNarrationSuccessResponse
      | ElevenLabsNarrationErrorResponse
      | null;

    if (narrationGenerationRequestRef.current !== requestId) {
      return;
    }

    if (!response.ok || !payload || !payload.success) {
      const errorPayload = payload as ElevenLabsNarrationErrorResponse | null;
      setNarration((current) => ({
        ...current,
        mode: "elevenlabs",
        status: "error",
        error: errorPayload?.message || "ElevenLabs narration generation failed.",
      }));
      return;
    }

    const generated = payload as ElevenLabsNarrationSuccessResponse;
    const duration = await extractAudioDurationFromAudioSource(generated.audioUrl);

    if (narrationGenerationRequestRef.current !== requestId) {
      return;
    }

    setNarration((current) => {
      revokeAudioObjectUrlIfNeeded(current.asset?.audioUrl);

      return {
        ...current,
        mode: "elevenlabs",
        status: "done",
        asset: {
          provider: generated.provider,
          audioUrl: generated.audioUrl,
          filePath: generated.audioPath,
          fileName: generated.fileName,
          mimeType: generated.mimeType,
          fileSize: generated.fileSize,
          duration,
          voiceId: generated.voiceId,
          modelId: generated.modelId,
        },
        error: undefined,
        elevenLabs: {
          ...current.elevenLabs,
          voiceId: generated.voiceId,
          modelId: generated.modelId,
        },
      };
    });
  }, [scriptText, narration.elevenLabs]);

  const clearSceneImageErrorsFor = useCallback((sceneIndex: number) => {
    setSceneImageErrors((current) => {
      if (!current[sceneIndex]) {
        return current;
      }

      const next = { ...current };
      delete next[sceneIndex];
      return next;
    });
  }, []);

  const clearAllSceneImages = useCallback(() => {
    setSceneImages((current) => {
      Object.values(current).forEach((entry) => {
        revokeImageObjectUrlIfNeeded(entry.objectUrl);
      });
      return {};
    });
    setSceneImageErrors({});
    setActiveDropSceneIndex(null);
    setSceneGenerationStates({});
    setIsBatchGenerating(false);
    setBatchProgress(null);
  }, []);

  const removeSceneImage = useCallback((sceneIndex: number) => {
    setSceneImages((current) => {
      const existing = current[sceneIndex];
      if (!existing) {
        return current;
      }

      revokeImageObjectUrlIfNeeded(existing.objectUrl);
      const next = { ...current };
      delete next[sceneIndex];
      return next;
    });
    clearSceneImageErrorsFor(sceneIndex);
    setSceneGenerationStates((current) => ({
      ...current,
      [sceneIndex]: {
        status: "idle",
        usedPrompt: current[sceneIndex]?.usedPrompt,
        usedModel: current[sceneIndex]?.usedModel,
        errorMessage: undefined,
        imageUrl: undefined,
      },
    }));
  }, [clearSceneImageErrorsFor]);

  const applySceneImageFile = useCallback(async (sceneIndex: number, file: File) => {
    if (!isAllowedImageFile(file)) {
      setSceneImageErrors((current) => ({
        ...current,
        [sceneIndex]: "Please upload a PNG, JPG, JPEG, or WEBP image.",
      }));
      return;
    }

    let uploaded: UploadImageSuccessResponse;
    try {
      uploaded = await uploadImageToLocalStorage(file);
    } catch (uploadError) {
      setSceneImageErrors((current) => ({
        ...current,
        [sceneIndex]: uploadError instanceof Error ? uploadError.message : "Image file could not be saved.",
      }));
      return;
    }

    const sceneText = scenePackResult?.scenes.find(s => s.index === sceneIndex)?.text ?? "";
    const usedPrompt = sceneText ? buildSceneImagePrompt({ sceneText, style: selectedVisualStyle }) : undefined;

    setSceneImages((current) => {
      const existing = current[sceneIndex];
      if (existing) {
        revokeImageObjectUrlIfNeeded(existing.objectUrl);
      }

      return {
        ...current,
        [sceneIndex]: {
          label: uploaded.fileName,
          objectUrl: uploaded.publicUrl,
          filePath: uploaded.filePath,
          mimeType: uploaded.mimeType,
          source: "manual",
        },
      };
    });
    clearSceneImageErrorsFor(sceneIndex);
    setSceneGenerationStates((current) => ({
      ...current,
      [sceneIndex]: {
        status: "done",
        usedPrompt: usedPrompt || current[sceneIndex]?.usedPrompt,
        usedModel: nanobananaModel,
        errorMessage: undefined,
        imageUrl: uploaded.publicUrl,
      },
    }));
  }, [uploadImageToLocalStorage, clearSceneImageErrorsFor, nanobananaModel, scenePackResult, selectedVisualStyle]);

  const resolveNanobananaApiKeyOverride = useCallback(() => {
    return nanobananaApiKeyOverride.trim();
  }, [nanobananaApiKeyOverride]);

  const generateNanobananaImageViaApi = useCallback(async (
    prompt: string,
    model: NanobananaModel,
    apiKeyOverride?: string,
  ) => {
    const response = await fetch("/api/image/nanobanana", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        prompt,
        model,
        aspectRatio: "16:9",
        apiKeyOverride: apiKeyOverride?.trim() || undefined,
      }),
    });

    const payload = (await response.json().catch(() => null)) as
      | NanobananaGenerateSuccessResponse
      | NanobananaGenerateErrorResponse
      | null;

    if (!response.ok || !payload || !payload.success) {
      const message = payload && !payload.success ? payload.message : "Image generation failed.";
      throw new Error(message);
    }

    return payload;
  }, []);

  const generateSceneImage = useCallback(async (sceneIndex: number, prompt: string, forcedApiKey?: string) => {
    const apiKeyOverride = forcedApiKey || resolveNanobananaApiKeyOverride();

    setSceneGenerationStates((current) => ({
      ...current,
      [sceneIndex]: {
        status: "loading",
        usedPrompt: prompt,
        usedModel: nanobananaModel,
        errorMessage: undefined,
        imageUrl: sceneImages[sceneIndex]?.objectUrl,
      },
    }));
    clearSceneImageErrorsFor(sceneIndex);

    try {
      const result = await generateNanobananaImageViaApi(
        prompt,
        nanobananaModel,
        apiKeyOverride,
      );

      const blob = await fetch(result.imageUrl).then(async (response) => response.blob());
      const generatedFile = new File([blob], `scene-${sceneIndex}.png`, {
        type: blob.type || "image/png",
      });
      const uploaded = await uploadImageToLocalStorage(generatedFile);

      setSceneImages((current) => {
        const existing = current[sceneIndex];
        if (existing) {
          revokeImageObjectUrlIfNeeded(existing.objectUrl);
        }

        return {
          ...current,
          [sceneIndex]: {
            label: `Generated · ${nanobananaModel}`,
            objectUrl: uploaded.publicUrl,
            filePath: uploaded.filePath,
            mimeType: uploaded.mimeType,
            source: "nanobanana",
            generatedPrompt: prompt,
            generatedModel: nanobananaModel,
          },
        };
      });

      setSceneGenerationStates((current) => ({
        ...current,
        [sceneIndex]: {
          status: "done",
          usedPrompt: prompt,
          usedModel: nanobananaModel,
          errorMessage: undefined,
          imageUrl: uploaded.publicUrl,
        },
      }));
    } catch (generationError) {
      let message = "Image generation failed.";
      if (generationError instanceof Error) {
        message = generationError.message;
      }

      setSceneGenerationStates((current) => ({
        ...current,
        [sceneIndex]: {
          status: "error",
          errorMessage: message,
          usedPrompt: prompt,
          usedModel: nanobananaModel,
          imageUrl: undefined,
        },
      }));
      setSceneImageErrors((current) => ({
        ...current,
        [sceneIndex]: message,
      }));
    }
  }, [
    nanobananaModel,
    resolveNanobananaApiKeyOverride,
    generateNanobananaImageViaApi,
    uploadImageToLocalStorage,
    clearSceneImageErrorsFor,
    sceneImages,
  ]);

  const getBatchTargetScenes = useCallback((mode: BatchGenerationMode) => {
    if (!scenePackResult) {
      return [];
    }

    if (mode === "regenerate-all") {
      return scenePackResult.scenes;
    }

    if (mode === "regenerate-failed") {
      return scenePackResult.scenes.filter((scene) => getSceneGenerationStatus(scene.index).status === "error");
    }

    return scenePackResult.scenes.filter((scene) => !sceneImages[scene.index]);
  }, [scenePackResult, sceneImages]);

  const runBatchGeneration = useCallback(async (mode: BatchGenerationMode) => {
    if (!scenePackResult || scenePackResult.scenes.length === 0) {
      return;
    }

    const targetScenes = getBatchTargetScenes(mode);
    if (targetScenes.length === 0) {
      return;
    }

    const apiKeyOverride = resolveNanobananaApiKeyOverride();

    setIsBatchGenerating(true);
    setBatchProgress({ completed: 0, total: targetScenes.length, mode });

    for (let index = 0; index < targetScenes.length; index += 1) {
      const scene = targetScenes[index];
      const prompt = buildSceneImagePrompt({ sceneText: scene.text, style: selectedVisualStyle });
      await generateSceneImage(scene.index, prompt, apiKeyOverride);
      setBatchProgress({
        completed: index + 1,
        total: targetScenes.length,
        mode,
      });
    }

    setIsBatchGenerating(false);
  }, [scenePackResult, getBatchTargetScenes, resolveNanobananaApiKeyOverride, selectedVisualStyle, generateSceneImage]);

  const openSceneFilePicker = useCallback((sceneIndex: number) => {
    const input = document.getElementById(`scene-upload-${sceneIndex}`) as HTMLInputElement | null;
    input?.click();
  }, []);

  const handleSplit = useCallback(async () => {
    setIsSplitting(true);
    setError(null);
    setInputFeedback(null);

    const validation = validateScriptInput(scriptText);

    if (validation.blockingError) {
      setInputFeedback(validation.blockingError);
      setIsSplitting(false);
      return;
    }

    try {
      const response = await fetch("/api/sentence-split", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ text: scriptText }),
      });

      if (!response.ok) {
        throw new Error("Split request failed.");
      }

      const data = (await response.json()) as SentenceSplitResponse;
      const warnings = detectSplitWarnings(data.normalizedText);

      clearAllSceneImages();
      clearSceneDurationOverrides();
      setResult(data);
      setScenePackResult(null);
      setScenePackError(null);
      setSplitWarnings(warnings);
      setInputFeedback(validation.advisory);
    } catch {
      setError("Unable to split text right now. Please try again.");
    } finally {
      setIsSplitting(false);
    }
  }, [scriptText, clearAllSceneImages, clearSceneDurationOverrides]);

  const handleLoadSample = useCallback(() => {
    clearAllSceneImages();
    clearSceneDurationOverrides();
    setScriptText(SAMPLE_SCRIPT);
    setResult(null);
    setScenePackResult(null);
    setError(null);
    setInputFeedback(null);
    setSplitWarnings([]);
    setScenePackError(null);
  }, [clearAllSceneImages, clearSceneDurationOverrides]);

  const handlePackScenes = useCallback(() => {
    setScenePackError(null);

    if (!result || result.sentences.length === 0) {
      setScenePackError("Split text into sentences before packing scenes.");
      setScenePackResult(null);
      return;
    }

    const min = Number(minSceneDurationSeconds);
    const max = Number(maxSceneDurationSeconds);

    if (!Number.isFinite(min) || !Number.isFinite(max) || min <= 0 || max <= 0) {
      setScenePackError("Scene durations must be numbers greater than 0.");
      setScenePackResult(null);
      return;
    }

    if (min > max) {
      setScenePackError("Minimum scene duration cannot be greater than maximum.");
      setScenePackResult(null);
      return;
    }

    const timedUnits = toPackableTimedUnits(result.sentences, max, DEFAULT_WORDS_PER_MINUTE);
    const packed = packSentencesIntoScenes(timedUnits, {
      minSceneDurationSeconds: min,
      maxSceneDurationSeconds: max,
    });

    clearAllSceneImages();
    clearSceneDurationOverrides();
    setScenePackResult(packed);
  }, [result, minSceneDurationSeconds, maxSceneDurationSeconds, clearAllSceneImages, clearSceneDurationOverrides]);

  const scenePrompts = useMemo(() => {
    if (!scenePackResult) {
      return {};
    }

    return scenePackResult.scenes.reduce<Record<number, string>>((acc, scene) => {
      acc[scene.index] = buildSceneImagePrompt({
        sceneText: scene.text,
        style: selectedVisualStyle,
      });
      return acc;
    }, {});
  }, [scenePackResult, selectedVisualStyle]);

  const getSceneGenerationStatus = useCallback((sceneIndex: number): SceneGenerationState => {
    return sceneGenerationStates[sceneIndex] || { status: "idle" };
  }, [sceneGenerationStates]);

  const getPerSceneGenerateLabel = useCallback((sceneIndex: number) => {
    const sceneState = getSceneGenerationStatus(sceneIndex);
    if (sceneState.status === "loading") {
      return "Generating...";
    }

    if (sceneState.status === "error") {
      return "Retry";
    }

    if (sceneImages[sceneIndex]) {
      return "Regenerate";
    }

    return "Generate";
  }, [getSceneGenerationStatus, sceneImages]);

  const formatBatchMode = useCallback((mode: BatchGenerationMode) => {
    if (mode === "regenerate-all") {
      return "regenerate all";
    }
    if (mode === "regenerate-failed") {
      return "regenerate failed";
    }
    return "generate all";
  }, []);

  const generationSummary = useMemo(() => {
    if (!scenePackResult) {
      return { done: 0, error: 0, loading: 0 };
    }

    return scenePackResult.scenes.reduce(
      (acc, scene) => {
        const status = getSceneGenerationStatus(scene.index).status;
        if (status === "done") {
          acc.done += 1;
        } else if (status === "error") {
          acc.error += 1;
        } else if (status === "loading") {
          acc.loading += 1;
        }
        return acc;
      },
      { done: 0, error: 0, loading: 0 },
    );
  }, [scenePackResult, getSceneGenerationStatus]);

  const sceneDurationOverrides = useMemo(() => {
    if (!scenePackResult) {
      return {};
    }

    return scenePackResult.scenes.reduce<Record<number, number>>((acc, scene) => {
      const rawValue = sceneDurationOverrideInputs[scene.index];
      if (!rawValue || !rawValue.trim()) {
        return acc;
      }

      const parsed = Number(rawValue);
      const normalized = normalizeSceneDurationOverrideSeconds(parsed);
      if (normalized === undefined) {
        return acc;
      }

      acc[scene.index] = normalized;
      return acc;
    }, {});
  }, [scenePackResult, sceneDurationOverrideInputs]);

  useEffect(() => {
    if (narration.status !== "done") {
      return;
    }

    if (!narration.asset?.audioUrl || typeof narration.asset.duration === "number") {
      return;
    }

    const currentAudioUrl = narration.asset.audioUrl;
    let isCancelled = false;

    void extractAudioDurationFromAudioSource(currentAudioUrl).then((duration) => {
      if (isCancelled || duration === undefined) {
        return;
      }

      setNarration((current) => {
        if (current.asset?.audioUrl !== currentAudioUrl) {
          return current;
        }

        if (typeof current.asset.duration === "number") {
          return current;
        }

        return {
          ...current,
          asset: {
            ...current.asset,
            duration,
          },
        };
      });
    });

    return () => {
      isCancelled = true;
    };
  }, [narration.status, narration.asset?.audioUrl, narration.asset?.duration]);

  const activeNarrationAsset: NarrationAsset | undefined = narration.asset;
  const isNarrationReady = isNarrationReadyForRender(narration);
  const clampedMusicVolume = Math.min(100, Math.max(0, Math.round(music.volume)));

  const buildRenderProjectFromCurrentState = useCallback((options?: {
    motionAssignmentSalt?: string;
    renderSessionSeed?: string;
  }) => {
    return buildRenderProject({
      scenePackResult,
      sceneImages,
      sceneDurationOverrides,
      narration,
      music,
      settings: {
        transitions: {
          enabled: transitionsEnabled,
          presetPool: allowedTransitionPresetIds,
          durationMs: transitionDurationMs,
          renderSessionSeed: options?.renderSessionSeed,
        },
      },
      motionSettings: {
        enabled: motionEnabled,
        allowedPresetIds: allowedMotionPresetIds,
        assignmentMode: "deterministic-by-scene-index",
        strength: motionStrength,
      },
      motionAssignmentSalt: options?.motionAssignmentSalt,
    });
  }, [
    scenePackResult,
    sceneImages,
    sceneDurationOverrides,
    narration,
    music,
    transitionsEnabled,
    allowedTransitionPresetIds,
    transitionDurationMs,
    motionEnabled,
    allowedMotionPresetIds,
    motionStrength,
  ]);

  const renderProject = useMemo(() => buildRenderProjectFromCurrentState(), [
    buildRenderProjectFromCurrentState,
  ]);

  const assignedMotionCount = renderProject.scenes.filter((scene) => scene.motionPreset).length;
  const sceneOverrideCount = Object.keys(sceneDurationOverrides).length;
  const durationDeltaSeconds =
    typeof activeNarrationAsset?.duration === "number" &&
    typeof result?.totalEstimatedDurationSeconds === "number"
      ? activeNarrationAsset.duration - result.totalEstimatedDurationSeconds
      : undefined;
  const isRenderBusy = renderStatus === "rendering";

  const handleRenderVideo = useCallback(async () => {
    if (isRenderBusy) {
      return;
    }

    const renderSessionSeed = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    const renderProjectForRequest = buildRenderProjectFromCurrentState({
      motionAssignmentSalt: renderSessionSeed,
      renderSessionSeed,
    });

    if (!renderProjectForRequest.isReady) {
      setRenderStatus("error");
      setRenderError("Render project is not ready.");
      setRenderResult(null);
      setLastRenderMotionAssignments(
        renderProjectForRequest.scenes.map((scene) => ({
          order: scene.order,
          motionPreset: scene.motionPreset || "static",
        })),
      );
      setLastRenderTransitionAssignments(
        renderProjectForRequest.scenes
          .slice(0, -1)
          .map((scene) => ({
            order: scene.order,
            transitionType: scene.transitionType || "cut",
            transitionDurationMs: scene.transitionDurationMs || 0,
          })),
      );
      return;
    }

    setLastRenderMotionAssignments(
      renderProjectForRequest.scenes.map((scene) => ({
        order: scene.order,
        motionPreset: scene.motionPreset || "static",
      })),
    );
    setLastRenderTransitionAssignments(
      renderProjectForRequest.scenes
        .slice(0, -1)
        .map((scene) => ({
          order: scene.order,
          transitionType: scene.transitionType || "cut",
          transitionDurationMs: scene.transitionDurationMs || 0,
        })),
    );
    setRenderStatus("rendering");
    setRenderError(null);
    setRenderResult(null);

    let response: Response;
    try {
      response = await fetch("/api/render/prototype", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ renderProject: renderProjectForRequest }),
      });
    } catch {
      setRenderStatus("error");
      setRenderError("Video render failed. Please try again.");
      return;
    }

    const payload = (await response.json().catch(() => null)) as
      | RenderPrototypeSuccessResponse
      | RenderPrototypeErrorResponse
      | null;

    if (!response.ok || !payload || !payload.success) {
      const errorPayload = payload as RenderPrototypeErrorResponse | null;
      const message = errorPayload?.message || "Video render failed. Please try again.";
      const code = errorPayload?.errorCode;
      setRenderStatus("error");
      setRenderError(code ? `${message} [${code}]` : message);
      return;
    }

    setRenderStatus("success");
    setRenderResult(payload);
  }, [isRenderBusy, buildRenderProjectFromCurrentState]);

  const openSnapshotInNewTab = useCallback((routePath: "/studio-preview") => {
    let targetUrl: string = routePath;
    try {
      const renderSessionSeed = createRenderSessionSeed();
      const renderProjectForSnapshot = buildRenderProjectFromCurrentState({
        motionAssignmentSalt: renderSessionSeed,
        renderSessionSeed,
      });
      const snapshot = buildPreviewSnapshot({
        renderProject: renderProjectForSnapshot,
        renderSessionSeed,
      });
      persistPreviewSnapshot(window.localStorage, snapshot);
      const snapshotIdParam = encodeURIComponent(snapshot.snapshotId);
      targetUrl = `${routePath}?snapshotId=${snapshotIdParam}`;
      setPreviewError(null);
    } catch {
      setPreviewError("Could not prepare preview data.");
      return;
    }

    const openedWindow = window.open(targetUrl, "_blank", "noopener,noreferrer");
    if (!openedWindow) {
      setPreviewError("Preview tab was blocked by your browser. Please allow pop-ups and try again.");
    }
  }, [buildRenderProjectFromCurrentState]);

  const handlePreviewVideo = useCallback(() => {
    openSnapshotInNewTab("/studio-preview");
  }, [openSnapshotInNewTab]);

  const handleClearGeneratedFiles = useCallback(async () => {
    if (isClearingGenerated || isRenderBusy) {
      return;
    }

    const shouldClear = window.confirm("Clear all files in public/generated? This removes generated images, audio, and renders.");
    if (!shouldClear) {
      return;
    }

    setIsClearingGenerated(true);
    setClearGeneratedMessage(null);

    let response: Response;
    try {
      response = await fetch("/api/generated/clear", { method: "POST" });
    } catch {
      setIsClearingGenerated(false);
      setClearGeneratedMessage("Could not reach the clear-generated route.");
      return;
    }

    const payload = (await response.json().catch(() => null)) as
      | ClearGeneratedSuccessResponse
      | ClearGeneratedErrorResponse
      | null;

    if (!response.ok || !payload || !payload.success) {
      const errorPayload = payload as ClearGeneratedErrorResponse | null;
      setIsClearingGenerated(false);
      setClearGeneratedMessage(errorPayload?.message || "Could not clear generated files.");
      return;
    }

    clearAllSceneImages();
    clearSceneDurationOverrides();
    clearNarrationAsset();
    setRenderStatus("idle");
    setRenderResult(null);
    setRenderError(null);
    setClearGeneratedMessage(payload.message);
    setIsClearingGenerated(false);
  }, [isClearingGenerated, isRenderBusy, clearAllSceneImages, clearSceneDurationOverrides, clearNarrationAsset]);

  const toggleAllowedMotionPreset = useCallback((presetId: MotionPresetId) => {
    setAllowedMotionPresetIds((current) => {
      if (current.includes(presetId)) {
        return current.filter((candidate) => candidate !== presetId);
      }
      return [...current, presetId];
    });
  }, []);

  const toggleAllowedTransitionPreset = useCallback((presetId: TransitionType) => {
    setAllowedTransitionPresetIds((current) => {
      if (current.includes(presetId)) {
        return current.filter((candidate) => candidate !== presetId);
      }
      return [...current, presetId];
    });
  }, []);

  const updateSceneDurationOverride = useCallback((sceneIndex: number, value: string) => {
    setSceneDurationOverrideInputs((current) => {
      if (!value.trim()) {
        if (!(sceneIndex in current)) {
          return current;
        }
        const next = { ...current };
        delete next[sceneIndex];
        return next;
      }

      return {
        ...current,
        [sceneIndex]: value,
      };
    });
  }, []);

  const state: WizardState = {
    scriptText,
    result,
    scenePackResult,
    error,
    inputFeedback,
    splitWarnings,
    scenePackError,
    isSplitting,
    minSceneDurationSeconds,
    maxSceneDurationSeconds,
    sceneImages,
    sceneImageErrors,
    activeDropSceneIndex,
    imageSourceMode,
    nanobananaModel,
    selectedVisualStyle,
    nanobananaApiKeyOverride,
    sceneGenerationStates,
    narration,
    isNarrationDropActive,
    music,
    isMusicUploading,
    musicError,
    elevenLabsVoices,
    elevenLabsModels,
    isLoadingElevenLabsOptions,
    elevenLabsOptionsError,
    isBatchGenerating,
    batchProgress,
    renderStatus,
    renderResult,
    renderError,
    previewError,
    sceneDurationOverrideInputs,
    lastRenderMotionAssignments,
    lastRenderTransitionAssignments,
    isClearingGenerated,
    clearGeneratedMessage,
    motionEnabled,
    allowedMotionPresetIds,
    motionStrength,
    transitionsEnabled,
    allowedTransitionPresetIds,
    transitionDurationMs,
  };

  const actions = {
    // Setters
    setScriptText,
    setResult,
    setScenePackResult,
    setError,
    setInputFeedback,
    setSplitWarnings,
    setScenePackError,
    setIsSplitting,
    setMinSceneDurationSeconds,
    setMaxSceneDurationSeconds,
    setSceneImages,
    setSceneImageErrors,
    setActiveDropSceneIndex,
    setImageSourceMode,
    setNanobananaModel,
    setSelectedVisualStyle,
    setNanobananaApiKeyOverride,
    setSceneGenerationStates,
    setNarration,
    setIsNarrationDropActive,
    setMusic,
    setIsMusicUploading,
    setMusicError,
    setElevenLabsVoices,
    setElevenLabsModels,
    setIsLoadingElevenLabsOptions,
    setElevenLabsOptionsError,
    setIsBatchGenerating,
    setBatchProgress,
    setRenderStatus,
    setRenderResult,
    setRenderError,
    setPreviewError,
    setSceneDurationOverrideInputs,
    setLastRenderMotionAssignments,
    setLastRenderTransitionAssignments,
    setIsClearingGenerated,
    setClearGeneratedMessage,
    setMotionEnabled,
    setAllowedMotionPresetIds,
    setMotionStrength,
    setTransitionsEnabled,
    setAllowedTransitionPresetIds,
    setTransitionDurationMs,
    // Action functions
    clearNarrationAsset,
    clearSceneDurationOverrides,
    clearMusicFile,
    applyManualNarrationFile,
    applyMusicFile,
    openNarrationFilePicker,
    openMusicFilePicker,
    updateElevenLabsSettings,
    loadElevenLabsOptions,
    generateElevenLabsNarration,
    clearSceneImageErrorsFor,
    clearAllSceneImages,
    removeSceneImage,
    applySceneImageFile,
    generateSceneImage,
    runBatchGeneration,
    openSceneFilePicker,
    handleSplit,
    handleLoadSample,
    handlePackScenes,
    getSceneGenerationStatus,
    getPerSceneGenerateLabel,
    formatBatchMode,
    buildRenderProjectFromCurrentState,
    handleRenderVideo,
    handlePreviewVideo,
    handleClearGeneratedFiles,
    toggleAllowedMotionPreset,
    toggleAllowedTransitionPreset,
    updateSceneDurationOverride,
  };

  return {
    state,
    actions,
  };
}
