export type RenderMediaRef = {
  kind: "file-path" | "url";
  value: string;
};

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

export type RenderSettings = {
  width: number;
  height: number;
  fps: number;
  container: "mp4";
  videoCodec: "h264";
  audioCodec: "aac";
};

export type RenderValidationIssue = {
  code: string;
  message: string;
  level: "error" | "warning";
};

export type RenderProject = {
  scenes: RenderScene[];
  narration?: RenderNarration;
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
};
