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

export async function generateNanobananaImage({
  prompt,
  model,
  apiKey,
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
        responseModalities: ["Image"],
        imageConfig: {
          aspectRatio: "16:9",
        },
      },
    }),
  });

  const data = (await response.json()) as GeminiGenerateContentResponse;

  if (!response.ok) {
    const message = data.error?.message || "Gemini image generation request failed.";
    throw new Error(message);
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

  throw new Error("No image data found in Gemini response.");
}
