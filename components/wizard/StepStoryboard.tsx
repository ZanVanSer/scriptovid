import { useMemo } from "react";

import { buildSceneImagePrompt } from "@/modules/image-generation/prompt-builder";
import { formatSeconds } from "@/types/api-responses";

import type { WizardState, WizardActions } from "./types";
import styles from "@/app/page.module.css";

interface StepStoryboardProps {
  state: WizardState;
  actions: WizardActions;
  onNext: () => void;
  onBack: () => void;
}

export function StepStoryboard({ state, actions, onNext, onBack }: StepStoryboardProps) {
  const scenePrompts = useMemo(() => {
    if (!state.scenePackResult) {
      return {};
    }

    const prompts: Record<number, string> = {};
    for (const scene of state.scenePackResult.scenes) {
      prompts[scene.index] = buildSceneImagePrompt({
        sceneText: scene.text,
        style: state.selectedVisualStyle,
      });
    }
    return prompts;
  }, [state.scenePackResult, state.selectedVisualStyle]);

  const getSceneGenerationStatus = (sceneIndex: number) => {
    return state.sceneGenerationStates[sceneIndex] || { status: "idle" };
  };

  const getPerSceneGenerateLabel = (sceneIndex: number) => {
    const sceneState = getSceneGenerationStatus(sceneIndex);
    if (sceneState.status === "loading") {
      return "Generating...";
    }
    if (sceneState.status === "error") {
      return "Retry";
    }
    if (state.sceneImages[sceneIndex]) {
      return "Regenerate";
    }
    return "Generate";
  };

  const generationSummary = (() => {
    if (!state.scenePackResult) {
      return { done: 0, error: 0, loading: 0 };
    }
    let done = 0, error = 0, loading = 0;
    for (const scene of state.scenePackResult.scenes) {
      const status = getSceneGenerationStatus(scene.index).status;
      if (status === "done") done += 1;
      else if (status === "error") error += 1;
      else if (status === "loading") loading += 1;
    }
    return { done, error, loading };
  })();

  const formatBatchMode = (mode: "generate-all" | "regenerate-all" | "regenerate-failed") => {
    if (mode === "regenerate-all") return "regenerate all";
    if (mode === "regenerate-failed") return "regenerate failed";
    return "generate all";
  };

  return (
    <section className={styles.panel}>
      <div className={styles.sectionRow}>
        <p className={styles.sectionTitle}>Storyboard</p>
        <span className={styles.count}>Scenes: {state.scenePackResult?.totalSceneCount ?? 0}</span>
      </div>
      <div className={styles.summaryGrid}>
        <div className={styles.summaryItem}>
          Total scene duration: {formatSeconds(state.scenePackResult?.totalEstimatedDurationSeconds ?? 0)}
        </div>
        {state.imageSourceMode === "nanobanana" ? (
          <>
            <div className={styles.summaryItem}>Done: {generationSummary.done}</div>
            <div className={styles.summaryItem}>Errors: {generationSummary.error}</div>
            <div className={styles.summaryItem}>Loading: {generationSummary.loading}</div>
          </>
        ) : null}
      </div>
      <div className={styles.actions}>
        <button type="button" className={styles.button} onClick={onBack}>
          Back
        </button>
        {state.imageSourceMode === "nanobanana" ? (
          <>
            <button
              type="button"
              className={styles.buttonPrimary}
              onClick={() => actions.runBatchGeneration("generate-all")}
              disabled={!state.scenePackResult || state.scenePackResult.scenes.length === 0 || state.isBatchGenerating}
            >
              Generate all images
            </button>
            <button
              type="button"
              className={styles.button}
              onClick={() => actions.runBatchGeneration("regenerate-all")}
              disabled={!state.scenePackResult || state.scenePackResult.scenes.length === 0 || state.isBatchGenerating}
            >
              Regenerate all
            </button>
          </>
        ) : null}
        <button type="button" className={styles.buttonPrimary} onClick={onNext}>
          Next: Narration
        </button>
      </div>
      
      {state.isBatchGenerating && state.batchProgress ? (
        <p className={styles.info}>
          Running {formatBatchMode(state.batchProgress.mode)}: {state.batchProgress.completed}/{state.batchProgress.total}
        </p>
      ) : null}

      {state.scenePackResult && state.scenePackResult.scenes.length > 0 ? (
        <ol className={styles.storyboardStrip}>
          {state.scenePackResult.scenes.map((scene) => {
            const rawDurationOverride = state.sceneDurationOverrideInputs[scene.index];
            const sceneDurationOverride = rawDurationOverride ? Number(rawDurationOverride) : undefined;
            const displayedSceneDuration = sceneDurationOverride ?? scene.estimatedDurationSeconds;
            const generationState = getSceneGenerationStatus(scene.index);

            return (
              <li key={scene.index} className={styles.storyboardCard}>
                <div className={styles.cardHeader}>
                  <p className={styles.cardTitle}>Scene {scene.index}</p>
                  <p className={styles.cardMeta}>
                    {formatSeconds(displayedSceneDuration)}
                  </p>
                </div>
                
                <div
                  className={`${styles.imagePlaceholder} ${
                    state.activeDropSceneIndex === scene.index ? styles.imagePlaceholderActive : ""
                  }`}
                  onClick={() => actions.openSceneFilePicker(scene.index)}
                >
                  {state.sceneImages[scene.index] ? (
                    <img
                      src={state.sceneImages[scene.index].objectUrl}
                      alt={`Scene ${scene.index}`}
                      className={styles.sceneImage}
                    />
                  ) : (
                    <p className={styles.placeholderText}>
                      {state.imageSourceMode === "manual" ? "Click to upload" : "Click to generate/upload"}
                    </p>
                  )}
                </div>

                <input
                  id={`scene-upload-${scene.index}`}
                  type="file"
                  accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp"
                  className={styles.fileInput}
                  onChange={(event) => {
                    const file = event.target.files?.item(0);
                    if (file) {
                      void actions.applySceneImageFile(scene.index, file);
                    }
                    event.target.value = "";
                  }}
                />

                <p className={styles.scenePreview}>{scene.text}</p>
                
                <div className={styles.statusRow}>
                  <span
                    className={`${styles.statusPill} ${
                      generationState.status === "done"
                        ? styles.statusDone
                        : generationState.status === "error"
                          ? styles.statusError
                          : generationState.status === "loading"
                            ? styles.statusLoading
                            : styles.statusIdle
                    }`}
                  >
                    {generationState.status}
                  </span>
                  
                  {state.imageSourceMode === "nanobanana" && (
                    <button
                      type="button"
                      className={styles.smallButton}
                      disabled={generationState.status === "loading" || state.isBatchGenerating}
                      onClick={(e) => {
                        e.stopPropagation();
                        actions.generateSceneImage(scene.index, scenePrompts[scene.index] || scene.text);
                      }}
                    >
                      {getPerSceneGenerateLabel(scene.index)}
                    </button>
                  )}
                </div>

                <details className={styles.promptDetails}>
                  <summary className={styles.promptSummary}>Settings & Prompt</summary>
                  <label className={styles.field}>
                    <span className={styles.fieldLabel}>Duration (s)</span>
                    <input
                      type="number"
                      min="1"
                      max="30"
                      step="0.5"
                      className={styles.numberInput}
                      placeholder="Auto"
                      value={state.sceneDurationOverrideInputs[scene.index] || ""}
                      onChange={(event) => actions.updateSceneDurationOverride(scene.index, event.target.value)}
                    />
                  </label>
                  <p className={styles.promptText}>{scenePrompts[scene.index] || "Prompt unavailable."}</p>
                </details>
              </li>
            );
          })}
        </ol>
      ) : (
        <div className={styles.emptyState}>Split script and build scenes to review storyboard cards.</div>
      )}
    </section>
  );
}
