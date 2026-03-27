import type { RenderProject } from "@/types/render-project";

export type BuildFfmpegPrototypeArgsInput = {
  renderProject: RenderProject;
  narrationPath: string;
  outputPath: string;
};

export function buildFfmpegPrototypeArgs(input: BuildFfmpegPrototypeArgsInput) {
  const { renderProject, narrationPath, outputPath } = input;
  const width = renderProject.settings.width;
  const height = renderProject.settings.height;
  const fps = renderProject.settings.fps;
  const orderedScenes = [...renderProject.scenes].sort((a, b) => a.order - b.order);

  const inputArgs = orderedScenes.flatMap((scene) => [
    "-framerate",
    String(fps),
    "-loop",
    "1",
    "-t",
    scene.finalDuration.toFixed(3),
    "-i",
    scene.image.mediaRef.value,
  ]);
  inputArgs.push("-i", narrationPath);

  // TODO: Remotion renderer will replace this pipeline in Phase 4.5d.2
  const perSceneChains = orderedScenes
    .map((scene, index) => {
      void scene;
      const filter = [
        `scale=${width}:${height}:force_original_aspect_ratio=increase`,
        `crop=${width}:${height}`,
        `fps=${fps}`,
        "format=yuv420p",
        "setsar=1",
      ].join(",");
      return `[${index}:v]${filter}[v${index}]`;
    })
    .join(";");
  const concatInputPads = orderedScenes.map((_, index) => `[v${index}]`).join("");
  const concatChain = `${concatInputPads}concat=n=${orderedScenes.length}:v=1:a=0[vout]`;
  const filterComplex = `${perSceneChains};${concatChain}`;

  const audioInputIndex = orderedScenes.length;
  const videoCodec = renderProject.settings.videoCodec === "h264" ? "libx264" : renderProject.settings.videoCodec;

  return [
    "-y",
    ...inputArgs,
    "-filter_complex",
    filterComplex,
    "-map",
    "[vout]",
    "-map",
    `${audioInputIndex}:a:0`,
    "-r",
    String(fps),
    "-c:v",
    videoCodec,
    "-pix_fmt",
    "yuv420p",
    "-c:a",
    renderProject.settings.audioCodec,
    "-shortest",
    "-movflags",
    "+faststart",
    outputPath,
  ];
}
