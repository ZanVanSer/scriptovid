"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import {
  DEFAULT_NANOBANANA_MODEL,
  NANOBANANA_MODELS,
  NanobananaError,
  generateNanobananaImage,
  type NanobananaModel,
} from "@/modules/image-generation/nanobanana";
import {
  DEFAULT_VISUAL_STYLE_PRESET_ID,
  VISUAL_STYLE_PRESETS,
  buildSceneImagePrompt,
  type VisualStylePresetId,
} from "@/modules/image-generation/prompt-builder";
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
  type NarrationMode,
  type NarrationState,
} from "@/types/narration";
import type { ScenePackResult } from "@/types/scene";
import type { SentenceSplitResponse } from "@/types/sentence";

import styles from "./page.module.css";

type SceneImageState = {
  label: string;
  objectUrl: string;
  filePath?: string;
  mimeType?: string;
  source: "manual" | "nanobanana";
  generatedPrompt?: string;
  generatedModel?: string;
};

const ACCEPTED_IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);
const ACCEPTED_IMAGE_EXTENSIONS = [".png", ".jpg", ".jpeg", ".webp"];
const ACCEPTED_AUDIO_TYPES = new Set([
  "audio/mpeg",
  "audio/wav",
  "audio/x-wav",
  "audio/mp4",
  "audio/aac",
  "audio/ogg",
]);
const ACCEPTED_AUDIO_EXTENSIONS = [".mp3", ".wav", ".m4a", ".aac", ".ogg"];
type ImageSourceMode = "manual" | "nanobanana";
type SceneGenerationStatus = "idle" | "loading" | "done" | "error";

type SceneGenerationState = {
  status: SceneGenerationStatus;
  errorMessage?: string;
  usedPrompt?: string;
  usedModel?: NanobananaModel;
  imageUrl?: string;
};
type BatchGenerationMode = "generate-all" | "regenerate-all" | "regenerate-failed";
const DEFAULT_ELEVENLABS_MODEL_ID = "eleven_multilingual_v2";

type ElevenLabsNarrationSuccessResponse = {
  success: true;
  audioUrl: string;
  audioPath: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  provider: "elevenlabs";
  voiceId: string;
  modelId: string;
};

type ElevenLabsNarrationErrorResponse = {
  success: false;
  errorCode: string;
  message: string;
  details?: string;
};

type ElevenLabsOption = {
  id: string;
  name: string;
};

type ElevenLabsOptionsSuccessResponse = {
  success: true;
  voices: ElevenLabsOption[];
  models: ElevenLabsOption[];
};

type ElevenLabsOptionsErrorResponse = {
  success: false;
  errorCode: string;
  message: string;
  details?: string;
};

type UploadImageSuccessResponse = {
  success: true;
  fileName: string;
  filePath: string;
  publicUrl: string;
  mimeType: string;
  fileSize: number;
};

type UploadImageErrorResponse = {
  success: false;
  errorCode: string;
  message: string;
};

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

type RenderPrototypeSuccessResponse = {
  success: true;
  outputPath: string;
  outputUrl: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
};

type RenderPrototypeErrorResponse = {
  success: false;
  errorCode: string;
  message: string;
};

type ClearGeneratedSuccessResponse = {
  success: true;
  message: string;
};

type ClearGeneratedErrorResponse = {
  success: false;
  errorCode: string;
  message: string;
};

function formatSeconds(seconds: number) {
  return `${seconds.toFixed(1)}s`;
}

function formatDurationClock(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) {
    return "—";
  }

  const totalSeconds = Math.round(seconds);
  const minutes = Math.floor(totalSeconds / 60);
  const remainingSeconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(remainingSeconds).padStart(2, "0")}`;
}

function formatFileSize(bytes: number) {
  if (!Number.isFinite(bytes) || bytes < 0) {
    return "—";
  }

  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isAllowedImageFile(file: File) {
  if (ACCEPTED_IMAGE_TYPES.has(file.type)) {
    return true;
  }

  const lowerName = file.name.toLowerCase();
  return ACCEPTED_IMAGE_EXTENSIONS.some((extension) => lowerName.endsWith(extension));
}

function isAllowedAudioFile(file: File) {
  if (ACCEPTED_AUDIO_TYPES.has(file.type)) {
    return true;
  }

  const lowerName = file.name.toLowerCase();
  return ACCEPTED_AUDIO_EXTENSIONS.some((extension) => lowerName.endsWith(extension));
}

function extractAudioDurationFromAudioSource(audioSourceUrl: string) {
  return new Promise<number | undefined>((resolve) => {
    const audio = document.createElement("audio");
    let isSettled = false;

    const settle = (duration?: number) => {
      if (isSettled) {
        return;
      }
      isSettled = true;
      audio.removeAttribute("src");
      audio.load();
      resolve(duration);
    };

    audio.preload = "metadata";
    audio.onloadedmetadata = () => {
      const duration = Number.isFinite(audio.duration) ? audio.duration : undefined;
      settle(duration);
    };
    audio.onerror = () => {
      settle(undefined);
    };
    audio.src = audioSourceUrl;
  });
}

function isObjectUrl(url: string) {
  return url.startsWith("blob:");
}

function revokeAudioObjectUrlIfNeeded(url?: string) {
  if (url && isObjectUrl(url)) {
    URL.revokeObjectURL(url);
  }
}

function revokeImageObjectUrlIfNeeded(url?: string) {
  if (url && isObjectUrl(url)) {
    URL.revokeObjectURL(url);
  }
}

export default function Home() {
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
  const [renderStatus, setRenderStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [renderResult, setRenderResult] = useState<RenderPrototypeSuccessResponse | null>(null);
  const [renderError, setRenderError] = useState<string | null>(null);
  const [isClearingGenerated, setIsClearingGenerated] = useState(false);
  const [clearGeneratedMessage, setClearGeneratedMessage] = useState<string | null>(null);

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

  function clearNarrationAsset() {
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
  }

  async function uploadImageToLocalStorage(file: File) {
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
  }

  async function uploadAudioToLocalStorage(file: File) {
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
  }

  async function applyManualNarrationFile(file: File) {
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
  }

  function openNarrationFilePicker() {
    const input = document.getElementById("narration-upload") as HTMLInputElement | null;
    input?.click();
  }

  function updateElevenLabsSettings(
    field: "voiceId" | "modelId" | "stability" | "similarityBoost" | "style" | "useSpeakerBoost",
    value: string | number | boolean,
  ) {
    setNarration((current) => ({
      ...current,
      elevenLabs: {
        ...current.elevenLabs,
        [field]: value,
      },
    }));
  }

  async function loadElevenLabsOptions() {
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
  }

  useEffect(() => {
    if (narration.mode !== "elevenlabs") {
      return;
    }

    if (elevenLabsVoices.length > 0 && elevenLabsModels.length > 0) {
      return;
    }

    void loadElevenLabsOptions();
  }, [narration.mode, elevenLabsVoices.length, elevenLabsModels.length]);

  async function generateElevenLabsNarration() {
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
  }

  function clearSceneImageErrorsFor(sceneIndex: number) {
    setSceneImageErrors((current) => {
      if (!current[sceneIndex]) {
        return current;
      }

      const next = { ...current };
      delete next[sceneIndex];
      return next;
    });
  }

  function clearAllSceneImages() {
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
  }

  function removeSceneImage(sceneIndex: number) {
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
  }

  async function applySceneImageFile(sceneIndex: number, file: File) {
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
        usedPrompt: scenePrompts[sceneIndex] || current[sceneIndex]?.usedPrompt,
        usedModel: nanobananaModel,
        errorMessage: undefined,
        imageUrl: uploaded.publicUrl,
      },
    }));
  }

  function resolveNanobananaApiKey() {
    const overrideKey = nanobananaApiKeyOverride.trim();
    if (overrideKey) {
      return overrideKey;
    }

    return process.env.NEXT_PUBLIC_GEMINI_API_KEY || "";
  }

  async function generateSceneImage(sceneIndex: number, prompt: string, forcedApiKey?: string) {
    const apiKey = forcedApiKey || resolveNanobananaApiKey();
    if (!apiKey) {
      const message =
        "Gemini API key is missing. Set NEXT_PUBLIC_GEMINI_API_KEY or provide a local override key.";
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
      return;
    }

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
      const result = await generateNanobananaImage({
        prompt,
        model: nanobananaModel,
        apiKey,
        aspectRatio: "16:9",
      });

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
      if (generationError instanceof NanobananaError) {
        message = generationError.message;
      } else if (generationError instanceof Error) {
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
  }

  function getBatchTargetScenes(mode: BatchGenerationMode) {
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
  }

  async function runBatchGeneration(mode: BatchGenerationMode) {
    if (!scenePackResult || scenePackResult.scenes.length === 0) {
      return;
    }

    const targetScenes = getBatchTargetScenes(mode);
    if (targetScenes.length === 0) {
      return;
    }

    const apiKey = resolveNanobananaApiKey();
    if (!apiKey) {
      const message =
        "Gemini API key is missing. Set NEXT_PUBLIC_GEMINI_API_KEY or provide a local override key.";
      setSceneGenerationStates((current) => {
        const next = { ...current };
        targetScenes.forEach((scene) => {
          next[scene.index] = {
            status: "error",
            errorMessage: message,
            usedPrompt: scenePrompts[scene.index] || scene.text,
            usedModel: nanobananaModel,
            imageUrl: undefined,
          };
        });
        return next;
      });
      setSceneImageErrors((current) => {
        const next = { ...current };
        targetScenes.forEach((scene) => {
          next[scene.index] = message;
        });
        return next;
      });
      return;
    }

    setIsBatchGenerating(true);
    setBatchProgress({ completed: 0, total: targetScenes.length, mode });

    for (let index = 0; index < targetScenes.length; index += 1) {
      const scene = targetScenes[index];
      const prompt = scenePrompts[scene.index] || scene.text;
      await generateSceneImage(scene.index, prompt, apiKey);
      setBatchProgress({
        completed: index + 1,
        total: targetScenes.length,
        mode,
      });
    }

    setIsBatchGenerating(false);
  }

  function openSceneFilePicker(sceneIndex: number) {
    const input = document.getElementById(`scene-upload-${sceneIndex}`) as HTMLInputElement | null;
    input?.click();
  }

  async function handleSplit() {
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
  }

  function handleLoadSample() {
    clearAllSceneImages();
    setScriptText(SAMPLE_SCRIPT);
    setResult(null);
    setScenePackResult(null);
    setError(null);
    setInputFeedback(null);
    setSplitWarnings([]);
    setScenePackError(null);
  }

  function handlePackScenes() {
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
    setScenePackResult(packed);
  }

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

  function getSceneGenerationStatus(sceneIndex: number): SceneGenerationState {
    return sceneGenerationStates[sceneIndex] || { status: "idle" };
  }

  function getPerSceneGenerateLabel(sceneIndex: number) {
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
  }

  function formatBatchMode(mode: BatchGenerationMode) {
    if (mode === "regenerate-all") {
      return "regenerate all";
    }
    if (mode === "regenerate-failed") {
      return "regenerate failed";
    }
    return "generate all";
  }

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
  }, [scenePackResult, sceneGenerationStates]);

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
  const renderProject = useMemo(
    () =>
      buildRenderProject({
        scenePackResult,
        sceneImages,
        narration,
      }),
    [scenePackResult, sceneImages, narration],
  );
  const durationDeltaSeconds =
    typeof activeNarrationAsset?.duration === "number" &&
    typeof result?.totalEstimatedDurationSeconds === "number"
      ? activeNarrationAsset.duration - result.totalEstimatedDurationSeconds
      : undefined;
  const isRenderBusy = renderStatus === "loading";

  async function handleRenderVideo() {
    if (!renderProject.isReady || isRenderBusy) {
      return;
    }

    setRenderStatus("loading");
    setRenderError(null);
    setRenderResult(null);

    let response: Response;
    try {
      response = await fetch("/api/render/prototype", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ renderProject }),
      });
    } catch {
      setRenderStatus("error");
      setRenderError("Could not reach the local render route.");
      return;
    }

    const payload = (await response.json().catch(() => null)) as
      | RenderPrototypeSuccessResponse
      | RenderPrototypeErrorResponse
      | null;

    if (!response.ok || !payload || !payload.success) {
      const errorPayload = payload as RenderPrototypeErrorResponse | null;
      setRenderStatus("error");
      setRenderError(errorPayload?.message || "Rendering failed.");
      return;
    }

    setRenderStatus("success");
    setRenderResult(payload);
  }

  async function handleClearGeneratedFiles() {
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
    clearNarrationAsset();
    setRenderStatus("idle");
    setRenderResult(null);
    setRenderError(null);
    setClearGeneratedMessage(payload.message);
    setIsClearingGenerated(false);
  }

  return (
    <div className={styles.page}>
      <main className={styles.container}>
        <section className={styles.panel}>
          <div className={styles.sectionRow}>
            <p className={styles.sectionTitle}>1. Script input</p>
          </div>
          <label htmlFor="script-input" className={styles.label}>
            Paste script
          </label>
          <textarea
            id="script-input"
            className={styles.textarea}
            value={scriptText}
            onChange={(event) => setScriptText(event.target.value)}
            placeholder="Paste script text here..."
          />

          <div className={styles.actions}>
            <button type="button" className={styles.button} onClick={handleLoadSample}>
              Load sample text
            </button>
            <button
              type="button"
              className={styles.buttonPrimary}
              onClick={handleSplit}
              disabled={isSplitting}
            >
              {isSplitting ? "Splitting..." : "Split script"}
            </button>
          </div>
          {error ? <p className={styles.error}>{error}</p> : null}
          {inputFeedback ? <p className={styles.info}>{inputFeedback}</p> : null}
        </section>

        <section className={styles.panel}>
          <div className={styles.sectionRow}>
            <p className={styles.sectionTitle}>2. Scene review setup</p>
          </div>
          <div className={styles.summaryGrid}>
            <div className={styles.summaryItem}>Sentences: {result?.sentenceCount ?? 0}</div>
            <div className={styles.summaryItem}>Words: {result?.totalWordCount ?? 0}</div>
            <div className={styles.summaryItem}>
              Narration estimate: {formatSeconds(result?.totalEstimatedDurationSeconds ?? 0)}
            </div>
            <div className={styles.summaryItem}>Timing baseline: {DEFAULT_WORDS_PER_MINUTE} WPM</div>
          </div>
          <div className={styles.modeControls}>
            <label className={styles.field}>
              <span className={styles.fieldLabel}>Image source mode</span>
              <select
                className={styles.selectInput}
                value={imageSourceMode}
                onChange={(event) => {
                  setImageSourceMode(event.target.value as ImageSourceMode);
                  setActiveDropSceneIndex(null);
                }}
              >
                <option value="manual">Manual upload</option>
                <option value="nanobanana">Nanobanana API</option>
              </select>
            </label>
            <label className={styles.field}>
              <span className={styles.fieldLabel}>Visual style preset</span>
              <select
                className={styles.selectInput}
                value={selectedVisualStyle}
                onChange={(event) => setSelectedVisualStyle(event.target.value as VisualStylePresetId)}
              >
                {VISUAL_STYLE_PRESETS.map((stylePreset) => (
                  <option key={stylePreset.id} value={stylePreset.id}>
                    {stylePreset.label}
                  </option>
                ))}
              </select>
            </label>
            {imageSourceMode === "nanobanana" ? (
              <>
                <label className={styles.field}>
                  <span className={styles.fieldLabel}>Nanobanana model</span>
                  <select
                    className={styles.selectInput}
                    value={nanobananaModel}
                    onChange={(event) => setNanobananaModel(event.target.value as NanobananaModel)}
                  >
                    {NANOBANANA_MODELS.map((modelOption) => (
                      <option key={modelOption} value={modelOption}>
                        {modelOption}
                      </option>
                    ))}
                  </select>
                </label>
                <label className={styles.field}>
                  <span className={styles.fieldLabel}>Local API key override (optional)</span>
                  <input
                    type="password"
                    className={styles.numberInput}
                    value={nanobananaApiKeyOverride}
                    onChange={(event) => setNanobananaApiKeyOverride(event.target.value)}
                    placeholder="Use NEXT_PUBLIC_GEMINI_API_KEY if empty"
                  />
                </label>
              </>
            ) : null}
          </div>
          <div className={styles.controlsGrid}>
            <label className={styles.field}>
              <span className={styles.fieldLabel}>Min scene duration (s)</span>
              <input
                type="number"
                min="0.1"
                step="0.1"
                className={styles.numberInput}
                value={minSceneDurationSeconds}
                onChange={(event) => setMinSceneDurationSeconds(event.target.value)}
              />
            </label>
            <label className={styles.field}>
              <span className={styles.fieldLabel}>Max scene duration (s)</span>
              <input
                type="number"
                min="0.1"
                step="0.1"
                className={styles.numberInput}
                value={maxSceneDurationSeconds}
                onChange={(event) => setMaxSceneDurationSeconds(event.target.value)}
              />
            </label>
          </div>
          <div className={styles.actions}>
            <button
              type="button"
              className={styles.buttonPrimary}
              onClick={handlePackScenes}
              disabled={!result || result.sentences.length === 0}
            >
              Build storyboard scenes
            </button>
          </div>
          {scenePackError ? <p className={styles.error}>{scenePackError}</p> : null}
        </section>

        <section className={styles.panel}>
          <div className={styles.sectionRow}>
            <p className={styles.sectionTitle}>3. Storyboard review</p>
            <span className={styles.count}>Scenes: {scenePackResult?.totalSceneCount ?? 0}</span>
          </div>
          <div className={styles.summaryGrid}>
            <div className={styles.summaryItem}>
              Total scene duration:{" "}
              {formatSeconds(scenePackResult?.totalEstimatedDurationSeconds ?? 0)}
            </div>
            {imageSourceMode === "nanobanana" ? (
              <>
                <div className={styles.summaryItem}>Done: {generationSummary.done}</div>
                <div className={styles.summaryItem}>Errors: {generationSummary.error}</div>
                <div className={styles.summaryItem}>Loading: {generationSummary.loading}</div>
              </>
            ) : null}
          </div>
          {imageSourceMode === "nanobanana" ? (
            <div className={styles.actions}>
              <button
                type="button"
                className={styles.buttonPrimary}
                onClick={() => runBatchGeneration("generate-all")}
                disabled={!scenePackResult || scenePackResult.scenes.length === 0 || isBatchGenerating}
              >
                Generate all images
              </button>
              <button
                type="button"
                className={styles.button}
                onClick={() => runBatchGeneration("regenerate-all")}
                disabled={!scenePackResult || scenePackResult.scenes.length === 0 || isBatchGenerating}
              >
                Regenerate all images
              </button>
              <button
                type="button"
                className={styles.button}
                onClick={() => runBatchGeneration("regenerate-failed")}
                disabled={!scenePackResult || scenePackResult.scenes.length === 0 || isBatchGenerating}
              >
                Regenerate failed images
              </button>
              {isBatchGenerating && batchProgress ? (
                <p className={styles.modeNote}>
                  Running {formatBatchMode(batchProgress.mode)}: {batchProgress.completed}/
                  {batchProgress.total}
                </p>
              ) : null}
            </div>
          ) : null}
          {scenePackResult && scenePackResult.scenes.length > 0 ? (
            <ol className={styles.storyboardStrip}>
              {scenePackResult.scenes.map((scene) => (
                <li key={scene.index} className={styles.storyboardCard}>
                  <div className={styles.cardHeader}>
                    <p className={styles.cardTitle}>Scene {scene.index}</p>
                    <p className={styles.cardMeta}>{formatSeconds(scene.estimatedDurationSeconds)}</p>
                  </div>
                  <div
                    className={`${styles.imagePlaceholder} ${
                      activeDropSceneIndex === scene.index ? styles.imagePlaceholderActive : ""
                    } ${styles.imagePlaceholderClickable}`}
                    onClick={() => {
                      openSceneFilePicker(scene.index);
                    }}
                    onDragEnter={(event) => {
                      event.preventDefault();
                      setActiveDropSceneIndex(scene.index);
                    }}
                    onDragOver={(event) => {
                      event.preventDefault();
                      setActiveDropSceneIndex(scene.index);
                    }}
                    onDragLeave={(event) => {
                      event.preventDefault();
                      if (activeDropSceneIndex === scene.index) {
                        setActiveDropSceneIndex(null);
                      }
                    }}
                    onDrop={(event) => {
                      event.preventDefault();
                      setActiveDropSceneIndex(null);
                      const file = event.dataTransfer.files.item(0);
                      if (file) {
                        void applySceneImageFile(scene.index, file);
                      }
                    }}
                  >
                    {sceneImages[scene.index] ? (
                      <img
                        src={sceneImages[scene.index].objectUrl}
                        alt={`Scene ${scene.index} uploaded preview`}
                        className={styles.sceneImage}
                      />
                    ) : (
                      <p className={styles.placeholderText}>
                        {imageSourceMode === "manual"
                          ? "Image placeholder"
                          : "Generated image placeholder"}
                      </p>
                    )}
                  </div>
                  <input
                    id={`scene-upload-${scene.index}`}
                    type="file"
                    accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp"
                    className={styles.fileInput}
                    onChange={(event) => {
                      const file = event.target.files?.item(0);
                      if (file) {
                        void applySceneImageFile(scene.index, file);
                      }
                      event.target.value = "";
                    }}
                  />
                  {imageSourceMode === "nanobanana" ? (
                    <div className={styles.cardActions}>
                      <button
                        type="button"
                        className={styles.smallButton}
                        disabled={
                          getSceneGenerationStatus(scene.index).status === "loading" || isBatchGenerating
                        }
                        onClick={() => generateSceneImage(scene.index, scenePrompts[scene.index] || scene.text)}
                      >
                        {getPerSceneGenerateLabel(scene.index)}
                      </button>
                      <p className={styles.modeNote}>Uses selected style + model for this scene.</p>
                    </div>
                  ) : null}
                  <div className={styles.cardActions}>
                    <label htmlFor={`scene-upload-${scene.index}`} className={styles.smallButton}>
                      {sceneImages[scene.index] ? "Replace" : "Upload"}
                    </label>
                    {sceneImages[scene.index] ? (
                      <button
                        type="button"
                        className={styles.smallButton}
                        onClick={() => removeSceneImage(scene.index)}
                      >
                        Remove
                      </button>
                    ) : null}
                    {imageSourceMode === "nanobanana" ? (
                      <p className={styles.modeNote}>Manual upload can override generated result.</p>
                    ) : null}
                  </div>
                  {sceneImages[scene.index] ? (
                    <p className={styles.fileMeta}>{sceneImages[scene.index].label}</p>
                  ) : null}
                  {imageSourceMode === "nanobanana" ? (
                    <div className={styles.statusRow}>
                      <span
                        className={`${styles.statusPill} ${
                          getSceneGenerationStatus(scene.index).status === "done"
                            ? styles.statusDone
                            : getSceneGenerationStatus(scene.index).status === "error"
                              ? styles.statusError
                              : getSceneGenerationStatus(scene.index).status === "loading"
                                ? styles.statusLoading
                                : styles.statusIdle
                        }`}
                      >
                        {getSceneGenerationStatus(scene.index).status}
                      </span>
                      <span className={styles.fileMeta}>
                        {getSceneGenerationStatus(scene.index).usedModel
                          ? `Model: ${getSceneGenerationStatus(scene.index).usedModel}`
                          : `Model: ${nanobananaModel}`}
                      </span>
                    </div>
                  ) : null}
                  {sceneImageErrors[scene.index] ? (
                    <p className={styles.inlineError}>{sceneImageErrors[scene.index]}</p>
                  ) : null}
                  <p className={styles.scenePreview}>{scene.text}</p>
                  <details className={styles.promptDetails}>
                    <summary className={styles.promptSummary}>Prompt preview</summary>
                    <p className={styles.promptSource}>Scene text: {scene.text}</p>
                    <p className={styles.promptText}>{scenePrompts[scene.index] || "Prompt unavailable."}</p>
                    {getSceneGenerationStatus(scene.index).usedPrompt ? (
                      <p className={styles.promptSource}>
                        Last generated prompt: {getSceneGenerationStatus(scene.index).usedPrompt}
                      </p>
                    ) : null}
                    {getSceneGenerationStatus(scene.index).errorMessage ? (
                      <p className={styles.promptSource}>
                        Last error: {getSceneGenerationStatus(scene.index).errorMessage}
                      </p>
                    ) : null}
                  </details>
                </li>
              ))}
            </ol>
          ) : (
            <div className={styles.emptyState}>Split script and build scenes to review storyboard cards.</div>
          )}
        </section>

        <section className={styles.panel}>
          <div className={styles.sectionRow}>
            <p className={styles.sectionTitle}>4. Narration</p>
          </div>
          <div className={styles.modeControls}>
            <label className={styles.field}>
              <span className={styles.fieldLabel}>Narration mode</span>
              <select
                className={styles.selectInput}
                value={narration.mode}
                onChange={(event) => {
                  const nextMode = event.target.value as NarrationMode;
                  setNarration((current) => ({
                    ...current,
                    mode: nextMode,
                    error: undefined,
                    elevenLabs: {
                      ...current.elevenLabs,
                      modelId: current.elevenLabs.modelId || DEFAULT_ELEVENLABS_MODEL_ID,
                    },
                  }));
                }}
              >
                <option value="manual">Manual upload</option>
                <option value="elevenlabs">ElevenLabs</option>
              </select>
            </label>
          </div>
          <div className={styles.summaryGrid}>
            <div className={styles.summaryItem}>Mode: {narration.mode}</div>
            <div className={styles.summaryItem}>Status: {narration.status}</div>
            <div className={styles.summaryItem}>Provider: {activeNarrationAsset?.provider || "—"}</div>
            <div className={styles.summaryItem}>
              Duration:{" "}
              {typeof activeNarrationAsset?.duration === "number"
                ? formatDurationClock(activeNarrationAsset.duration)
                : "—"}
            </div>
            <div className={styles.summaryItem}>Ready for render: {isNarrationReady ? "Yes" : "No"}</div>
          </div>
          {typeof durationDeltaSeconds === "number" ? (
            <p className={styles.info}>
              Script estimate vs narration: {durationDeltaSeconds >= 0 ? "+" : ""}
              {formatSeconds(durationDeltaSeconds)}
            </p>
          ) : null}
          {narration.mode === "manual" ? (
            <>
              <div
                className={`${styles.narrationDropzone} ${
                  isNarrationDropActive ? styles.narrationDropzoneActive : ""
                }`}
                onClick={openNarrationFilePicker}
                onDragEnter={(event) => {
                  event.preventDefault();
                  setIsNarrationDropActive(true);
                }}
                onDragOver={(event) => {
                  event.preventDefault();
                  setIsNarrationDropActive(true);
                }}
                onDragLeave={(event) => {
                  event.preventDefault();
                  setIsNarrationDropActive(false);
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  setIsNarrationDropActive(false);
                  const file = event.dataTransfer.files.item(0);
                  if (file) {
                    void applyManualNarrationFile(file);
                  }
                }}
              >
                <p className={styles.placeholderText}>
                  {activeNarrationAsset?.audioUrl
                    ? "Drop to replace narration audio"
                    : "Drop narration audio file here"}
                </p>
              </div>
              <input
                id="narration-upload"
                type="file"
                accept=".mp3,.wav,.m4a,.aac,.ogg,audio/mpeg,audio/wav,audio/x-wav,audio/mp4,audio/aac,audio/ogg"
                className={styles.fileInput}
                onChange={(event) => {
                  const file = event.target.files?.item(0);
                  if (file) {
                    void applyManualNarrationFile(file);
                  }
                  event.target.value = "";
                }}
              />
              <div className={styles.actions}>
                <button type="button" className={styles.smallButton} onClick={openNarrationFilePicker}>
                  {activeNarrationAsset?.audioUrl ? "Replace narration" : "Upload narration"}
                </button>
                {activeNarrationAsset?.audioUrl ? (
                  <button type="button" className={styles.smallButton} onClick={clearNarrationAsset}>
                    Remove narration
                  </button>
                ) : null}
              </div>
              {activeNarrationAsset?.audioUrl ? (
                <audio className={styles.narrationPlayer} controls src={activeNarrationAsset.audioUrl} />
              ) : null}
              <div className={styles.summaryGrid}>
                <div className={styles.summaryItem}>File: {activeNarrationAsset?.fileName || "—"}</div>
                <div className={styles.summaryItem}>MIME: {activeNarrationAsset?.mimeType || "—"}</div>
                <div className={styles.summaryItem}>
                  Size:{" "}
                  {typeof activeNarrationAsset?.fileSize === "number"
                    ? formatFileSize(activeNarrationAsset.fileSize)
                    : "—"}
                </div>
                <div className={styles.summaryItem}>
                  Duration:{" "}
                  {typeof activeNarrationAsset?.duration === "number"
                    ? formatDurationClock(activeNarrationAsset.duration)
                    : "—"}
                </div>
              </div>
            </>
          ) : (
            <>
              <div className={styles.controlsGrid}>
                <label className={styles.field}>
                  <span className={styles.fieldLabel}>Voice ID</span>
                  <select
                    className={styles.selectInput}
                    value={narration.elevenLabs.voiceId || ""}
                    onChange={(event) => updateElevenLabsSettings("voiceId", event.target.value)}
                    disabled={isLoadingElevenLabsOptions || elevenLabsVoices.length === 0}
                  >
                    <option value="">
                      {isLoadingElevenLabsOptions ? "Loading voices..." : "Select voice"}
                    </option>
                    {elevenLabsVoices.map((voiceOption) => (
                      <option key={voiceOption.id} value={voiceOption.id}>
                        {voiceOption.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className={styles.field}>
                  <span className={styles.fieldLabel}>Model ID</span>
                  <select
                    className={styles.selectInput}
                    value={narration.elevenLabs.modelId || ""}
                    onChange={(event) => updateElevenLabsSettings("modelId", event.target.value)}
                    disabled={isLoadingElevenLabsOptions || elevenLabsModels.length === 0}
                  >
                    <option value="">
                      {isLoadingElevenLabsOptions ? "Loading models..." : "Select model"}
                    </option>
                    {elevenLabsModels.map((modelOption) => (
                      <option key={modelOption.id} value={modelOption.id}>
                        {modelOption.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className={styles.actions}>
                <button
                  type="button"
                  className={styles.smallButton}
                  onClick={() => {
                    void loadElevenLabsOptions();
                  }}
                  disabled={isLoadingElevenLabsOptions}
                >
                  {isLoadingElevenLabsOptions ? "Refreshing..." : "Refresh voices/models"}
                </button>
                <p className={styles.modeNote}>Options are loaded from your ElevenLabs account tier.</p>
              </div>
              {elevenLabsOptionsError ? <p className={styles.error}>{elevenLabsOptionsError}</p> : null}
              <details className={styles.subDetails}>
                <summary className={styles.subSummary}>Advanced voice settings</summary>
                <div className={styles.controlsGrid}>
                  <label className={styles.field}>
                    <span className={styles.fieldLabel}>Stability (0-1)</span>
                    <input
                      type="number"
                      min="0"
                      max="1"
                      step="0.01"
                      className={styles.numberInput}
                      value={narration.elevenLabs.stability}
                      onChange={(event) =>
                        updateElevenLabsSettings("stability", Number(event.target.value))
                      }
                    />
                  </label>
                  <label className={styles.field}>
                    <span className={styles.fieldLabel}>Similarity boost (0-1)</span>
                    <input
                      type="number"
                      min="0"
                      max="1"
                      step="0.01"
                      className={styles.numberInput}
                      value={narration.elevenLabs.similarityBoost}
                      onChange={(event) =>
                        updateElevenLabsSettings("similarityBoost", Number(event.target.value))
                      }
                    />
                  </label>
                  <label className={styles.field}>
                    <span className={styles.fieldLabel}>Style (0-1)</span>
                    <input
                      type="number"
                      min="0"
                      max="1"
                      step="0.01"
                      className={styles.numberInput}
                      value={narration.elevenLabs.style}
                      onChange={(event) => updateElevenLabsSettings("style", Number(event.target.value))}
                    />
                  </label>
                  <label className={styles.checkboxField}>
                    <input
                      type="checkbox"
                      checked={narration.elevenLabs.useSpeakerBoost}
                      onChange={(event) =>
                        updateElevenLabsSettings("useSpeakerBoost", event.target.checked)
                      }
                    />
                    <span className={styles.fieldLabel}>Use speaker boost</span>
                  </label>
                </div>
              </details>
              <div className={styles.actions}>
                <button
                  type="button"
                  className={styles.buttonPrimary}
                  disabled={narration.status === "loading"}
                  onClick={() => {
                    void generateElevenLabsNarration();
                  }}
                >
                  {activeNarrationAsset?.provider === "elevenlabs" && activeNarrationAsset.audioUrl
                    ? narration.status === "loading"
                      ? "Regenerating..."
                      : "Regenerate narration"
                    : narration.status === "loading"
                      ? "Generating..."
                      : "Generate narration"}
                </button>
                {activeNarrationAsset?.audioUrl ? (
                  <button type="button" className={styles.button} onClick={clearNarrationAsset}>
                    Remove narration
                  </button>
                ) : null}
              </div>
              {activeNarrationAsset?.audioUrl ? (
                <audio className={styles.narrationPlayer} controls src={activeNarrationAsset.audioUrl} />
              ) : (
                <div className={styles.emptyState}>Generate narration from the full script to preview audio.</div>
              )}
              <div className={styles.summaryGrid}>
                <div className={styles.summaryItem}>File: {activeNarrationAsset?.fileName || "—"}</div>
                <div className={styles.summaryItem}>MIME: {activeNarrationAsset?.mimeType || "—"}</div>
                <div className={styles.summaryItem}>
                  Size:{" "}
                  {typeof activeNarrationAsset?.fileSize === "number"
                    ? formatFileSize(activeNarrationAsset.fileSize)
                    : "—"}
                </div>
                <div className={styles.summaryItem}>
                  Duration:{" "}
                  {typeof activeNarrationAsset?.duration === "number"
                    ? formatDurationClock(activeNarrationAsset.duration)
                    : "—"}
                </div>
                <div className={styles.summaryItem}>Provider: {activeNarrationAsset?.provider || "—"}</div>
                <div className={styles.summaryItem}>
                  Voice ID: {activeNarrationAsset?.voiceId || narration.elevenLabs.voiceId || "—"}
                </div>
                <div className={styles.summaryItem}>
                  Model ID: {activeNarrationAsset?.modelId || narration.elevenLabs.modelId || "—"}
                </div>
              </div>
            </>
          )}
          {narration.status === "loading" ? (
            <p className={styles.info}>
              {narration.mode === "elevenlabs" ? "Generating narration..." : "Reading audio metadata..."}
            </p>
          ) : null}
          {activeNarrationAsset?.audioUrl &&
          activeNarrationAsset.duration === undefined &&
          narration.status === "done" ? (
            <p className={styles.info}>Duration metadata is unavailable for this file.</p>
          ) : null}
          {narration.error ? (
            <p className={styles.error}>Error: {narration.error}</p>
          ) : null}
        </section>

        <section className={styles.panel}>
          <div className={styles.sectionRow}>
            <p className={styles.sectionTitle}>5. Render / Export</p>
          </div>
          <div className={styles.renderSummary}>
            <div className={styles.summaryGrid}>
              <div className={styles.summaryItem}>Scenes: {renderProject.scenes.length}</div>
              <div className={styles.summaryItem}>
                Estimated Duration: {formatDurationClock(renderProject.totalEstimatedSceneDuration)}
              </div>
              <div className={styles.summaryItem}>
                Final Duration: {formatDurationClock(renderProject.totalFinalSceneDuration)}
              </div>
              <div className={styles.summaryItem}>
                Narration Duration:{" "}
                {typeof renderProject.narrationDuration === "number"
                  ? formatDurationClock(renderProject.narrationDuration)
                  : "—"}
              </div>
              <div className={styles.summaryItem}>Timing Strategy: {renderProject.timingStrategy}</div>
              <div className={styles.summaryItem}>Render Ready: {renderProject.isReady ? "Yes" : "No"}</div>
            </div>
            {renderProject.issues.length > 0 ? (
              <ul className={styles.renderIssueList}>
                {renderProject.issues.map((issue, issueIndex) => (
                  <li
                    key={`${issue.code}-${issueIndex}`}
                    className={`${styles.renderIssueItem} ${
                      issue.level === "error" ? styles.renderIssueError : styles.renderIssueWarning
                    }`}
                  >
                    {issue.message}
                  </li>
                ))}
              </ul>
            ) : (
              <p className={styles.info}>No render validation issues.</p>
            )}
            <div className={styles.actions}>
              <button
                type="button"
                className={styles.buttonPrimary}
                onClick={() => {
                  void handleRenderVideo();
                }}
                disabled={!renderProject.isReady || isRenderBusy}
              >
                {isRenderBusy ? "Rendering..." : "Render Video"}
              </button>
              <button
                type="button"
                className={styles.smallButton}
                onClick={() => {
                  void handleClearGeneratedFiles();
                }}
                disabled={isClearingGenerated || isRenderBusy}
              >
                {isClearingGenerated ? "Clearing..." : "Clear generated files"}
              </button>
            </div>
            {renderStatus === "success" && renderResult ? (
              <div className={styles.summaryGrid}>
                <div className={styles.summaryItem}>File: {renderResult.fileName}</div>
                <div className={styles.summaryItem}>Size: {formatFileSize(renderResult.fileSize)}</div>
                <a className={styles.smallButton} href={renderResult.outputUrl} download={renderResult.fileName}>
                  Download MP4
                </a>
              </div>
            ) : null}
            {renderStatus === "error" && renderError ? <p className={styles.error}>{renderError}</p> : null}
            {clearGeneratedMessage ? <p className={styles.info}>{clearGeneratedMessage}</p> : null}
          </div>
        </section>

        <section className={styles.panel}>
          <details className={styles.previewDetails}>
            <summary className={styles.previewSummary}>Technical details</summary>
            <div className={styles.debugStack}>
              {splitWarnings.length > 0 ? (
                <ul className={styles.warningList}>
                  {splitWarnings.map((warning) => (
                    <li key={warning} className={styles.warningItem}>
                      {warning}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className={styles.info}>No split warnings.</p>
              )}

              <details className={styles.subDetails}>
                <summary className={styles.subSummary}>Normalized text preview</summary>
                <pre className={styles.preview}>
                  {result?.normalizedText || "Run split to see normalized text."}
                </pre>
              </details>

              <details className={styles.subDetails}>
                <summary className={styles.subSummary}>Scene metadata</summary>
                {scenePackResult && scenePackResult.scenes.length > 0 ? (
                  <ol className={styles.debugList}>
                    {scenePackResult.scenes.map((scene) => (
                      <li key={scene.index} className={styles.debugItem}>
                        <span className={styles.listMeta}>Scene {scene.index}</span>
                        <span className={styles.listMeta}>Words: {scene.totalWordCount}</span>
                        <span className={styles.listMeta}>Source units: {scene.sourceUnitCount}</span>
                        <span className={styles.listMeta}>Sentences: {scene.sentenceCount}</span>
                        <span className={styles.listMeta}>
                          Sentence indexes: {scene.sentenceIndexRange}
                        </span>
                        <span className={styles.listMeta}>Paragraph range: {scene.paragraphIndexRange}</span>
                        <span className={styles.listMeta}>
                          Crosses paragraph boundary: {scene.crossesParagraphBoundary ? "yes" : "no"}
                        </span>
                        <span className={styles.listMeta}>Unit sources: {scene.unitSourceTypeSummary}</span>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className={styles.info}>No scene metadata yet.</p>
                )}
              </details>
            </div>
          </details>
        </section>
      </main>
    </div>
  );
}
