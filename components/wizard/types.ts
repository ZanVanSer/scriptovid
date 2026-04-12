import type { NanobananaModel } from "@/modules/image-generation/nanobanana";
import type { VisualStylePresetId } from "@/modules/image-generation/prompt-builder";
import type { NarrationState } from "@/types/narration";
import type { MusicState } from "@/types/music";
import type { MotionPresetId, MotionSettings, TransitionType } from "@/types/render-project";
import type { ScenePackResult } from "@/types/scene";
import type { SentenceSplitResponse } from "@/types/sentence";

import {
  type SceneImageState,
  type ImageSourceMode,
  type SceneGenerationState,
  type BatchGenerationMode,
  type RenderStatus,
  type ElevenLabsOption,
  type SceneMotionDebugRow,
  type SceneTransitionDebugRow,
} from "@/types/api-responses";

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
  renderResult: import("@/types/api-responses").RenderPrototypeSuccessResponse | null;
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

export type WizardActions = {
  // Setters
  setScriptText: (value: string) => void;
  setResult: (value: SentenceSplitResponse | null) => void;
  setScenePackResult: (value: ScenePackResult | null) => void;
  setError: (value: string | null) => void;
  setInputFeedback: (value: string | null) => void;
  setSplitWarnings: (value: string[]) => void;
  setScenePackError: (value: string | null) => void;
  setIsSplitting: (value: boolean) => void;
  setMinSceneDurationSeconds: (value: string) => void;
  setMaxSceneDurationSeconds: (value: string) => void;
  setSceneImages: (value: Record<number, SceneImageState>) => void;
  setSceneImageErrors: (value: Record<number, string>) => void;
  setActiveDropSceneIndex: (value: number | null) => void;
  setImageSourceMode: (value: ImageSourceMode) => void;
  setNanobananaModel: (value: NanobananaModel) => void;
  setSelectedVisualStyle: (value: VisualStylePresetId) => void;
  setNanobananaApiKeyOverride: (value: string) => void;
  setSceneGenerationStates: (value: Record<number, SceneGenerationState>) => void;
  setNarration: (value: NarrationState | ((prev: NarrationState) => NarrationState)) => void;
  setIsNarrationDropActive: (value: boolean) => void;
  setMusic: (value: MusicState | ((prev: MusicState) => MusicState)) => void;
  setIsMusicUploading: (value: boolean) => void;
  setMusicError: (value: string | null) => void;
  setElevenLabsVoices: (value: ElevenLabsOption[]) => void;
  setElevenLabsModels: (value: ElevenLabsOption[]) => void;
  setIsLoadingElevenLabsOptions: (value: boolean) => void;
  setElevenLabsOptionsError: (value: string | null) => void;
  setIsBatchGenerating: (value: boolean) => void;
  setBatchProgress: (value: { completed: number; total: number; mode: BatchGenerationMode } | null) => void;
  setRenderStatus: (value: RenderStatus) => void;
  setRenderResult: (value: import("@/types/api-responses").RenderPrototypeSuccessResponse | null) => void;
  setRenderError: (value: string | null) => void;
  setPreviewError: (value: string | null) => void;
  setSceneDurationOverrideInputs: (value: Record<number, string>) => void;
  setLastRenderMotionAssignments: (value: SceneMotionDebugRow[]) => void;
  setLastRenderTransitionAssignments: (value: SceneTransitionDebugRow[]) => void;
  setIsClearingGenerated: (value: boolean) => void;
  setClearGeneratedMessage: (value: string | null) => void;
  setMotionEnabled: (value: boolean) => void;
  setAllowedMotionPresetIds: (value: MotionPresetId[]) => void;
  setMotionStrength: (value: MotionSettings["strength"]) => void;
  setTransitionsEnabled: (value: boolean) => void;
  setAllowedTransitionPresetIds: (value: TransitionType[]) => void;
  setTransitionDurationMs: (value: number) => void;

  // Actions
  clearNarrationAsset: () => void;
  clearSceneDurationOverrides: () => void;
  clearMusicFile: () => void;
  applyManualNarrationFile: (file: File) => Promise<void>;
  applyMusicFile: (file: File) => Promise<void>;
  openNarrationFilePicker: () => void;
  openMusicFilePicker: () => void;
  updateElevenLabsSettings: (field: "voiceId" | "modelId" | "stability" | "similarityBoost" | "style" | "useSpeakerBoost", value: string | number | boolean) => void;
  loadElevenLabsOptions: () => Promise<void>;
  generateElevenLabsNarration: () => Promise<void>;
  clearSceneImageErrorsFor: (sceneIndex: number) => void;
  clearAllSceneImages: () => void;
  removeSceneImage: (sceneIndex: number) => void;
  applySceneImageFile: (sceneIndex: number, file: File) => Promise<void>;
  generateSceneImage: (sceneIndex: number, prompt: string, forcedApiKey?: string) => Promise<void>;
  runBatchGeneration: (mode: BatchGenerationMode) => Promise<void>;
  openSceneFilePicker: (sceneIndex: number) => void;
  handleSplit: () => Promise<void>;
  handleLoadSample: () => void;
  handlePackScenes: () => void;
  getSceneGenerationStatus: (sceneIndex: number) => SceneGenerationState;
  getPerSceneGenerateLabel: (sceneIndex: number) => string;
  formatBatchMode: (mode: BatchGenerationMode) => string;
  buildRenderProjectFromCurrentState: (options?: { motionAssignmentSalt?: string; renderSessionSeed?: string }) => ReturnType<typeof import("@/modules/video-renderer/render-project").buildRenderProject>;
  handleRenderVideo: () => Promise<void>;
  handlePreviewVideo: () => void;
  handleClearGeneratedFiles: () => Promise<void>;
  toggleAllowedMotionPreset: (presetId: MotionPresetId) => void;
  toggleAllowedTransitionPreset: (presetId: TransitionType) => void;
  updateSceneDurationOverride: (sceneIndex: number, value: string) => void;
};