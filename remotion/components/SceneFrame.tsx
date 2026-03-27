import { AbsoluteFill, Img, useCurrentFrame } from "remotion";

import { getSceneMotion } from "../lib/getSceneMotion";
import type { RemotionMotionPresetName } from "../lib/motionPresets";

type SceneFrameProps = {
  imageUrl: string;
  width: number;
  height: number;
  durationInFrames: number;
  motionPreset?: RemotionMotionPresetName;
  motionStrength: "weak" | "medium" | "strong";
};

export function SceneFrame({
  imageUrl,
  width,
  height,
  durationInFrames,
  motionPreset,
  motionStrength,
}: SceneFrameProps) {
  const frame = useCurrentFrame();
  const motion = getSceneMotion(motionPreset, frame, durationInFrames, width, height, motionStrength);

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
