import { AbsoluteFill, Img } from "remotion";

type SceneFrameProps = {
  imageUrl: string;
  width: number;
  height: number;
};

export function SceneFrame({ imageUrl, width, height }: SceneFrameProps) {
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
          width,
          height,
          objectFit: "cover",
        }}
      />
    </AbsoluteFill>
  );
}
