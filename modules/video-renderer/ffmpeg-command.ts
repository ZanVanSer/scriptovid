import type { RenderProject } from "@/types/render-project";

export type BuildFfmpegPrototypeArgsInput = {
  renderProject: RenderProject;
  narrationPath: string;
  outputPath: string;
};

function getScalePadFilter(width: number, height: number) {
  return `scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:black,format=yuv420p,setsar=1`;
}

export function buildFfmpegPrototypeArgs(input: BuildFfmpegPrototypeArgsInput) {
  const { renderProject, narrationPath, outputPath } = input;
  const width = renderProject.settings.width;
  const height = renderProject.settings.height;
  const fps = renderProject.settings.fps;
  const orderedScenes = [...renderProject.scenes].sort((a, b) => a.order - b.order);

  const inputArgs = orderedScenes.flatMap((scene) => [
    "-loop",
    "1",
    "-t",
    String(scene.finalDuration),
    "-i",
    scene.image.mediaRef.value,
  ]);
  inputArgs.push("-i", narrationPath);

  const perSceneChains = orderedScenes
    .map((_, index) => `[${index}:v]${getScalePadFilter(width, height)}[v${index}]`)
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
