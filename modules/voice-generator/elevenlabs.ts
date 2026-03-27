import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

export type GenerateElevenLabsNarrationRequest = {
  text: string;
  voiceId: string;
  modelId: string;
  stability?: number;
  similarityBoost?: number;
  style?: number;
  useSpeakerBoost?: boolean;
};

export type GenerateElevenLabsNarrationInput = {
  text: string;
  voiceId: string;
  modelId: string;
  stability: number;
  similarityBoost: number;
  style: number;
  useSpeakerBoost: boolean;
};

export type GenerateElevenLabsNarrationResult = {
  audioUrl: string;
  audioPath: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  provider: "elevenlabs";
  voiceId: string;
  modelId: string;
};

export type ElevenLabsVoiceOption = {
  id: string;
  name: string;
};

export type ElevenLabsModelOption = {
  id: string;
  name: string;
};

export type ElevenLabsNarrationOptions = {
  voices: ElevenLabsVoiceOption[];
  models: ElevenLabsModelOption[];
};

export type ElevenLabsErrorCode =
  | "MISSING_API_KEY"
  | "INVALID_REQUEST"
  | "EMPTY_TEXT"
  | "MISSING_VOICE_ID"
  | "MISSING_MODEL_ID"
  | "PROVIDER_AUTH"
  | "PROVIDER_RATE_LIMIT"
  | "PROVIDER_VALIDATION"
  | "PROVIDER_NETWORK"
  | "PROVIDER_RESPONSE"
  | "FILE_SAVE_FAILED";

const ELEVENLABS_TTS_ENDPOINT = "https://api.elevenlabs.io/v1/text-to-speech";
const ELEVENLABS_AUDIO_OUTPUT_DIR = path.join(process.cwd(), "public", "generated", "narration");

export class ElevenLabsConnectorError extends Error {
  readonly code: ElevenLabsErrorCode;
  readonly statusCode: number;
  readonly details?: string;

  constructor(code: ElevenLabsErrorCode, message: string, statusCode = 500, details?: string) {
    super(message);
    this.name = "ElevenLabsConnectorError";
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }
}

function sanitizeToken(value: string) {
  return value.trim().replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 24) || "default";
}

function getAudioFileName(voiceId: string, modelId: string) {
  const timestamp = new Date().toISOString().replace(/[-:.TZ]/g, "");
  const nonce = Math.random().toString(36).slice(2, 8);
  const voice = sanitizeToken(voiceId);
  const model = sanitizeToken(modelId);
  return `narration-elevenlabs-${timestamp}-${voice}-${model}-${nonce}.mp3`;
}

function clampUnitValue(value: number, fieldLabel: string) {
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new ElevenLabsConnectorError(
      "INVALID_REQUEST",
      `${fieldLabel} must be a number between 0 and 1.`,
      400,
    );
  }
  return value;
}

function getStringField(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function getOptionalNumberField(value: unknown) {
  if (value === undefined) {
    return undefined;
  }

  return typeof value === "number" ? value : Number.NaN;
}

export function normalizeElevenLabsNarrationRequest(
  rawInput: GenerateElevenLabsNarrationRequest,
): GenerateElevenLabsNarrationInput {
  const text = getStringField(rawInput.text);
  if (!text) {
    throw new ElevenLabsConnectorError("EMPTY_TEXT", "Narration text cannot be empty.", 400);
  }

  const voiceId = getStringField(rawInput.voiceId);
  if (!voiceId) {
    throw new ElevenLabsConnectorError("MISSING_VOICE_ID", "voiceId is required.", 400);
  }

  const modelId = getStringField(rawInput.modelId);
  if (!modelId) {
    throw new ElevenLabsConnectorError("MISSING_MODEL_ID", "modelId is required.", 400);
  }

  const stability = getOptionalNumberField(rawInput.stability);
  const similarityBoost = getOptionalNumberField(rawInput.similarityBoost);
  const style = getOptionalNumberField(rawInput.style);
  const useSpeakerBoost =
    rawInput.useSpeakerBoost === undefined ? true : rawInput.useSpeakerBoost;
  if (typeof useSpeakerBoost !== "boolean") {
    throw new ElevenLabsConnectorError(
      "INVALID_REQUEST",
      "useSpeakerBoost must be a boolean when provided.",
      400,
    );
  }

  return {
    text,
    voiceId,
    modelId,
    stability: clampUnitValue(stability ?? 0.5, "stability"),
    similarityBoost: clampUnitValue(similarityBoost ?? 0.75, "similarityBoost"),
    style: clampUnitValue(style ?? 0, "style"),
    useSpeakerBoost,
  };
}

function mapProviderErrorMessage(statusCode: number) {
  if (statusCode === 401 || statusCode === 403) {
    return {
      code: "PROVIDER_AUTH" as const,
      message: "ElevenLabs authentication failed. Check ELEVENLABS_API_KEY and voice access.",
    };
  }

  if (statusCode === 429) {
    return {
      code: "PROVIDER_RATE_LIMIT" as const,
      message: "ElevenLabs rate limit or quota reached. Try again shortly.",
    };
  }

  if (statusCode >= 400 && statusCode < 500) {
    return {
      code: "PROVIDER_VALIDATION" as const,
      message: "ElevenLabs rejected the narration request payload.",
    };
  }

  return {
    code: "PROVIDER_RESPONSE" as const,
    message: "ElevenLabs narration generation failed.",
  };
}

function stringifySafeDetails(value: unknown) {
  if (typeof value === "string") {
    return value.slice(0, 280);
  }

  if (Array.isArray(value) || (typeof value === "object" && value !== null)) {
    return JSON.stringify(value).slice(0, 280);
  }

  return undefined;
}

function getErrorDetailsFromProvider(data: unknown) {
  if (!data || typeof data !== "object") {
    return undefined;
  }

  const record = data as Record<string, unknown>;
  if ("detail" in record) {
    return stringifySafeDetails(record.detail);
  }

  if ("message" in record) {
    return stringifySafeDetails(record.message);
  }

  if ("error" in record) {
    return stringifySafeDetails(record.error);
  }

  return undefined;
}

function getServerApiKey() {
  const apiKey = process.env.ELEVENLABS_API_KEY?.trim();
  if (!apiKey) {
    throw new ElevenLabsConnectorError(
      "MISSING_API_KEY",
      "ELEVENLABS_API_KEY is missing on the server.",
      500,
    );
  }

  return apiKey;
}

function readStringField(record: Record<string, unknown>, key: string) {
  const value = record[key];
  return typeof value === "string" ? value.trim() : "";
}

export async function fetchElevenLabsNarrationOptions(): Promise<ElevenLabsNarrationOptions> {
  const apiKey = getServerApiKey();
  const headers = {
    "xi-api-key": apiKey,
    Accept: "application/json",
  };

  let voicesResponse: Response;
  let modelsResponse: Response;
  try {
    [voicesResponse, modelsResponse] = await Promise.all([
      fetch("https://api.elevenlabs.io/v1/voices", { headers }),
      fetch("https://api.elevenlabs.io/v1/models", { headers }),
    ]);
  } catch {
    throw new ElevenLabsConnectorError(
      "PROVIDER_NETWORK",
      "Could not reach ElevenLabs while loading voice settings.",
      502,
    );
  }

  if (!voicesResponse.ok || !modelsResponse.ok) {
    const failed = !voicesResponse.ok ? voicesResponse : modelsResponse;
    const providerBody = await failed.json().catch(() => null);
    const mapped = mapProviderErrorMessage(failed.status);
    throw new ElevenLabsConnectorError(
      mapped.code,
      mapped.message,
      failed.status,
      getErrorDetailsFromProvider(providerBody),
    );
  }

  const voicesPayload = (await voicesResponse.json().catch(() => null)) as
    | { voices?: Array<Record<string, unknown>> }
    | null;
  const modelsPayload = (await modelsResponse.json().catch(() => null)) as
    | Array<Record<string, unknown>>
    | null;

  if (!voicesPayload || !Array.isArray(voicesPayload.voices) || !Array.isArray(modelsPayload)) {
    throw new ElevenLabsConnectorError(
      "PROVIDER_RESPONSE",
      "ElevenLabs returned an unexpected options response.",
      502,
    );
  }

  const voices: ElevenLabsVoiceOption[] = voicesPayload.voices
    .map((voiceRecord) => {
      const id = readStringField(voiceRecord, "voice_id");
      const name = readStringField(voiceRecord, "name");
      if (!id || !name) {
        return null;
      }

      return { id, name };
    })
    .filter((item): item is ElevenLabsVoiceOption => item !== null)
    .sort((a, b) => a.name.localeCompare(b.name));

  const models: ElevenLabsModelOption[] = modelsPayload
    .map((modelRecord) => {
      const id = readStringField(modelRecord, "model_id");
      const name = readStringField(modelRecord, "name");
      const canDoTts = modelRecord.can_do_text_to_speech !== false;

      if (!id || !name || !canDoTts) {
        return null;
      }

      return { id, name };
    })
    .filter((item): item is ElevenLabsModelOption => item !== null)
    .sort((a, b) => a.name.localeCompare(b.name));

  return { voices, models };
}

export async function generateElevenLabsNarration(
  normalizedInput: GenerateElevenLabsNarrationInput,
): Promise<GenerateElevenLabsNarrationResult> {
  const apiKey = getServerApiKey();

  let response: Response;
  try {
    response = await fetch(`${ELEVENLABS_TTS_ENDPOINT}/${encodeURIComponent(normalizedInput.voiceId)}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "audio/mpeg",
        "xi-api-key": apiKey,
      },
      body: JSON.stringify({
        text: normalizedInput.text,
        model_id: normalizedInput.modelId,
        output_format: "mp3_44100_128",
        voice_settings: {
          stability: normalizedInput.stability,
          similarity_boost: normalizedInput.similarityBoost,
          style: normalizedInput.style,
          use_speaker_boost: normalizedInput.useSpeakerBoost,
        },
      }),
    });
  } catch {
    throw new ElevenLabsConnectorError(
      "PROVIDER_NETWORK",
      "Could not reach ElevenLabs. Check your network and try again.",
      502,
    );
  }

  if (!response.ok) {
    const providerBody = await response.json().catch(() => null);
    const mapped = mapProviderErrorMessage(response.status);
    throw new ElevenLabsConnectorError(
      mapped.code,
      mapped.message,
      response.status,
      getErrorDetailsFromProvider(providerBody),
    );
  }

  const arrayBuffer = await response.arrayBuffer();
  if (!arrayBuffer || arrayBuffer.byteLength === 0) {
    throw new ElevenLabsConnectorError(
      "PROVIDER_RESPONSE",
      "ElevenLabs returned an empty audio response.",
      502,
    );
  }

  const buffer = Buffer.from(arrayBuffer);
  const fileName = getAudioFileName(normalizedInput.voiceId, normalizedInput.modelId);
  const filePath = path.join(ELEVENLABS_AUDIO_OUTPUT_DIR, fileName);

  try {
    await mkdir(ELEVENLABS_AUDIO_OUTPUT_DIR, { recursive: true });
    await writeFile(filePath, buffer);
  } catch {
    throw new ElevenLabsConnectorError(
      "FILE_SAVE_FAILED",
      "Narration audio was generated but could not be saved locally.",
      500,
    );
  }

  const mimeType = response.headers.get("content-type") || "audio/mpeg";

  return {
    audioUrl: `/generated/narration/${fileName}`,
    audioPath: filePath,
    fileName,
    mimeType,
    fileSize: buffer.byteLength,
    provider: "elevenlabs",
    voiceId: normalizedInput.voiceId,
    modelId: normalizedInput.modelId,
  };
}
