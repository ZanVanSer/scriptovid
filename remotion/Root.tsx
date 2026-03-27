import { Composition, registerRoot } from "remotion";

import { VideoComposition } from "./VideoComposition";

const REMOTION_TEST_COMPOSITION_ID = "remotion-test-composition";

export function RemotionRoot() {
  return (
    <Composition
      id={REMOTION_TEST_COMPOSITION_ID}
      component={VideoComposition}
      durationInFrames={150}
      fps={30}
      width={1280}
      height={720}
    />
  );
}

registerRoot(RemotionRoot);

export { REMOTION_TEST_COMPOSITION_ID };
