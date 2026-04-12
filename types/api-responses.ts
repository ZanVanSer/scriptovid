import type { NanobananaModel } from "@/modules/image-generation/nanobanana";
import type { VisualStylePresetId } from "@/modules/image-generation/prompt-builder";
import type { NarrationState } from "@/types/narration";
import type { MusicState } from "@/types/music";
import type { MotionPresetId, MotionSettings, TransitionType } from "@/types/render-project";
import type { ScenePackResult } from "@/types/scene";
import type { SentenceSplitResponse } from "@/types/sentence";

export type SceneImageState = {
  label: string;
  objectUrl: string;
  filePath?: string;
  mimeType?: string;
  source: "manual" | "nanobanana";
  generatedPrompt?: string;
  generatedModel?: string;
};

export const ACCEPTED_IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);
export const ACCEPTED_IMAGE_EXTENSIONS = [".png", ".jpg", ".jpeg", ".webp"];
export const ACCEPTED_AUDIO_TYPES = new Set([
  "audio/mpeg",
  "audio/wav",
  "audio/x-wav",
  "audio/mp4",
  "audio/aac",
  "audio/ogg",
]);
export const ACCEPTED_AUDIO_EXTENSIONS = [".mp3", ".wav", ".m4a", ".aac", ".ogg"];

export type ImageSourceMode = "manual" | "nanobanana";
export type SceneGenerationStatus = "idle" | "loading" | "done" | "error";
export const DEFAULT_MUSIC_VOLUME = 25;

export type SceneGenerationState = {
  status: SceneGenerationStatus;
  errorMessage?: string;
  usedPrompt?: string;
  usedModel?: NanobananaModel;
  imageUrl?: string;
};
export type BatchGenerationMode = "generate-all" | "regenerate-all" | "regenerate-failed";
export const DEFAULT_ELEVENLABS_MODEL_ID = "eleven_multilingual_v2";

export type ElevenLabsNarrationSuccessResponse = {
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

export type ElevenLabsNarrationErrorResponse = {
  success: false;
  errorCode: string;
  message: string;
  details?: string;
};

export type ElevenLabsOption = {
  id: string;
  name: string;
};

export type ElevenLabsOptionsSuccessResponse = {
  success: true;
  voices: ElevenLabsOption[];
  models: ElevenLabsOption[];
};

export type ElevenLabsOptionsErrorResponse = {
  success: false;
  errorCode: string;
  message: string;
  details?: string;
};

export type UploadImageSuccessResponse = {
  success: true;
  fileName: string;
  filePath: string;
  publicUrl: string;
  mimeType: string;
  fileSize: number;
};

export type UploadImageErrorResponse = {
  success: false;
  errorCode: string;
  message: string;
};

export type UploadAudioSuccessResponse = {
  success: true;
  fileName: string;
  filePath: string;
  audioUrl: string;
  mimeType: string;
  fileSize: number;
};

export type UploadAudioErrorResponse = {
  success: false;
  errorCode: string;
  message: string;
};

export type RenderPrototypeSuccessResponse = {
  success: true;
  outputPath: string;
  outputUrl: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
};

export type RenderPrototypeErrorResponse = {
  success: false;
  errorCode: string;
  message: string;
};

export type NanobananaGenerateSuccessResponse = {
  success: true;
  imageUrl: string;
  mimeType: string;
};

export type NanobananaGenerateErrorResponse = {
  success: false;
  errorCode: string;
  message: string;
};

export type SceneMotionDebugRow = {
  order: number;
  motionPreset: string;
};

export type SceneTransitionDebugRow = {
  order: number;
  transitionType: string;
  transitionDurationMs: number;
};

export type ClearGeneratedSuccessResponse = {
  success: true;
  message: string;
};

export type ClearGeneratedErrorResponse = {
  success: false;
  errorCode: string;
  message: string;
};

export type RenderStatus = "idle" | "rendering" | "success" | "error";

export type WizardState = {
  scriptText: string;
  result: SentenceSplitResponse | null;
  scenePackResult: ScenePackResult | null;
  error: string | null;
  inputFeedback: string | null;
  splitWarnings: string[];
  scenePackError: string | null;
  isSplitting: boolean;
  minSceneDurationSeconds: string;
  maxSceneDurationSeconds: string;
  sceneImages: Record<number, SceneImageState>;
  sceneImageErrors: Record<number, string>;
  activeDropSceneIndex: number | null;
  imageSourceMode: ImageSourceMode;
  nanobananaModel: NanobananaModel;
  selectedVisualStyle: VisualStylePresetId;
  nanobananaApiKeyOverride: string;
  sceneGenerationStates: Record<number, SceneGenerationState>;
  narration: NarrationState;
  isNarrationDropActive: boolean;
  music: MusicState;
  isMusicUploading: boolean;
  musicError: string | null;
  elevenLabsVoices: ElevenLabsOption[];
  elevenLabsModels: ElevenLabsOption[];
  isLoadingElevenLabsOptions: boolean;
  elevenLabsOptionsError: string | null;
  isBatchGenerating: boolean;
  batchProgress: {
    completed: number;
    total: number;
    mode: BatchGenerationMode;
  } | null;
  renderStatus: RenderStatus;
  renderResult: RenderPrototypeSuccessResponse | null;
  renderError: string | null;
  previewError: string | null;
  sceneDurationOverrideInputs: Record<number, string>;
  lastRenderMotionAssignments: SceneMotionDebugRow[];
  lastRenderTransitionAssignments: SceneTransitionDebugRow[];
  isClearingGenerated: boolean;
  clearGeneratedMessage: string | null;
  motionEnabled: boolean;
  allowedMotionPresetIds: MotionPresetId[];
  motionStrength: MotionSettings["strength"];
  transitionsEnabled: boolean;
  allowedTransitionPresetIds: TransitionType[];
  transitionDurationMs: number;
};

export function formatSeconds(seconds: number): string {
  return `${seconds.toFixed(1)}s`;
}

export function normalizeSceneDurationOverrideSeconds(value: number): number | undefined {
  if (!Number.isFinite(value)) {
    return undefined;
  }

  const stepped = Math.round(value * 2) / 2;
  const bounded = Math.min(30, Math.max(1, stepped));
  return bounded;
}

export function formatDurationClock(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) {
    return "—";
  }

  const totalSeconds = Math.round(seconds);
  const minutes = Math.floor(totalSeconds / 60);
  const remainingSeconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(remainingSeconds).padStart(2, "0")}`;
}

export function formatFileSize(bytes: number): string {
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

export function isAllowedImageFile(file: File): boolean {
  if (ACCEPTED_IMAGE_TYPES.has(file.type)) {
    return true;
  }

  const lowerName = file.name.toLowerCase();
  return ACCEPTED_IMAGE_EXTENSIONS.some((extension) => lowerName.endsWith(extension));
}

export function isAllowedAudioFile(file: File): boolean {
  if (ACCEPTED_AUDIO_TYPES.has(file.type)) {
    return true;
  }

  const lowerName = file.name.toLowerCase();
  return ACCEPTED_AUDIO_EXTENSIONS.some((extension) => lowerName.endsWith(extension));
}

export function extractAudioDurationFromAudioSource(audioSourceUrl: string): Promise<number | undefined> {
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

export function isObjectUrl(url: string): boolean {
  return url.startsWith("blob:");
}

export function revokeAudioObjectUrlIfNeeded(url?: string): void {
  if (url && isObjectUrl(url)) {
    URL.revokeObjectURL(url);
  }
}

export function revokeImageObjectUrlIfNeeded(url?: string): void {
  if (url && isObjectUrl(url)) {
    URL.revokeObjectURL(url);
  }
}