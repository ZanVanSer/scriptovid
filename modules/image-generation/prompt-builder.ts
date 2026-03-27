export const VISUAL_STYLE_PRESETS = [
  {
    id: "cinematic-documentary",
    label: "Cinematic documentary",
    medium: "cinematic documentary photography",
    lighting: "natural directional light with soft contrast and believable highlights",
    mood: "grounded, observant, and authentic",
    composition: "story-first framing with clear subject focus and realistic spatial depth",
    color: "earthy, restrained color grading with neutral tones",
  },
  {
    id: "realistic",
    label: "Realistic",
    medium: "high-fidelity realistic image-making",
    lighting: "balanced natural light with accurate shadow behavior",
    mood: "clear, credible, and informative",
    composition: "clean perspective with practical framing and physical realism",
    color: "true-to-life colors with moderate contrast",
  },
  {
    id: "cartoon",
    label: "Cartoon",
    medium: "clean cartoon illustration",
    lighting: "soft stylized lighting with readable shape definition",
    mood: "friendly, energetic, and approachable",
    composition: "bold readable silhouettes and simplified visual hierarchy",
    color: "controlled vibrant palette with clear color blocking",
  },
  {
    id: "dramatic",
    label: "Dramatic",
    medium: "cinematic dramatic visual style",
    lighting: "directional moody lighting with pronounced contrast and depth",
    mood: "intense, emotional, and high-stakes",
    composition: "deliberate cinematic framing that emphasizes tension and subject presence",
    color: "deep tones with selective accents and richer shadows",
  },
  {
    id: "modern-explainer",
    label: "Modern explainer",
    medium: "modern explainer visual design",
    lighting: "clean studio-like lighting with minimal visual noise",
    mood: "professional, concise, and confident",
    composition: "structured composition optimized for clarity and quick understanding",
    color: "balanced contemporary palette with clean separation between elements",
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
  const styleDescription = `Use a ${preset.medium} look with ${preset.lighting}, a ${preset.mood} mood, ${preset.composition}, and ${preset.color}.`;

  if (!normalizedSceneText) {
    return `Create a scene for a narrated video. ${styleDescription} ${FIXED_STORYBOARD_RULES}`;
  }

  return `Create a scene that faithfully depicts this narrative moment: ${normalizedSceneText}. ${styleDescription} ${FIXED_STORYBOARD_RULES}`;
}
