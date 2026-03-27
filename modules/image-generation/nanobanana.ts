const GEMINI_GENERATE_CONTENT_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";

export const NANOBANANA_MODELS = [
  "gemini-3.1-flash-image-preview",
  "gemini-3-pro-image-preview",
  "gemini-2.5-flash-image",
] as const;

export type NanobananaModel = (typeof NANOBANANA_MODELS)[number];

export const DEFAULT_NANOBANANA_MODEL: NanobananaModel = "gemini-3.1-flash-image-preview";

export type GenerateNanobananaImageInput = {
  prompt: string;
  model: NanobananaModel;
  apiKey: string;
  aspectRatio?: "16:9" | "9:16" | "1:1" | "4:3" | "3:4" | "3:2" | "2:3" | "21:9";
};

export type NanobananaImageResult = {
  imageUrl: string;
  mimeType: string;
};

type GeminiResponsePart = {
  text?: string;
  inlineData?: {
    data?: string;
    mimeType?: string;
  };
  inline_data?: {
    data?: string;
    mime_type?: string;
  };
};

function getInlineMimeType(part: GeminiResponsePart) {
  if (part.inlineData?.mimeType) {
    return part.inlineData.mimeType;
  }

  if (part.inline_data?.mime_type) {
    return part.inline_data.mime_type;
  }

  return "image/png";
}

type GeminiGenerateContentResponse = {
  candidates?: Array<{
    content?: {
      parts?: GeminiResponsePart[];
    };
  }>;
  error?: {
    message?: string;
  };
};

export class NanobananaError extends Error {
  statusCode?: number;

  constructor(message: string, statusCode?: number) {
    super(message);
    this.name = "NanobananaError";
    this.statusCode = statusCode;
  }
}

function mapHttpErrorMessage(statusCode: number, fallbackMessage: string) {
  if (statusCode === 401 || statusCode === 403) {
    return "Gemini API authentication failed. Check your API key and model access.";
  }

  if (statusCode === 429) {
    return "Gemini API quota or rate limit reached. Try again in a moment.";
  }

  return fallbackMessage;
}

export async function generateNanobananaImage({
  prompt,
  model,
  apiKey,
  aspectRatio = "16:9",
}: GenerateNanobananaImageInput): Promise<NanobananaImageResult> {
  const trimmedPrompt = prompt.trim();
  if (!trimmedPrompt) {
    throw new Error("Image prompt cannot be empty.");
  }

  const trimmedApiKey = apiKey.trim();
  if (!trimmedApiKey) {
    throw new Error("Missing Gemini API key.");
  }

  const response = await fetch(`${GEMINI_GENERATE_CONTENT_ENDPOINT}/${model}:generateContent`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": trimmedApiKey,
    },
    body: JSON.stringify({
      contents: [
        {
          parts: [{ text: trimmedPrompt }],
        },
      ],
      generationConfig: {
        imageConfig: {
          aspectRatio,
        },
      },
    }),
  });

  const data = (await response.json().catch(() => null)) as GeminiGenerateContentResponse | null;

  if (!response.ok) {
    const fallbackMessage = data?.error?.message || "Gemini image generation request failed.";
    const message = mapHttpErrorMessage(response.status, fallbackMessage);
    throw new NanobananaError(message, response.status);
  }

  if (!data) {
    throw new NanobananaError("Gemini returned an empty response.");
  }

  const parts = data.candidates?.[0]?.content?.parts || [];
  for (const part of parts) {
    const inline = part.inlineData || part.inline_data;
    const base64Image = inline?.data;

    if (base64Image) {
      const mimeType = getInlineMimeType(part);
      return {
        imageUrl: `data:${mimeType};base64,${base64Image}`,
        mimeType,
      };
    }
  }

  throw new NanobananaError("Gemini response did not include image data.");
}
