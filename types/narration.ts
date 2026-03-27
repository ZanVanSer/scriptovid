export type NarrationMode = "manual" | "elevenlabs";

export type NarrationStatus = "idle" | "loading" | "done" | "error";
export type NarrationProvider = "manual" | "elevenlabs";

export type NarrationAsset = {
  provider: NarrationProvider;
  audioUrl?: string;
  filePath?: string;
  fileName?: string;
  mimeType?: string;
  fileSize?: number;
  duration?: number;
  voiceId?: string;
  modelId?: string;
};

export type ElevenLabsNarrationSettings = {
  voiceId?: string;
  modelId?: string;
  stability: number;
  similarityBoost: number;
  style: number;
  useSpeakerBoost: boolean;
};

export type NarrationState = {
  mode: NarrationMode;
  status: NarrationStatus;
  asset?: NarrationAsset;
  error?: string;
  elevenLabs: ElevenLabsNarrationSettings;
};

export function createDefaultNarrationState(): NarrationState {
  return {
    mode: "manual",
    status: "idle",
    asset: undefined,
    error: undefined,
    elevenLabs: {
      voiceId: undefined,
      modelId: undefined,
      stability: 0.5,
      similarityBoost: 0.75,
      style: 0,
      useSpeakerBoost: true,
    },
  };
}

export function isNarrationReadyForRender(narration: NarrationState) {
  if (narration.status !== "done") {
    return false;
  }

  return Boolean(narration.asset?.audioUrl || narration.asset?.filePath);
}
