export const VISUAL_STYLE_PRESETS = [
  {
    id: "cinematic-documentary",
    label: "Cinematic documentary",
    visualDirection:
      "grounded cinematic documentary photography with natural textures, believable lighting, and real-world detail",
  },
  {
    id: "realistic",
    label: "Realistic",
    visualDirection:
      "highly realistic visual storytelling with accurate materials, natural proportions, and true-to-life environments",
  },
  {
    id: "cartoon",
    label: "Cartoon",
    visualDirection:
      "clean cartoon illustration with expressive shapes, readable silhouettes, and polished color blocking",
  },
  {
    id: "dramatic",
    label: "Dramatic",
    visualDirection:
      "dramatic cinematic staging with strong contrast, purposeful mood lighting, and emotionally focused composition",
  },
  {
    id: "modern-explainer",
    label: "Modern explainer",
    visualDirection:
      "modern explainer-style visual design with clear subjects, simplified environments, and professional editorial clarity",
  },
] as const;

export type VisualStylePreset = (typeof VISUAL_STYLE_PRESETS)[number];
export type VisualStylePresetId = VisualStylePreset["id"];

export const DEFAULT_VISUAL_STYLE_PRESET_ID: VisualStylePresetId = "cinematic-documentary";

const FIXED_STORYBOARD_RULES =
  "The output must be a single coherent frame for a professional narrated video scene in 16:9 horizontal composition. Do not include any visible text, captions, logos, watermarks, collage layout, or split-screen composition.";

function normalizeSceneText(sceneText: string) {
  return sceneText.replace(/\s+/g, " ").trim();
}

function getStylePreset(styleId: VisualStylePresetId) {
  return (
    VISUAL_STYLE_PRESETS.find((preset) => preset.id === styleId) ||
    VISUAL_STYLE_PRESETS.find((preset) => preset.id === DEFAULT_VISUAL_STYLE_PRESET_ID) ||
    VISUAL_STYLE_PRESETS[0]
  );
}

export function buildSceneImagePrompt({
  sceneText,
  style,
}: {
  sceneText: string;
  style: VisualStylePresetId;
}): string {
  const normalizedSceneText = normalizeSceneText(sceneText);
  const preset = getStylePreset(style);

  if (!normalizedSceneText) {
    return `Create a ${preset.visualDirection} scene. ${FIXED_STORYBOARD_RULES}`;
  }

  return `Create a ${preset.visualDirection} scene that faithfully depicts this narrative moment: ${normalizedSceneText}. ${FIXED_STORYBOARD_RULES}`;
}
