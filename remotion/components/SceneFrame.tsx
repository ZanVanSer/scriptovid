import { AbsoluteFill, Img, useCurrentFrame } from "remotion";

import { getSceneMotion } from "../lib/getSceneMotion";
import type { RemotionMotionPresetName } from "../lib/motionPresets";

type SceneFrameProps = {
  imageUrl: string;
  width: number;
  height: number;
  durationInFrames: number;
  frameOffsetFrames?: number;
  motionPreset?: RemotionMotionPresetName;
  motionStrength: "weak" | "medium" | "strong";
};

export function SceneFrame({
  imageUrl,
  width,
  height,
  durationInFrames,
  frameOffsetFrames = 0,
  motionPreset,
  motionStrength,
}: SceneFrameProps) {
  const frame = useCurrentFrame();
  const motionFrame = Math.min(durationInFrames - 1, Math.max(0, frame - frameOffsetFrames));
  const motion = getSceneMotion(motionPreset, motionFrame, durationInFrames, width, height, motionStrength);

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#000000",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Img
        src={imageUrl}
        style={{
          width: width * 1.02,
          height: height * 1.02,
          objectFit: "cover",
          transform: `translate(${motion.translateX}px, ${motion.translateY}px) scale(${motion.scale})`,
          transformOrigin: "center center",
        }}
      />
    </AbsoluteFill>
  );
}
