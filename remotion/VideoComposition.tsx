import { AbsoluteFill } from "remotion";

export function VideoComposition() {
  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#000000",
        color: "#ffffff",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 64,
        fontWeight: 700,
        fontFamily: "Helvetica, sans-serif",
      }}
    >
      Remotion Render Test
    </AbsoluteFill>
  );
}
