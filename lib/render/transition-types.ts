import type { TransitionType } from "@/types/render-project";

export const CINEMATIC_TRANSITION_PRESET_IDS: TransitionType[] = [
  "crossfade",
  "slide-left",
  "slide-right",
  "zoom-transition",
];

export const TRANSITION_PRESET_OPTIONS: Array<{ value: TransitionType; label: string }> = [
  { value: "cut", label: "Cut" },
  { value: "crossfade", label: "Crossfade" },
  { value: "slide-left", label: "Slide Left" },
  { value: "slide-right", label: "Slide Right" },
  { value: "zoom-transition", label: "Zoom Transition" },
];

export const CINEMATIC_TRANSITION_OPTIONS = TRANSITION_PRESET_OPTIONS.filter(
  (option) => option.value !== "cut",
);

export const TRANSITION_DURATION_OPTIONS_MS = [250, 500, 750, 1000] as const;
