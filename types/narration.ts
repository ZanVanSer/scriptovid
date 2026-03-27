export type NarrationMode = "manual" | "elevenlabs";

export type NarrationStatus = "idle" | "loading" | "done" | "error";

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
  provider?: "manual" | "elevenlabs";
  audioUrl?: string;
  audioPath?: string;
  fileName?: string;
  mimeType?: string;
  fileSize?: number;
  duration?: number;
  error?: string;
  elevenLabs: ElevenLabsNarrationSettings;
};

export function createDefaultNarrationState(): NarrationState {
  return {
    mode: "manual",
    status: "idle",
    provider: undefined,
    audioUrl: undefined,
    audioPath: undefined,
    fileName: undefined,
    mimeType: undefined,
    fileSize: undefined,
    duration: undefined,
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
