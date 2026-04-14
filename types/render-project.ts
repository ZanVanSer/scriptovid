export type RenderMediaRef = {
  kind: "file-path" | "url";
  value: string;
};

export type MotionPresetId =
  | "slow-zoom-in"
  | "slow-zoom-out"
  | "pan-left-subtle"
  | "pan-right-subtle"
  | "pan-up-subtle"
  | "pan-down-subtle"
  | "drift-left-zoom-in"
  | "drift-right-zoom-in"
  | "zoom-pan";

export type TransitionType =
  | "cut"
  | "crossfade"
  | "slide-left"
  | "slide-right"
  | "zoom-transition";

export type TransitionSettings = {
  enabled: boolean;
  presetPool: TransitionType[];
  durationMs: number;
  renderSessionSeed?: string;
};

export type MotionSettings = {
  enabled: boolean;
  allowedPresetIds: MotionPresetId[];
  assignmentMode: "deterministic-by-scene-index";
  speed: 0.5 | 0.75 | 1;
  strength: number;
};

export const MOTION_STRENGTH_MIN = 0.5;
export const MOTION_STRENGTH_MAX = 5;
export const MOTION_STRENGTH_DEFAULT = 1;

export function normalizeMotionStrength(
  value: unknown,
  fallback: number = MOTION_STRENGTH_DEFAULT,
): number {
  let numericValue: number | undefined;

  if (typeof value === "number" && Number.isFinite(value)) {
    numericValue = value;
  } else if (value === "weak") {
    numericValue = 0.6;
  } else if (value === "medium") {
    numericValue = 1;
  } else if (value === "strong") {
    numericValue = 1.6;
  }

  if (numericValue === undefined) {
    numericValue = fallback;
  }

  return Math.min(MOTION_STRENGTH_MAX, Math.max(MOTION_STRENGTH_MIN, numericValue));
}

export type RenderImageAsset = {
  source: "manual" | "generated";
  mediaRef: RenderMediaRef;
  fileName?: string;
  mimeType?: string;
  width?: number;
  height?: number;
};

export type RenderScene = {
  id: string;
  order: number;
  text: string;
  estimatedDuration: number;
  finalDuration: number;
  durationOverrideSeconds?: number;
  transitionType?: TransitionType;
  transitionDurationMs?: number;
  motionPreset?: MotionPresetId;
  image: RenderImageAsset;
};

export type RenderNarration = {
  provider: "manual" | "elevenlabs";
  mediaRef: RenderMediaRef;
  fileName?: string;
  mimeType?: string;
  fileSize?: number;
  duration?: number;
  voiceId?: string;
  modelId?: string;
};

export type RenderBackgroundMusic = {
  enabled: boolean;
  audioUrl: string | null;
  fileName: string | null;
  duration: number | null;
  loop: boolean;
  volume: number;
};

export type RenderSettings = {
  width: number;
  height: number;
  fps: number;
  container: "mp4";
  videoCodec: "h264";
  audioCodec: "aac";
  transitions: TransitionSettings;
  motion: MotionSettings;
};

export type RenderValidationIssue = {
  code: string;
  message: string;
  level: "error" | "warning";
};

export type RenderProject = {
  scenes: RenderScene[];
  narration?: RenderNarration;
  backgroundMusic?: RenderBackgroundMusic;
  settings: RenderSettings;
  timingStrategy: "estimated" | "scale-to-narration";
  scaleFactor?: number;
  totalEstimatedSceneDuration: number;
  totalFinalSceneDuration: number;
  narrationDuration?: number;
  isReady: boolean;
  issues: RenderValidationIssue[];
};

export const DEFAULT_RENDER_SETTINGS: RenderSettings = {
  width: 1280,
  height: 720,
  fps: 30,
  container: "mp4",
  videoCodec: "h264",
  audioCodec: "aac",
  transitions: {
    enabled: true,
    presetPool: ["crossfade", "slide-left", "slide-right", "zoom-transition"],
    durationMs: 500,
  },
  motion: {
    enabled: true,
    allowedPresetIds: [
      "slow-zoom-in",
      "slow-zoom-out",
      "pan-left-subtle",
      "pan-right-subtle",
      "pan-up-subtle",
      "pan-down-subtle",
      "drift-left-zoom-in",
      "drift-right-zoom-in",
      "zoom-pan",
    ],
    assignmentMode: "deterministic-by-scene-index",
    speed: 0.75,
    strength: MOTION_STRENGTH_DEFAULT,
  },
};
