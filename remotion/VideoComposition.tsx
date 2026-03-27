import { Sequence } from "remotion";

import { SceneFrame } from "./components/SceneFrame";

export type RemotionRenderScene = {
  id: string;
  imageUrl: string;
  durationFrames: number;
};

export type RemotionRenderProps = {
  width: number;
  height: number;
  fps: number;
  scenes: RemotionRenderScene[];
};

export const DEFAULT_REMOTION_RENDER_PROPS: RemotionRenderProps = {
  width: 1280,
  height: 720,
  fps: 30,
  scenes: [
    {
      id: "placeholder",
      imageUrl: "/file.svg",
      durationFrames: 150,
    },
  ],
};

export function VideoComposition(props: RemotionRenderProps) {
  let timelineCursor = 0;

  return (
    <>
      {props.scenes.map((scene) => {
        const from = timelineCursor;
        timelineCursor += scene.durationFrames;

        return (
          <Sequence key={scene.id} from={from} durationInFrames={scene.durationFrames}>
            <SceneFrame imageUrl={scene.imageUrl} width={props.width} height={props.height} />
          </Sequence>
        );
      })}
    </>
  );
}
