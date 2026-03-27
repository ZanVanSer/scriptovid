import { mkdir, stat } from "node:fs/promises";
import path from "node:path";

const OUTPUT_DIRECTORY = path.join(/* turbopackIgnore: true */ process.cwd(), "public", "generated", "renders");
const REMOTION_ENTRY = path.join(/* turbopackIgnore: true */ process.cwd(), "remotion", "Root.tsx");
const REMOTION_TEST_COMPOSITION_ID = "remotion-test-composition";

function createRemotionRenderFileName() {
  const timestamp = new Date().toISOString().replace(/[-:.TZ]/g, "");
  const nonce = Math.random().toString(36).slice(2, 8);
  return `remotion-test-${timestamp}-${nonce}.mp4`;
}

export type RemotionRenderSuccessResult = {
  success: true;
  outputPath: string;
  outputUrl: string;
  fileName: string;
  fileSize: number;
  mimeType: "video/mp4";
};

export async function renderTestVideo(outputPath?: string): Promise<RemotionRenderSuccessResult> {
  const [{ bundle }, { renderMedia, selectComposition }] = await Promise.all([
    import("@remotion/bundler"),
    import("@remotion/renderer"),
  ]);

  await mkdir(OUTPUT_DIRECTORY, { recursive: true });

  const fileName = outputPath ? path.basename(outputPath) : createRemotionRenderFileName();
  const resolvedOutputPath = outputPath || path.join(OUTPUT_DIRECTORY, fileName);
  const outputUrl = `/generated/renders/${path.basename(resolvedOutputPath)}`;

  const bundledServeUrl = await bundle({
    entryPoint: REMOTION_ENTRY,
  });

  const composition = await selectComposition({
    serveUrl: bundledServeUrl,
    id: REMOTION_TEST_COMPOSITION_ID,
    inputProps: {},
  });

  // TODO: Replace slideshow renderer with Remotion in Phase 4.5d.4
  await renderMedia({
    serveUrl: bundledServeUrl,
    composition,
    codec: "h264",
    outputLocation: resolvedOutputPath,
    inputProps: {},
  });

  const outputStats = await stat(resolvedOutputPath);

  return {
    success: true,
    outputPath: resolvedOutputPath,
    outputUrl,
    fileName: path.basename(resolvedOutputPath),
    fileSize: outputStats.size,
    mimeType: "video/mp4",
  };
}
