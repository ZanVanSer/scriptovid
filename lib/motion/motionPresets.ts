import type { MotionPresetId } from "@/types/render-project";

export type MotionPreset = {
  id: MotionPresetId;
  name: string;
};

export const MOTION_PRESETS: MotionPreset[] = [
  {
    id: "slow-zoom-in",
    name: "Slow Zoom In",
  },
  {
    id: "slow-zoom-out",
    name: "Slow Zoom Out",
  },
  {
    id: "pan-left-subtle",
    name: "Pan Left (Subtle)",
  },
  {
    id: "pan-right-subtle",
    name: "Pan Right (Subtle)",
  },
  {
    id: "pan-up-subtle",
    name: "Pan Up (Subtle)",
  },
  {
    id: "pan-down-subtle",
    name: "Pan Down (Subtle)",
  },
  {
    id: "drift-left-zoom-in",
    name: "Drift Left + Zoom In",
  },
  {
    id: "drift-right-zoom-in",
    name: "Drift Right + Zoom In",
  },
];

export const MOTION_PRESET_IDS: MotionPresetId[] = MOTION_PRESETS.map((preset) => preset.id);
