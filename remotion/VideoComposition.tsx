import { Audio, Sequence, useVideoConfig } from "remotion";

import type { TransitionType } from "@/types/render-project";

import { TransitionSceneLayer } from "./components/TransitionSceneLayer";
import { timelinePlanner } from "./lib/timeline-planner";
import type { RemotionMotionPresetName } from "./lib/motionPresets";

export type RemotionRenderScene = {
  id: string;
  imageUrl: string;
  durationFrames: number;
  transitionType?: TransitionType;
  transitionDurationMs?: number;
  motionPreset?: RemotionMotionPresetName;
};

export type RemotionRenderProps = {
  width: number;
  height: number;
  fps: number;
  motionStrength: number;
  transitions: {
    enabled: boolean;
    durationMs: number;
  };
  scenes: RemotionRenderScene[];
  narration?: {
    audioUrl: string;
  };
  backgroundMusic: {
    enabled: boolean;
    audioUrl: string | null;
    fileName: string | null;
    duration: number | null;
    loop: boolean;
    volume: number;
  };
};

export const DEFAULT_REMOTION_RENDER_PROPS: RemotionRenderProps = {
  width: 1280,
  height: 720,
  fps: 30,
  motionStrength: 1,
  transitions: {
    enabled: true,
    durationMs: 500,
  },
  scenes: [
    {
      id: "placeholder",
      imageUrl: "/file.svg",
      durationFrames: 150,
      transitionType: "crossfade",
      transitionDurationMs: 500,
    },
  ],
  narration: undefined,
  backgroundMusic: {
    enabled: false,
    audioUrl: null,
    fileName: null,
    duration: null,
    loop: false,
    volume: 25,
  },
};

function normalizeMusicVolume(value: number) {
  if (!Number.isFinite(value)) {
    return 0.25;
  }
  const clampedPercent = Math.min(100, Math.max(0, Math.round(value)));
  return clampedPercent / 100;
}

function BackgroundMusicLayer({
  backgroundMusic,
  durationInFrames,
}: {
  backgroundMusic: RemotionRenderProps["backgroundMusic"];
  durationInFrames: number;
}) {
  if (!backgroundMusic.enabled || !backgroundMusic.audioUrl) {
    return null;
  }

  return (
    <Sequence from={0} durationInFrames={durationInFrames}>
      <Audio
        src={backgroundMusic.audioUrl}
        volume={normalizeMusicVolume(backgroundMusic.volume)}
        loop={backgroundMusic.loop}
      />
    </Sequence>
  );
}

export function VideoComposition(props: RemotionRenderProps) {
  const { durationInFrames } = useVideoConfig();
  const timeline = timelinePlanner(props);

  return (
    <>
      <BackgroundMusicLayer
        backgroundMusic={props.backgroundMusic}
        durationInFrames={durationInFrames}
      />
      {props.narration?.audioUrl ? <Audio src={props.narration.audioUrl} /> : null}
      {timeline.entries.map((entry) => {
        return (
          <Sequence key={entry.id} from={entry.renderFromFrame} durationInFrames={entry.sequenceDurationFrames}>
            <TransitionSceneLayer
              entry={entry}
              width={props.width}
              height={props.height}
              motionStrength={props.motionStrength}
            />
          </Sequence>
        );
      })}
    </>
  );
}
